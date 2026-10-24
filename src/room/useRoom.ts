import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api, ApiError, errorText, newId, type Charisma, type ChatMessage, getCards, type LivePk, type LivePkInvite, type Pk, type Me, type RoomSettingsPatch, type RoomSnapshot, type Seat, type UserProfile, type UserSummary, type ZegoCreds } from '../api';
import { toast } from '../components/ui';
import { connectSocket, send } from '../services/RoomSocket';
import { ensureMicPermission, zego, type MediaState } from '../services/ZegoAudioRoomService';
import type { BigWin } from './BigWinBanner';
import { emoteMs, type EmoteKey } from './Emotes';

export type GiftEvent = {
  transactionId: string;
  sender: { userId: string; displayName: string };
  recipient: { userId: string | null; displayName: string }; // userId null = everyone on stage
  seatIndex: number;
  gift: { id: string; name: string; svg?: string | null; animation?: string | null };
  quantity: number;
};
export type Mention = { userId: string; handle: string };
export type SeatEmote = { id: string; emote: EmoteKey; result?: string };
export type FollowNote = { user: { userId: string; displayName: string | null; avatarUrl: string | null }; youFollowThem: boolean };
export type KickedUser = { userId: string; displayName: string | null; avatarUrl: string | null; kickedAt: string };
export type SeatInvite = { seatIndex: number; from: { userId: string; displayName: string } };
// Level-ups / SVIP tier-ups broadcast to every room.
export type Announcement = { userId: string; displayName: string; avatarUrl: string | null; at: string } & ({ kind: 'SVIP_UP'; tier: number } | { kind: 'LEVEL_UP'; level: number } | { kind: 'CP_LOVE'; partnerId: string; partnerName: string });
// An SVIP2+ member entering: plays the entrance animation.
export type Entrance = { userId: string; displayName: string | null; avatarUrl: string | null; svip: number; at: number };

// Shown to everyone joining a room or a live stream (live adds the camera rule).
export const houseRules = (live: boolean) =>
  `Welcome! Please keep things friendly and respectful: no vulgar or abusive language, no political promotion, ${
    live ? 'no nudity or sexual content on camera, ' : ''
  }and never hurt anyone's religion or beliefs. Breaking these rules can get you removed or reported.`;

const byNewest = (list: ChatMessage[]) => {
  const seen = new Set<string>();
  return list.filter((m) => !seen.has(m.messageId) && seen.add(m.messageId)).sort((a, b) => Number(b.messageId) - Number(a.messageId));
};

