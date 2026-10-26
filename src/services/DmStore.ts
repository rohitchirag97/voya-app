import { createMMKV } from 'react-native-mmkv';
import { api, type CpProposal, type DirectMessage, type UserSummary } from '../api';

// Inbox chats live on this phone only (the server holds a message just until this phone has it, then deletes it).
// Clearing the app's storage or uninstalling removes them. Kept per signed-in account.
const storage = createMMKV({ id: 'dm' });
const MAX_PER_CHAT = 2000; // oldest drop off beyond this

export type Peer = Pick<UserSummary, 'userId' | 'displayName' | 'avatarUrl'> & Partial<UserSummary>;
export type Chat = { peer: Peer; last: DirectMessage; unread: number };
type Incoming = DirectMessage & { sender?: Peer | null; recipient?: Peer | null };

let me: string | null = null;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((fn) => fn());
export function subscribeDms(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

const key = (k: string) => `${me}:${k}`;
const read = <T>(k: string, fallback: T): T => {
  const raw = me ? storage.getString(key(k)) : undefined;
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => me && storage.set(key(k), JSON.stringify(v));

export const setDmOwner = (userId: string | null) => {
  me = userId;
  changed();
};

// ---------- reads ----------
export const getChat = (peerId: string) => read<DirectMessage[]>(`chat:${peerId}`, []); // oldest first
export const getChats = () => Object.values(read<Record<string, Chat>>('chats', {})).sort((a, b) => b.last.id - a.last.id);
export const totalUnread = () => getChats().reduce((n, c) => n + c.unread, 0);

// ---------- writes ----------
function put(peerId: string, msgs: DirectMessage[], peer: Peer | null, unreadAdd: number) {
  const list = getChat(peerId);
  const seen = new Set(list.map((m) => m.id));
  const fresh = msgs.filter((m) => !seen.has(m.id));
  if (!fresh.length && !peer) return 0;
  const merged = [...list, ...fresh].sort((a, b) => a.id - b.id).slice(-MAX_PER_CHAT);
  write(`chat:${peerId}`, merged);
  const chats = read<Record<string, Chat>>('chats', {});
  const prev = chats[peerId];
  const last = merged[merged.length - 1];
  if (last) chats[peerId] = { peer: { ...prev?.peer, ...peer, userId: peerId } as Peer, last, unread: (prev?.unread ?? 0) + unreadAdd };
  write('chats', chats);
  return fresh.length;
}

// Messages that reached this phone (live or picked up after being offline). Returns ids to ack to the server.
export function saveDms(list: Incoming[], openChat: string | null) {
  if (!me) return [];
  const mine = me;
  const byPeer = new Map<string, Incoming[]>();
  for (const m of list) {
    const peerId = m.senderId === mine ? m.recipientId : m.senderId;
    byPeer.set(peerId, [...(byPeer.get(peerId) ?? []), m]);
  }
  for (const [peerId, msgs] of byPeer) {
    const theirs = msgs.filter((m) => m.senderId !== mine);
    // Who the chat is with: the sender of their messages, or the recipient of mine.
    const sender = theirs.find((m) => m.sender)?.sender ?? msgs.find((m) => m.senderId === mine && m.recipient)?.recipient ?? null;
    const before = new Set(getChat(peerId).map((m) => m.id));
    const unread = peerId === openChat ? 0 : theirs.filter((m) => !before.has(m.id)).length;
    put(peerId, msgs, sender, unread);
  }
  changed();
  return list.filter((m) => m.recipientId === mine).map((m) => m.id);
}

// Something I sent (the server's copy of it), shown in my chat with `peer`.
export function saveSent(m: DirectMessage, peer: Peer) {
  put(m.recipientId, [m], peer, 0);
  changed();
}

// Only writes (and notifies) when something changes: screens call this from their store listener.
export function markChatRead(peerId: string, peer?: Peer) {
  const chats = read<Record<string, Chat>>('chats', {});
  const c = chats[peerId];
  if (!c) return;
  const nextPeer = peer ? { ...c.peer, ...peer } : c.peer;
  if (c.unread === 0 && JSON.stringify(nextPeer) === JSON.stringify(c.peer)) return;
  chats[peerId] = { ...c, unread: 0, peer: nextPeer };
  write('chats', chats);
  changed();
}

// A CP card's status changed (accepted, declined, …): update every saved copy in that chat.
export function updateCpCards(peerId: string, cards: CpProposal[]) {
  const by = new Map(cards.map((c) => [c.id, c]));
  const list = getChat(peerId);
  let touched = false;
  const next = list.map((m) => (m.cp && by.has(m.cp.id) ? ((touched = true), { ...m, cp: by.get(m.cp.id)! }) : m));
  if (touched) {
    write(`chat:${peerId}`, next);
    changed();
  }
}
export function updateCpStatus(proposalId: string, status: CpProposal['status']) {
  for (const c of getChats()) {
    const list = getChat(c.peer.userId);
    if (list.some((m) => m.cp?.id === proposalId)) {
      write(`chat:${c.peer.userId}`, list.map((m) => (m.cp?.id === proposalId ? { ...m, cp: { ...m.cp, status } } : m)));
      changed();
    }
  }
}

// Collect what waited on the server while this phone was away, save it, and let the server forget it.
export async function syncPending(openChat: string | null) {
  const r = await api<{ messages: Incoming[] }>('GET', '/dm/pending');
  const ids = saveDms(r.messages, openChat);
  if (ids.length) await api('POST', '/dm/ack', { ids });
  await importSentOnce();
  return ids.length;
}

// Once per account on this phone: my own messages the server still holds (not yet picked up by their recipients), so
// chats from before the switch to on-phone storage show both sides. Nothing is deleted on the server.
async function importSentOnce() {
  if (!me || storage.getBoolean(key('importedSent'))) return;
  const r = await api<{ messages: Incoming[] }>('GET', '/dm/sent');
  saveDms(r.messages, null);
  storage.set(key('importedSent'), true);
}

export const ackDms = (ids: number[]) => (ids.length ? api('POST', '/dm/ack', { ids }).catch(() => {}) : Promise.resolve());
