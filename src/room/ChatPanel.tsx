import { Armchair, AtSign, Check, ChevronDown, ChevronRight, Coins, Crown, Dices, Gift, Heart, LayoutGrid, Mail, MessageSquareText, Mic, MicOff, Send, ShieldCheck, Smile, Sparkles, Star, UserPlus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, type ListViewToken, View } from 'react-native';
import { errorText, setFollowing, type ChatMessage, type Participant } from '../api';
import { FramedAvatar } from '../components/Decor';
import { OfficialMark } from '../components/Official';
import { SVIP_COLORS, SvipBadge } from '../components/Svip';
import { Gradient } from '../components/Gradient';
import { SvgXml } from 'react-native-svg';
import { LevelBadge } from '../components/Level';
import { useCatalog } from './catalog';
import { Avatar, IconButton, toast } from '../components/ui';
import { roomColors as colors, gradients, radius, space } from '../theme';
import { EMOTES } from './Emotes';
import { useUnreadDms } from '../services/AppEvents';
import type { GameKey } from './GameSheet';
import type { Mention } from './useRoom';

const TRAILING_MENTION = /@([^\s@]*)$/;

// Names can hold spaces and symbols, so split on the exact verified @names (longest first) rather than a character class.
const mentionSplitter = (names: string[]) =>
  new RegExp(`(${names.sort((a, b) => b.length - a.length).map((n) => '@' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'u');

// userId -> display name of everyone seen in rooms this app session (never shrinks; names are short strings).
const knownNames = new Map<string, string>();

type Roles = { hostUserId: string; admins: string[] };

export function ChatList({ messages, participants, meId, onEndReached, onUserPress, onOpenGame, onEmote, unseenMentions, onMentionsSeen, roles }: {
  messages: ChatMessage[];
  participants: Participant[];
  meId: string;
  onEndReached: () => void;
  onUserPress: (userId: string) => void;
  onOpenGame: (g: GameKey) => void; // a game-win notice's Play button
  onEmote: () => void; // tapping an emote in chat opens the emote picker
  unseenMentions: ChatMessage[];
  onMentionsSeen: (ids: string[]) => void;
  roles: Roles;
}) {
  // Everyone seen in a room stays known, so an @mention stays tappable (and opens their card) after they leave or go
  // offline. A copy per change, so the bubbles re-render when a new name arrives.
  const names = useMemo(() => {
    for (const p of participants) if (p.displayName) knownNames.set(p.userId, p.displayName);
    for (const m of messages) if (m.sender?.displayName) knownNames.set(m.sender.userId, m.sender.displayName);
    return new Map(knownNames);
  }, [participants, messages]);
  const list = useRef<FlatList<ChatMessage>>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // A mention counts as seen once its message is on screen, whether it arrived there or you scrolled to it.
  const seen = useRef(onMentionsSeen);
  seen.current = onMentionsSeen;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) =>
    seen.current(viewableItems.map((v) => (v.item as ChatMessage).messageId)),
  ).current;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2000);
    return () => clearTimeout(t);
  }, [flash]);

  function jumpTo(m: ChatMessage) {
    const index = messages.findIndex((x) => x.messageId === m.messageId);
    onMentionsSeen([m.messageId]);
    if (index < 0) return;
    setFlash(m.messageId);
    list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
  }

  const next = unseenMentions[0];
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={list}
        inverted
        data={messages}
        keyExtractor={(m) => m.messageId}
        onEndReached={onEndReached}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        // Variable-height rows: jump near the target first, then land on it once it's measured.
        onScrollToIndexFailed={(info) => {
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, viewPosition: 0.5, animated: true }), 150);
        }}
        contentContainerStyle={{ paddingHorizontal: space(3), paddingVertical: space(2), gap: space(2) }}
        renderItem={({ item }) => (
          <View style={item.messageId === flash ? st.flash : undefined}>
            <Bubble m={item} meId={meId} names={names} onUserPress={onUserPress} onOpenGame={onOpenGame} onEmote={onEmote} roles={roles} />
          </View>
        )}
      />
      {next ? (
        <Pressable
          onPress={() => jumpTo(next)}
          accessibilityRole="button"
          accessibilityLabel={`${next.sender?.displayName} mentioned you. Go to message`}
          style={({ pressed }) => [st.mentionPill, pressed && { opacity: 0.85 }]}>
          <Gradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
          <AtSign size={16} color="#fff" strokeWidth={2.6} />
          <Text style={st.mentionText} numberOfLines={1}>
            {next.sender?.displayName} mentioned you
            {unseenMentions.length > 1 ? ` · +${unseenMentions.length - 1}` : ''}
          </Text>
          <ChevronDown size={16} color="#fff" strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Role colours for names: gold owner, violet admin, soft blue for everyone else.
const nameColor = (id: string, roles: Roles) => (id === roles.hostUserId ? colors.gold : roles.admins.includes(id) ? '#B79CFF' : '#8FD3FF');

function RoleBadge({ id, roles }: { id: string; roles: Roles }) {
  if (roles.admins.includes(id)) return <Text style={[st.role, { backgroundColor: 'rgba(139,92,246,0.25)', color: '#C9B6FF' }]}>ADMIN</Text>;
  return null;
}

// "[Name] won [amount] coins in [Game]" with a Play button that opens that game.
function GameWinPill({ m, onUserPress, onOpenGame }: { m: ChatMessage; onUserPress: (userId: string) => void; onOpenGame: (g: GameKey) => void }) {
  const { userId, game } = m.payload ?? {};
  return (
    <View style={st.winRow}>
      <Pressable onPress={() => userId && onUserPress(userId)} accessibilityRole="button" accessibilityHint="Opens their profile" style={st.win}>
        <Coins size={13} color={colors.gold} strokeWidth={2.4} />
        <Text style={st.winText}>{m.body}</Text>
      </Pressable>
      {game ? (
        <Pressable onPress={() => onOpenGame(game)} accessibilityRole="button" accessibilityLabel="Play this game" hitSlop={8} style={st.play}>
          <Text style={st.playText}>Play</Text>
          <ChevronRight size={13} color="#2a1d05" strokeWidth={3} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Notices get an icon and colour by kind so the chat reads at a glance.
// House rules card, first in the chat when you join.
function RulesCard({ body }: { body: string }) {
  return (
    <View style={st.rules} accessibilityLabel={`Room rules. ${body}`}>
      <View style={st.rulesHead}>
        <ShieldCheck size={15} color="#7FE3B0" strokeWidth={2.6} />
        <Text style={st.rulesTitle}>Keep it friendly</Text>
      </View>
      <Text style={st.rule}>{body}</Text>
    </View>
  );
}

function SystemPill({ m, onUserPress }: { m: ChatMessage; onUserPress: (userId: string) => void }) {
  const kind = (m.payload as { kind?: string } | null)?.kind ?? '';
  if (kind === 'RULES') return <RulesCard body={m.body} />;
  const gift = kind.startsWith('GIFT') || kind.startsWith('PK'); // gifts and PK notices share the gold style
  const join = kind === 'JOIN';
  const seat = kind.startsWith('SEAT') || kind === 'UNSEATED';
  const love = kind === 'CP_LOVE';
  const tint = gift ? colors.gold : join ? colors.success : love ? '#FF4F8B' : colors.muted;
  const Icon = gift ? Gift : join ? Sparkles : seat ? Armchair : love ? Heart : Sparkles;
  const who = m.payload?.userId;
  const p = m.payload as { svip?: number; tier?: number } | null;
  // SVIP2+ entrances and SVIP tier-ups (from any room): a banner in the tier's colours instead of the grey pill.
  const svip = join ? Number(p?.svip ?? 0) : kind === 'SVIP_UP' ? Number(p?.tier ?? 0) : 0;
  const body =
    kind === 'LEVEL_UP' ? (
      <View style={[st.system, st.systemGift]}>
        <Star size={12} color={colors.gold} fill={colors.gold} strokeWidth={2.4} />
        <Text style={[st.systemText, { color: colors.gold }]}>{m.body}</Text>
      </View>
    ) : svip >= (join ? 2 : 1) ? (
      <Gradient colors={SVIP_COLORS[svip] ?? SVIP_COLORS[7]} style={st.svipEntry}>
        <Crown size={14} color="#FFE38A" fill="#FFE38A" strokeWidth={2} />
        <Text style={st.svipEntryText}>{m.body}</Text>
      </Gradient>
    ) : (
      <View style={[st.system, gift && st.systemGift]}>
        <Icon size={12} color={tint} strokeWidth={2.4} />
        <Text style={[st.systemText, { color: gift ? colors.gold : love ? '#FF8AB4' : 'rgba(255,255,255,0.75)' }]}>{m.body}</Text>
      </View>
    );
  return who ? (
    <Pressable onPress={() => onUserPress(who)} accessibilityRole="button" accessibilityHint="Opens their profile" style={{ alignSelf: 'flex-start' }}>
      {body}
    </Pressable>
  ) : (
    <View style={{ alignSelf: 'flex-start' }}>{body}</View>
  );
}

function Bubble({ m, meId, names, onUserPress, onOpenGame, onEmote, roles }: {
  m: ChatMessage;
  meId: string;
  names: Map<string, string>;
  onUserPress: (userId: string) => void;
  onOpenGame: (g: GameKey) => void;
  onEmote: () => void;
  roles: Roles;
}) {
  const catalog = useCatalog();
  if (m.type === 'FOLLOW') return <FollowItem m={m} onUserPress={onUserPress} />;
  if (m.type === 'PRIVATE') {
    return (
      <View style={st.privateNote} accessibilityLabel={`${m.body}. Only you can see this.`}>
        <Text style={st.msg}>{m.body}</Text>
        <Text style={st.private}>Only you can see this</Text>
      </View>
    );
  }
  if (m.type === 'SYSTEM' && m.payload?.kind === 'GAME_WIN') return <GameWinPill m={m} onUserPress={onUserPress} onOpenGame={onOpenGame} />;
  if (m.type === 'SYSTEM') return <SystemPill m={m} onUserPress={onUserPress} />;

  // Verified mentions only: handle -> userId, so a tapped @name opens that person's card.
  // The message carries each mentioned person's name (so it works after they've left); older ones fall back to who we've seen.
  const handles = new Map(m.mentions.map((id) => [m.mentionNames?.[id] ?? names.get(id), id] as const).filter(([h]) => !!h));
  const mentionsMe = m.mentions.includes(meId);
  const sender = m.sender!;
  const bubble = sender.bubbleId ? catalog.bubbles[sender.bubbleId] : undefined;
  const frame = sender.frameId ? catalog.frames[sender.frameId]?.svg : undefined;
  const big = isEmojiOnly(m.body);
  const emote = EMOTES.find((e) => e.key === m.payload?.emote); // an animated emote: tap to pick one to send back
  return (
    <BubbleFrame bubble={bubble} mentionsMe={mentionsMe}>
      {/* Identity line: framed avatar, marks and badges, then the name. */}
      <View style={st.nameRow}>
        <Pressable onPress={() => onUserPress(sender.userId)} accessibilityRole="button" accessibilityLabel={`${sender.displayName}'s profile`} hitSlop={6}>
          <FramedAvatar id={sender.userId} name={sender.displayName} uri={sender.avatarUrl} size={26} frameSvg={frame} />
        </Pressable>
        <OfficialMark role={sender.staffRole} />
        <RoleBadge id={sender.userId} roles={roles} />
        <SvipBadge tier={sender.svip} />
        <LevelBadge level={sender.level ?? 0} />
        {(sender.badges ?? []).map((id) =>
          catalog.badges[id] ? <SvgXml key={id} xml={catalog.badges[id].svg} width={18} height={18} accessibilityLabel={catalog.badges[id].name} /> : null,
        )}
        <Text style={[st.sender, { color: nameColor(sender.userId, roles) }]} onPress={() => onUserPress(sender.userId)} numberOfLines={1}>
          {sender.displayName}
        </Text>
      </View>
      <Text
        style={[st.msg, big && st.bigEmoji, bubble?.style && { color: bubble.style.text }]}
        onPress={emote ? onEmote : undefined}
        accessibilityRole={emote ? 'button' : undefined}
        accessibilityHint={emote ? 'Opens emotes' : undefined}
        suppressHighlighting={false}>
        {(handles.size ? m.body.split(mentionSplitter([...handles.keys()] as string[])) : [m.body]).map((part, i) =>
          handles.has(part.slice(1)) ? (
            <Text
              key={i}
              style={st.tag}
              onPress={() => onUserPress(handles.get(part.slice(1))!)}
              accessibilityRole="button"
              accessibilityLabel={`${part.slice(1)}'s profile`}>
              {part}
            </Text>
          ) : (
            part
          ),
        )}
      </Text>
    </BubbleFrame>
  );
}