export function useRoom(roomId: string, me: Me, created?: { room: RoomSnapshot; zego: ZegoCreds }) {
  const [snap, setSnap] = useState<RoomSnapshot | null>(created?.room ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [media, setMedia] = useState<MediaState>('connecting');
  const [socketUp, setSocketUp] = useState(false);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [gifts, setGifts] = useState<GiftEvent[]>([]);
  const [bigWins, setBigWins] = useState<BigWin[]>([]);
  const [entrances, setEntrances] = useState<Entrance[]>([]);
  // Locked room: which prompt to show (null = no password needed); enterRef retries the join with a PIN.
  const [livePk, setLivePk] = useState<LivePk | null>(null);
  const [pkInvite, setPkInvite] = useState<LivePkInvite | null>(null);
  const [needsPassword, setNeedsPassword] = useState<null | 'PASSWORD_REQUIRED' | 'WRONG_PASSWORD'>(null);
  const enterRef = useRef<(password?: string) => Promise<void>>(async () => {});
  const [closed, setClosed] = useState<null | 'ended' | 'removed' | string>(null);
  const [pendingSeat, setPendingSeat] = useState<number | null>(null);
  const [invite, setInvite] = useState<SeatInvite | null>(null);
  const [unseenMentions, setUnseenMentions] = useState<ChatMessage[]>([]);
  // Emote playing on each person's seat right now (userId -> the chat message that carried it).
  const [emotes, setEmotes] = useState<Record<string, SeatEmote>>({});
  // Profile cards of people in the room, prefetched on join and as people arrive, so cards open instantly.
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const asked = useRef(new Set<string>());
  const participantIds = snap?.participants.map((p) => p.userId).join(',') ?? '';
  useEffect(() => {
    const missing = participantIds.split(',').filter((id) => id && !asked.current.has(id));
    for (let i = 0; i < missing.length; i += 50) {
      const ids = missing.slice(i, i + 50);
      ids.forEach((id) => asked.current.add(id));
      getCards(ids)
        .then((r) => setProfiles((p) => ({ ...p, ...Object.fromEntries(r.profiles.map((x) => [x.userId, x])) })))
        .catch(() => ids.forEach((id) => asked.current.delete(id))); // retried on the next participant change
    }
  }, [participantIds]);
  const socket = useRef<Socket | null>(null);

  // Your own "X joined" notice is skipped: the entrance effect is enough. Everyone else still sees it.
  const notMyEntry = (m: ChatMessage) => !(m.payload?.kind === 'JOIN' && m.payload.userId === me.userId);
  const addMessages = (list: ChatMessage[]) => setMessages((prev) => byNewest([...list.filter(notMyEntry), ...prev]));

  const loadHistory = useCallback(
    async (older = false) => {
      const q = older && historyCursor ? `&cursor=${historyCursor}` : '';
      if (older && !historyCursor) return;
      const r = await api<{ messages: ChatMessage[]; nextCursor: string | null }>('GET', `/rooms/${roomId}/messages?limit=30${q}`);
      addMessages(r.messages);
      // A reconnect refetches the newest page; keep the older-page cursor we already have.
      setHistoryCursor((c) => (older || c === null ? r.nextCursor : c));
    },
    [roomId, historyCursor],
  );

  useEffect(() => {
    let alive = true;
    const s = connectSocket();
    socket.current = s;

    s.on('connect', async () => {
      setSocketUp(true);
      // Full snapshot on every (re)connect: deltas alone can't resync.
      const attach = async () => {
        setSnap(await send<RoomSnapshot>(s, 'room:join', { roomId }));
        await loadHistory();
      };
      try {
        await attach();
      } catch (e) {
        // Away longer than the server's grace period (app in the background), so it let us go: join again quietly.
        // The seat is gone by now; the seat effect below stops publishing. Rooms that ended or need a PIN still close.
        if (alive && e instanceof ApiError && e.code === 'NOT_IN_ROOM') {
          try {
            await api('POST', `/rooms/${roomId}/join`);
            return await attach();
          } catch (e2) {
            return alive && setClosed(errorText(e2));
          }
        }
        alive && setClosed(errorText(e));
      }
    });
    s.on('disconnect', () => setSocketUp(false));
    s.on('room:state', (r: RoomSnapshot) => setSnap((p) => (!p || r.roomVersion >= p.roomVersion ? r : p)));
    s.on('room:seat:state', (e: { roomVersion: number; seats: Seat[] }) =>
      setSnap((p) => (p && e.roomVersion > p.roomVersion ? { ...p, seats: e.seats, roomVersion: e.roomVersion } : p)),
    );
    s.on('room:participant:joined', (e: { user: UserSummary; role: string }) => {
      if ((e.user.svip ?? 0) >= 2)
        setEntrances((q) => [...q, { userId: e.user.userId, displayName: e.user.displayName, avatarUrl: e.user.avatarUrl, svip: e.user.svip!, at: Date.now() }].slice(-5));
      setSnap((p) =>
        p && !p.participants.some((x) => x.userId === e.user.userId)
          ? { ...p, participants: [...p.participants, { ...e.user, role: e.role, presence: 'CONNECTED' }] }
          : p,
      );
    });
    s.on('room:participant:left', (e: { userId: string }) =>
      setSnap((p) => (p ? { ...p, participants: p.participants.filter((x) => x.userId !== e.userId) } : p)),
    );
    s.on('room:chat:new', (m: ChatMessage) => {
      addMessages([m]);
      // Someone tagged me: queue it until it's been on screen (see ChatList).
      if (m.mentions.includes(me.userId) && m.sender?.userId !== me.userId) setUnseenMentions((q) => [...q, m]);
      const emote = m.payload?.emote;
      const who = m.sender?.userId;
      if (emote && who) {
        setEmotes((e) => ({ ...e, [who]: { id: m.messageId, emote, result: m.payload?.result } }));
        setTimeout(() => setEmotes(({ [who]: cur, ...rest }) => (cur?.id === m.messageId ? rest : cur ? { ...rest, [who]: cur } : rest)), emoteMs(emote));
      }
    });
    s.on('room:system', (m: { messageId: string; body: string; createdAt: string }) =>
      addMessages([{ ...m, type: 'SYSTEM', mentions: [], sender: null, clientMessageId: null }]),
    );
    s.on('room:gift:received', (g: GiftEvent) => setGifts((q) => [...q, g]));
    s.on('room:charisma', (e: { roomId: string; charisma: Charisma | null }) => e.roomId === roomId && setSnap((p) => (p ? { ...p, charisma: e.charisma } : p)));
    s.on('room:pk', (e: { roomId: string; pk: Pk | null }) => e.roomId === roomId && setSnap((p) => (p ? { ...p, pk: e.pk } : p)));
    s.on('room:ludo', (e: { roomId: string; on: boolean }) => e.roomId === roomId && setSnap((p) => (p ? { ...p, ludo: e.on } : p)));
    // Big wins from any game, anywhere: shown as a banner in whatever room is open (queued, a few at most).
    s.on('game:bigwin', (w: BigWin) => setBigWins((q) => [...q, w].slice(-5)));
    s.on('room:removed', () => setClosed((c) => c ?? 'removed'));
    s.on('room:ended', (e: { roomId: string }) => e.roomId === roomId && setClosed((c) => c ?? 'ended'));
    // Live PK: the running battle (null when it ends; the result arrives as a chat notice), invites to this host.
    s.on('live:pk', (e: { pk: LivePk | null }) => setLivePk(e.pk));
    s.on('live:pk:invite', (inv: LivePkInvite) => setPkInvite(inv));
    s.on('live:pk:declined', (e: { by: string }) => toast(`${e.by} declined the PK`));
    // Private notes: these events go only to this user and become local chat items nobody else sees.
    const addLocal = (note: Pick<ChatMessage, 'type' | 'body' | 'payload' | 'sender'>) =>
      setMessages((prev) => {
        const top = Number(prev[0]?.messageId ?? 0);
        const msg: ChatMessage = {
          ...note,
          messageId: String(top + 0.001), // sorts right after the latest server message
          mentions: [],
          clientMessageId: null,
          createdAt: new Date().toISOString(),
        };
        return byNewest([msg, ...prev]);
      });
    // Level-ups and SVIP tier-ups from anywhere: a notice in whatever room is open.
    s.on('app:announce', (a: Announcement) =>
      addLocal({
        type: 'SYSTEM',
        body:
          a.kind === 'SVIP_UP' ? `${a.displayName} is now SVIP${a.tier}!`
          : a.kind === 'CP_LOVE' ? `💍 ${a.displayName} and ${a.partnerName} are now Love CP!`
          : `${a.displayName} upgraded their level to Lv ${a.level}`,
        payload: { ...a },
        sender: null,
      }),
    );
    s.on('user:followed', (e: FollowNote) =>
      addLocal({ type: 'FOLLOW', body: '', payload: { userId: e.user.userId, youFollowThem: e.youFollowThem }, sender: e.user }),
    );
    s.on('room:admin:changed', (e: { roomId: string; admin: boolean; by: string }) => {
      if (e.roomId !== roomId) return;
      addLocal({ type: 'PRIVATE', body: e.admin ? `${e.by} made you an admin of this room` : `${e.by} removed your admin role`, payload: null, sender: null });
    });
    s.on('room:seat:invite', (e: SeatInvite & { roomId: string }) => e.roomId === roomId && setInvite(e));
    s.on('room:seat:invite:declined', (e: { user: { displayName: string }; seatIndex: number }) =>
      toast(`${e.user.displayName} declined seat ${e.seatIndex + 1}`),
    );
    s.on('room:unseated', (e: { roomId: string; by: string; reason?: string }) => {
      if (e.roomId !== roomId) return;
      toast(
        e.reason === 'PK_STARTED'
          ? 'A PK battle started, so co-hosting has ended for now'
          : e.reason === 'LAYOUT_CHANGED'
            ? `${e.by} made the room smaller and there was no free seat for you`
            : `${e.by} moved you off the stage`,
      );
    });

    // Locked rooms: the server asks for the 4-digit password; the room screen shows a PIN pad and calls this again.
    const enter = async (password?: string) => {
      try {
        const joined = created ?? (await api<{ room: RoomSnapshot; zego: ZegoCreds }>('POST', `/rooms/${roomId}/join`, password ? { password } : undefined));
        if (!alive) return;
        setNeedsPassword(null);
        setSnap(joined.room);
        // House rules: the first thing in the chat for everyone who joins (shown on this device only).
        addLocal({ type: 'SYSTEM', body: houseRules(joined.room.kind === 'LIVE'), payload: { kind: 'RULES' }, sender: null });
        s.connect(); // only after the backend confirmed membership
        const isLive = joined.room.kind === 'LIVE';
        if (isLive) api<{ pk: LivePk | null }>('GET', `/lives/${roomId}/pk`).then((r) => alive && setLivePk(r.pk)).catch(() => {});
        await zego.join(
          joined.zego,
          me.displayName ?? 'guest',
          {
            onState: setMedia,
            onSoundLevels: (lv) => setLevels((p) => ({ ...p, ...lv })),
            onTokenWillExpire: async () => (await api<ZegoCreds>('POST', `/rooms/${roomId}/zego-token`)).token,
          },
          { video: isLive },
        );
        // streamId is only issued when the backend says we hold a seat (host seat 0 on create).
        if (joined.zego.streamId) await zego.startPublishing(joined.zego.streamId);
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'PASSWORD_REQUIRED' || e.code === 'WRONG_PASSWORD')) {
          if (alive) setNeedsPassword(e.code);
          return;
        }
        if (password && e instanceof ApiError && e.code === 'RATE_LIMITED') return toast('Too many tries. Wait a minute and try again.');
        console.warn('room join failed', e);
        api('POST', `/rooms/${roomId}/leave`).catch(() => {});
        alive && setClosed(e instanceof Error && !('code' in e) ? e.message : errorText(e));
      }
    };
    enterRef.current = enter;
    enter();

    return () => {
      alive = false;
      s.removeAllListeners();
      s.disconnect();
      zego.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const mySeat = snap?.seats.find((x) => x.occupant?.userId === me.userId) ?? null;
  const isHost = snap?.hostUserId === me.userId;
  const isAdmin = !!snap?.admins.includes(me.userId);
  // Mirrors the server rule: owner acts on anyone else; admins not on the owner or other admins.
  const canModerate = (targetId: string) =>
    targetId !== me.userId &&
    (isHost || (isAdmin && targetId !== snap?.hostUserId && !snap?.admins.includes(targetId)));

  // Server seat state is the authority: lost seat => stop publishing; mute flag => mute mic.
  useEffect(() => {
    if (!mySeat && zego.isPublishing()) zego.stopPublishing();
    if (mySeat && zego.isPublishing()) zego.setMicMuted(mySeat.micMuted, mySeat.modMuted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySeat?.seatIndex, mySeat?.micMuted, mySeat?.modMuted]);

  const emit = <T,>(event: string, payload: object) => send<T>(socket.current!, event, { roomId, ...payload });

  return {
    snap,
    messages,
    media,
    socketUp,
    levels,
    profiles,
    cacheProfile: (p: UserProfile) => setProfiles((m) => ({ ...m, [p.userId]: p })),
    gifts,
    closed,
    pendingSeat,
    invite,
    mySeat,
    isHost,
    isAdmin,
    isMod: isHost || isAdmin,
    canModerate,
    loadOlder: () => loadHistory(true).catch(() => {}),
    shiftGift: () => setGifts((q) => q.slice(1)),
    bigWins,
    shiftBigWin: () => setBigWins((q) => q.slice(1)),
    entrances,
    shiftEntrance: () => setEntrances((q) => q.slice(1)),
    needsPassword,
    submitPassword: (pin: string) => enterRef.current(pin),
    unseenMentions,
    markMentionsSeen: (ids: string[]) => setUnseenMentions((q) => (q.some((m) => ids.includes(m.messageId)) ? q.filter((m) => !ids.includes(m.messageId)) : q)),

    // `invited`: accepting a host invite, which can take a locked seat.
    async claimSeat(seatIndex: number, invited = false, { audioOnly = false } = {}) {
      if (!(await ensureMicPermission())) throw new Error('Microphone permission is needed to take a seat');
      setPendingSeat(seatIndex);
      try {
        const r = await emit<{ zego: ZegoCreds }>(invited ? 'room:seat:accept' : 'room:seat:claim', { seatIndex });
        try {
          if (audioOnly) await api('POST', `/rooms/${roomId}/camera`, { off: true });
          await zego.startPublishing(r.zego.streamId!, r.zego.token, { camera: !audioOnly });
        } catch (e) {
          await emit('room:seat:release', { seatIndex }).catch(() => {});
          throw e;
        }
      } finally {
        setPendingSeat(null);
      }
    },
    async releaseSeat() {
      if (!mySeat) return;
      await zego.stopPublishing();
      await emit('room:seat:release', { seatIndex: mySeat.seatIndex });
    },
    // `audioOnly`: live co-host with the mic only (camera stays off; viewers see the avatar).
    async answerInvite(accept: boolean, { audioOnly = false } = {}) {
      const inv = invite;
      setInvite(null);
      if (!inv) return;
      if (accept) return this.claimSeat(inv.seatIndex, true, { audioOnly });
      await api('POST', `/rooms/${roomId}/invite/decline`);
    },
    setLocked: (seatIndex: number, locked: boolean) => api('POST', `/rooms/${roomId}/seats/${seatIndex}/lock`, { locked }),
    inviteToSeat: (seatIndex: number, userId: string) => api('POST', `/rooms/${roomId}/seats/${seatIndex}/invite`, { userId }),
    setSeatCount: (seatCount: number) => api('POST', `/rooms/${roomId}/seat-count`, { seatCount }),
    setCharisma: (on: boolean) => api('POST', `/rooms/${roomId}/charisma`, { on }),
    setLudo: (on: boolean) => api('POST', `/rooms/${roomId}/ludo`, { on }),
    startPk: (a: string, b: string, minutes: number) => api('POST', `/rooms/${roomId}/pk`, { a, b, minutes }),
    // ---------- live streams ----------
    livePk,
    pkInvite,
    clearPkInvite: () => setPkInvite(null),
    endLive: () => api('POST', `/lives/${roomId}/end`),
    // Staff only: pin / unpin this room at the top of the room list (the snapshot refreshes on the next settings change or rejoin).
    setPinned: (pinned: boolean) => api<{ pinned: boolean }>('POST', `/rooms/${roomId}/pin`, { pinned }).then((r) => setSnap((p) => (p ? { ...p, pinned: r.pinned } : p))),
    // Your seat's camera off/on: everyone sees your avatar instead of video while it's off.
    async setCameraOff(off: boolean) {
      await api('POST', `/rooms/${roomId}/camera`, { off });
      await zego.setCameraOn(!off);
    },
    invitePk: (targetRoomId: string, minutes: number) => api<{ pkId: string }>('POST', `/lives/${roomId}/pk`, { targetRoomId, minutes }),
    acceptPk: (pkId: string) => api<{ pk: LivePk }>('POST', `/live-pks/${pkId}/accept`).then((r) => setLivePk(r.pk)),
    declinePk: (pkId: string) => api('POST', `/live-pks/${pkId}/decline`),
    cancelPk: (pkId: string) => api('DELETE', `/live-pks/${pkId}`).then(() => setLivePk(null)),
    stopPk: () => api('DELETE', `/rooms/${roomId}/pk`),
    // Room settings (owner/admins). The server pushes the new snapshot to everyone, us included.
    updateSettings: (patch: RoomSettingsPatch) => api<RoomSnapshot>('PATCH', `/rooms/${roomId}/settings`, patch),
    uploadCover(file: { uri: string; type: string; name: string }) {
      const form = new FormData();
      form.append('file', file as unknown as Blob); // React Native uploads { uri, type, name } straight from disk
      return api<RoomSnapshot>('POST', `/rooms/${roomId}/cover`, form);
    },
    setAdmin: (userId: string, admin: boolean) => api(admin ? 'POST' : 'DELETE', `/rooms/${roomId}/admins/${userId}`),
    listKicked: () => api<KickedUser[]>('GET', `/rooms/${roomId}/kicked`),
    unkick: (userId: string) => api('DELETE', `/rooms/${roomId}/kicked/${userId}`),
    setMuted: (userId: string, muted: boolean) => api('POST', `/rooms/${roomId}/participants/${userId}/mute`, { muted }),
    removeFromSeat: (userId: string) => api('POST', `/rooms/${roomId}/participants/${userId}/unseat`),
    remove: (userId: string) => api('POST', `/rooms/${roomId}/participants/${userId}/remove`),
    sendChat: (body: string, mentions: Mention[]) =>
      emit<ChatMessage>('room:chat:send', { body, mentions, clientMessageId: newId() }).then((m) => addMessages([m])),
    emotes,
    sendEmote: (emote: EmoteKey) => emit<ChatMessage>('room:emote', { emote, clientMessageId: newId() }), // plays when the broadcast comes back
    // to === 'ALL': one gift to everyone seated, charged once by the server.
    sendGift: (to: string, giftId: string, quantity: number, idempotencyKey: string) =>
      to === 'ALL'
        ? emit<{ balance: number }>('room:gift:send-all', { giftId, quantity, idempotencyKey })
        : emit<{ balance: number }>('room:gift:send', { recipientUserId: to, giftId, quantity, idempotencyKey }),
    async leave() {
      await api('POST', `/rooms/${roomId}/leave`).catch(() => {});
    },
  };
}

export type RoomState = ReturnType<typeof useRoom>;