// Only emoji (up to 6), no letters: shown large, like a sticker.
const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u;
const isEmojiOnly = (s: string) => EMOJI_ONLY.test(s) && !/[0-9#*]/.test(s) && [...s.replace(/\s/g, '')].filter((c) => /\p{Extended_Pictographic}/u.test(c)).length <= 6;

// The message card: default glass, or the sender's equipped bubble (gradient + border + corner ornament).
function BubbleFrame({ bubble, mentionsMe, children }: { bubble?: { svg: string; style?: { gradient: string[]; border: string } | null }; mentionsMe: boolean; children: React.ReactNode }) {
  if (!bubble?.style) return <View style={[st.card, mentionsMe && st.cardMe]}>{children}</View>;
  return (
    <View style={st.customWrap}>
      <Gradient colors={bubble.style.gradient} style={[st.card, st.custom, { borderColor: mentionsMe ? colors.primary : bubble.style.border }]}>
        {children}
      </Gradient>
      <View style={st.ornament} pointerEvents="none">
        <SvgXml xml={bubble.svg} width={44} height={26} />
      </View>
    </View>
  );
}

// Private "X started following you" card, with a one-tap follow back. Stays in the chat.
function FollowItem({ m, onUserPress }: { m: ChatMessage; onUserPress: (userId: string) => void }) {
  const who = m.sender!;
  const [followed, setFollowed] = useState(!!m.payload?.youFollowThem);
  const [busy, setBusy] = useState(false);
  const mutual = !!m.payload?.youFollowThem;

  async function followBack() {
    setBusy(true);
    try {
      await setFollowing(who.userId, true);
      setFollowed(true);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={st.follow} accessibilityLabel={`${who.displayName} ${mutual ? 'followed you back' : 'started following you'}. Only you can see this.`}>
      <Pressable onPress={() => onUserPress(who.userId)} accessibilityRole="button" hitSlop={6}>
        <Avatar id={who.userId} name={who.displayName} uri={who.avatarUrl} size={38} ring={colors.accent} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={st.msg}>
          <Text style={st.followName} onPress={() => onUserPress(who.userId)}>
            {who.displayName}
          </Text>
          {mutual ? ' followed you back. You are friends now!' : ' started following you'}
        </Text>
        <Text style={st.private}>Only you can see this</Text>
      </View>
      {mutual ? null : followed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Check size={14} color={colors.success} strokeWidth={3} />
          <Text style={st.followed}>Following</Text>
        </View>
      ) : (
        <Pressable onPress={followBack} disabled={busy} accessibilityRole="button" style={[st.followBtn, busy && { opacity: 0.6 }]}>
          <Gradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
          <UserPlus size={14} color="#fff" strokeWidth={2.6} />
          <Text style={st.followBtnText}>{busy ? '…' : 'Follow back'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// Bottom bar. Left: chat (opens the text box), emotes, messages, mic, more. Right: games and the gift button.
export function Composer({ participants, meId, onSend, onGift, onMore, onGames, onMessages, onEmotes, micMuted, onToggleMic, tag, minimal }: {
  participants: Participant[];
  meId: string;
  onSend: (body: string, mentions: Mention[]) => Promise<void>;
  onGift: () => void;
  onMore: () => void; // the room's More sheet: games, seats, …
  onGames: () => void;
  onMessages: () => void; // direct messages inbox (the room keeps running)
  onEmotes: () => void; // the animated emote picker
  micMuted: boolean | null; // null = not on a seat, so no mic button
  onToggleMic: () => void;
  tag: { userId: string; handle: string; n: number } | null; // from a profile card: insert @handle
  minimal?: boolean; // live host: only chat and mic (no messages, more, games or gift)
}) {
  const unreadDms = useUnreadDms();
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [typing, setTyping] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  // Tag from a profile card: append "@handle ", register it as a real mention, open the keyboard.
  useEffect(() => {
    if (!tag) return;
    setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}@${tag.handle} `);
    setMentions((m) => (m.some((x) => x.userId === tag.userId) ? m : [...m, { userId: tag.userId, handle: tag.handle }]));
    setTyping(true);
  }, [tag]);
  useEffect(() => {
    if (typing) setTimeout(() => input.current?.focus(), 50);
  }, [typing, tag]);
  const [sending, setSending] = useState(false);

  const query = TRAILING_MENTION.exec(text)?.[1];
  const suggestions =
    query === undefined
      ? []
      : participants
          .filter((p) => p.userId !== meId && p.displayName?.toLowerCase().startsWith(query.toLowerCase()))
          .slice(0, 5);

  function pick(p: Participant) {
    setText((t) => t.replace(TRAILING_MENTION, `@${p.displayName} `));
    setMentions((m) => (m.some((x) => x.userId === p.userId) ? m : [...m, { userId: p.userId, handle: p.displayName! }]));
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      // Picked tags, plus anyone whose @name was typed out by hand (people here now, or seen earlier), so every tag
      // in the message is tappable for everyone.
      const typed = [...participants.map((p) => [p.userId, p.displayName ?? ''] as const), ...knownNames.entries()]
        .filter(([id, name]) => name && id !== meId && body.includes(`@${name}`))
        .map(([userId, handle]) => ({ userId, handle }));
      const all = [...mentions, ...typed].filter((m, i, list) => body.includes(`@${m.handle}`) && list.findIndex((x) => x.userId === m.userId) === i);
      await onSend(body, all);
      setText('');
      setMentions([]);
      setTyping(false); // back to the bottom bar
      Keyboard.dismiss();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <View>
      {suggestions.length ? (
        <View style={st.suggest} accessibilityLabel="Mention suggestions">
          {suggestions.map((p) => (
            <Pressable key={p.userId} accessibilityRole="button" onPress={() => pick(p)} style={st.suggestRow}>
              <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={28} />
              <Text style={st.suggestName}>{p.displayName}</Text>
              <Text style={st.suggestRole}>{p.role === 'AUDIENCE' ? 'listener' : p.role.toLowerCase()}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {typing ? (
        <View style={st.bar}>
          <View style={st.inputWrap}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder="Say hi… type @ to tag"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={st.input}
              maxLength={500}
              onSubmitEditing={send}
              returnKeyType="send"
              editable={!sending}
              accessibilityLabel="Message"
            />
            {/* Emotes live in the text field's right corner: the field closes back to the bottom bar and the picker opens. */}
            <Pressable
              onPress={() => {
                setTyping(false);
                Keyboard.dismiss();
                onEmotes();
              }}
              accessibilityRole="button"
              accessibilityLabel="Emotes"
              hitSlop={8}
              style={st.send}>
              <Smile size={20} color={colors.gold} strokeWidth={2.3} />
            </Pressable>
            {text.trim() ? (
              <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="Send" hitSlop={8} style={st.send}>
                <Send size={18} color={colors.primary} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>
          <IconButton label="Close keyboard" onPress={() => setTyping(false)} size={44}>
            <X size={20} color={colors.text} strokeWidth={2.4} />
          </IconButton>
        </View>
      ) : (
        <View style={st.bar}>
          <IconButton label="Chat" onPress={() => setTyping(true)} size={44}>
            <MessageSquareText size={20} color={colors.text} strokeWidth={2.3} />
          </IconButton>
          {minimal ? null : (
            <View>
              <IconButton label={unreadDms ? `Messages, ${unreadDms} unread` : 'Messages'} onPress={onMessages} size={44}>
                <Mail size={20} color={colors.text} strokeWidth={2.3} />
              </IconButton>
              {unreadDms ? (
                <View style={st.unread} pointerEvents="none">
                  <Text style={st.unreadText}>{unreadDms > 99 ? '99+' : unreadDms}</Text>
                </View>
              ) : null}
            </View>
          )}
          {micMuted !== null ? (
            <IconButton label={micMuted ? 'Unmute' : 'Mute'} onPress={onToggleMic} size={44} style={micMuted ? st.micOff : st.micOn}>
              {micMuted ? <MicOff size={20} color="#FF8A95" strokeWidth={2.4} /> : <Mic size={20} color={colors.success} strokeWidth={2.4} />}
            </IconButton>
          ) : null}
          {minimal ? null : (
            <>
              <IconButton label="More: games and room options" onPress={onMore} size={44}>
                <LayoutGrid size={20} color={colors.text} strokeWidth={2.3} />
              </IconButton>
              <View style={{ flex: 1 }} />
              <IconButton label="Games" onPress={onGames} size={44} style={st.games}>
                <Dices size={21} color="#fff" strokeWidth={2.2} />
              </IconButton>
              <Pressable onPress={onGift} accessibilityRole="button" accessibilityLabel="Send gift" style={({ pressed }) => [st.giftBtn, pressed && { transform: [{ scale: 0.94 }] }]}>
                <Gradient colors={['#FFE38A', '#F5A623']} style={StyleSheet.absoluteFill} />
                <Gift size={24} color="#7A3E00" strokeWidth={2.3} />
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  // A fixed one-line box, clipped: decorated names (stacked accent marks, symbols from other fonts) can measure shorter
  // than they draw on Android, which used to push the name down over the message.
  sender: { flexShrink: 1, maxWidth: '100%', fontSize: 13, fontWeight: '800', lineHeight: 18, height: 18, includeFontPadding: false, overflow: 'hidden' },
  role: { fontSize: 9, fontWeight: '900', letterSpacing: 0.6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  // Message card: identity line on top, text below; fits its content up to nearly full width.
  card: {
    alignSelf: 'flex-start',
    maxWidth: '94%',
    gap: 6,
    backgroundColor: 'rgba(10,6,24,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
  },
  cardMe: { borderColor: colors.primary, backgroundColor: 'rgba(255,61,139,0.18)' },
  customWrap: { alignSelf: 'flex-start', maxWidth: '94%', paddingBottom: 8, paddingRight: 8 },
  custom: { maxWidth: '100%', borderWidth: 1.5, backgroundColor: 'transparent' },
  ornament: { position: 'absolute', bottom: -4, right: -6 },
  msg: { color: colors.text, fontSize: 15, lineHeight: 21 },
  bigEmoji: { fontSize: 38, lineHeight: 46 },
  unread: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger, borderWidth: 1.5, borderColor: colors.bg },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  tag: { color: '#FF8AB8', fontWeight: '800' },
  svipEntry: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,227,138,0.6)' },
  svipEntryText: { color: '#fff', fontSize: 13, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 3 },
  rules: { alignSelf: 'flex-start', maxWidth: '94%', gap: 3, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md, backgroundColor: 'rgba(16,185,129,0.14)', borderWidth: 1, borderColor: 'rgba(127,227,176,0.4)' },
  rulesHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  rulesTitle: { color: '#7FE3B0', fontSize: 13, fontWeight: '900' },
  rule: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19 },
  system: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  systemGift: { backgroundColor: 'rgba(255,201,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,201,77,0.25)' },
  systemText: { fontSize: 12, fontWeight: '600' },
  winRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', maxWidth: '100%' },
  win: {
    flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,201,77,0.14)', borderWidth: 1, borderColor: 'rgba(255,201,77,0.35)',
  },
  winText: { flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: colors.gold },
  play: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 10, paddingRight: 7, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.gold },
  playText: { fontSize: 12, fontWeight: '900', color: '#2a1d05' },
  follow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    borderRadius: radius.md,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.55)',
  },
  followName: { color: colors.text, fontWeight: '800' },
  flash: { borderRadius: radius.md, backgroundColor: 'rgba(255,61,139,0.3)' },
  mentionPill: {
    position: 'absolute',
    bottom: space(2),
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    maxWidth: '85%',
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    overflow: 'hidden',
    elevation: 8,
  },
  mentionText: { color: '#fff', fontWeight: '800' },
  privateNote: { alignSelf: 'flex-start', padding: space(2), paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: 'rgba(139,92,246,0.18)' },
  private: { color: colors.muted, fontSize: 11, marginTop: 2 },
  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space(3), paddingVertical: space(2), overflow: 'hidden' },
  followBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  followed: { color: colors.muted, fontWeight: '700' },
  suggest: {
    marginHorizontal: space(3),
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingVertical: space(1),
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(2) },
  suggestName: { color: colors.text, fontWeight: '700', flex: 1 },
  suggestRole: { color: colors.muted, fontSize: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2) },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,6,24,0.6)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingLeft: space(4),
    paddingRight: space(2),
  },
  input: { flex: 1, color: colors.text, fontSize: 15, height: 44 },
  send: { padding: 6 },
  micOn: { backgroundColor: 'rgba(52,224,161,0.14)', borderColor: 'rgba(52,224,161,0.45)' },
  micOff: { backgroundColor: 'rgba(255,77,94,0.16)', borderColor: 'rgba(255,77,94,0.5)' },
  games: { backgroundColor: 'rgba(139,92,246,0.45)', borderColor: 'rgba(196,178,255,0.6)' },
  giftBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#FFF1B8', elevation: 6 },
});
