import { DoorOpen, Flag, Handshake, ImagePlus, Send, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorText, getCards, getPresence, imageUri, newId, presenceText, sendDmPhoto, type Conversation, type CpProposal, type DirectMessage, type Presence, type StaffRole } from '../api';
import { showDialog } from '../components/Dialog';
import { setOpenChat } from '../services/AppEvents';
import { getChat, markChatRead, saveSent, subscribeDms, updateCpCards, type Peer } from '../services/DmStore';
import { pickPhoto } from './ProfileParts';
import { CP_LOOK, cpName, CpRequestCard, daysText } from '../components/Cp';
import { OfficialMark } from '../components/Official';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'inappropriate', label: 'Nudity or sexual content' },
  { value: 'other', label: 'Something else' },
];

// 1:1 chat. Messages come from this phone (chats aren't kept on the server); the app-wide listener saves new ones as
// they arrive, and this screen follows the saved copy. If a room is active it keeps running as the bubble.
export function DmScreen({ userId, displayName, staffRole }: { userId: string; displayName: string | null; staffRole?: StaffRole | null }) {
  const nav = useNav();
  const me = nav.me!;
  const [messages, setMessages] = useState<DirectMessage[]>(() => [...getChat(userId)].reverse()); // newest first
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null); // full-screen photo
  const [cp, setCp] = useState<Conversation['cp']>(null); // your CP with them, shown under the header
  const [peer, setPeer] = useState<Peer>({ userId, displayName, avatarUrl: null });
  const [presence, setPresence] = useState<Presence | undefined>();
  useEffect(() => {
    const load = () => getPresence([userId]).then((r) => setPresence(r.presence[0]), () => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    setOpenChat(userId); // new messages here are read as they arrive
    const refresh = () => setMessages([...getChat(userId)].reverse());
    refresh();
    markChatRead(userId);
    const off = subscribeDms(() => {
      refresh();
      markChatRead(userId);
    });
    // Their current picture/name for the header and inbox, and our CP (if any) for the strip under it.
    getCards([userId, me.userId])
      .then(({ profiles }) => {
        const them = profiles.find((x) => x.userId === userId);
        if (them) {
          const info = { userId, displayName: them.displayName, avatarUrl: them.avatarUrl, staffRole: them.staffRole, svip: them.svip };
          setPeer(info);
          markChatRead(userId, info);
        }
        const r = profiles.find((x) => x.userId === me.userId)?.relationships.find((x) => x.user.userId === userId);
        setCp(r ? { type: r.type, label: r.label, since: r.since, level: r.level } : null);
      })
      .catch(() => {});
    // CP request cards saved here may have been answered since: refresh their status.
    const cardIds = getChat(userId).flatMap((m) => (m.cp ? [m.cp.id] : []));
    if (cardIds.length) api<{ cards: CpProposal[] }>('POST', '/cp/cards', { ids: cardIds.slice(-100) }).then((r) => updateCpCards(userId, r.cards), () => {});
    return () => {
      setOpenChat(null);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      saveSent(await api<DirectMessage>('POST', `/dm/${userId}`, { body, clientMessageId: newId() }), peer);
      setText('');
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  }

  // Photos are resized on the phone first (long side 1600px), like post photos.
  async function sendPhoto() {
    const file = await pickPhoto(1600);
    if (!file) return;
    setSending(true);
    try {
      saveSent(await sendDmPhoto(userId, file, newId()), peer);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  }

  // Report them. The server doesn't keep chats, so the last messages from this phone go with the report (only
  // reported messages are kept, for moderators).
  async function report() {
    const reason = await showDialog({
      title: `Report ${peer.displayName ?? 'this person'}?`,
      message: 'Your recent messages with them are sent with the report so our team can review it.',
      Icon: Flag,
      tone: 'danger',
      actions: [...REPORT_REASONS.map((r) => ({ label: r.label, value: r.value, kind: 'primary' as const })), { label: 'Cancel', value: 'cancel', kind: 'cancel' as const }],
    });
    if (!reason || reason === 'cancel') return;
    const evidence = getChat(userId)
      .slice(-30)
      .map((m) => ({ senderId: m.senderId, body: m.body, imageUrl: m.imageUrl ?? null, createdAt: m.createdAt }));
    try {
      await api('POST', '/reports', { targetType: 'USER', targetId: userId, reason, evidence });
      toast('Thanks, our team will review it');
    } catch (e) {
      toast(errorText(e));
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={st.back}>‹</Text>
        </Pressable>
        <Pressable onPress={() => nav.push({ name: 'user', userId })} style={st.who} accessibilityRole="button" accessibilityLabel={`${displayName}'s profile`}>
          <Avatar id={userId} name={peer.displayName ?? displayName} uri={peer.avatarUrl} size={36} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[s.body, { fontWeight: '700' }]}>{displayName}</Text>
              <OfficialMark role={staffRole} still />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {presence?.online ? <View style={st.onDot} /> : <Handshake size={12} color={colors.muted} />}
              <Text style={[s.muted, { fontSize: 12 }, presence?.online && st.onText]}>{presenceText(presence) ?? 'Friends'}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={report} accessibilityRole="button" accessibilityLabel={`Report ${peer.displayName ?? 'this person'}`} hitSlop={10} style={st.report}>
          <Flag size={18} color={colors.muted} />
        </Pressable>
      </View>

      {/* CP partners: their bond, level and progress right under the header. */}
      {cp ? (
        <Pressable onPress={() => nav.push({ name: 'cp', userId: me.userId })} accessibilityRole="button" accessibilityHint="Opens your CP" style={[st.cp, { borderColor: CP_LOOK[cp.type].tint + '66', backgroundColor: CP_LOOK[cp.type].tint + '18' }]}>
          <Text style={st.cpEmoji}>{CP_LOOK[cp.type].emoji}</Text>
          <View style={st.cpMid}>
            <Text style={[st.cpTitle, { color: CP_LOOK[cp.type].tint }]}>
              {cpName(cp.type, cp.label)} · Lv.{cp.level.level}
            </Text>
            <View style={st.cpTrack}>
              <View
                style={[
                  st.cpFill,
                  { backgroundColor: CP_LOOK[cp.type].tint, width: `${cp.level.next === null ? 100 : Math.max(3, ((cp.level.points - cp.level.current) / (cp.level.next - cp.level.current)) * 100)}%` },
                ]}
              />
            </View>
          </View>
          <Text style={st.cpDays}>{daysText(cp.since)}</Text>
        </Pressable>
      ) : null}

      {
        <FlatList
          inverted
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={st.list}
          ListEmptyComponent={<Text style={[s.muted, st.empty]}>Say hi to {displayName}</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === me.userId;
            if (item.cp) {
              return <CpRequestCard cp={item.cp} meId={me.userId} onChange={(card) => updateCpCards(userId, [card])} />;
            }
            if (item.roomId) {
              const roomId = item.roomId;
              return (
                <View style={[st.bubble, mine ? st.mine : st.theirs, st.inviteCard]}>
                  <Text style={[st.text, !mine && { color: colors.text }]}>{item.body}</Text>
                  {mine ? null : (
                    <Pressable onPress={() => nav.openRoom(roomId)} accessibilityRole="button" accessibilityLabel="Join the room" style={st.joinBtn}>
                      <DoorOpen size={15} color="#fff" strokeWidth={2.6} />
                      <Text style={st.joinText}>Join room</Text>
                    </Pressable>
                  )}
                </View>
              );
            }
            if (item.imageUrl) {
              const uri = imageUri(item.imageUrl);
              return (
                <Pressable onPress={() => setViewing(uri)} accessibilityRole="imagebutton" accessibilityLabel={mine ? 'Your photo. Open' : `Photo from ${displayName}. Open`} style={[st.photoWrap, mine ? st.mine : st.theirs]}>
                  <Image source={{ uri }} style={st.photo} resizeMode="cover" />
                  <Text style={[st.time, st.photoTime]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </Pressable>
              );
            }
            return (
              <View style={[st.bubble, mine ? st.mine : st.theirs]}>
                <Text style={[st.text, !mine && { color: colors.text }]}>{item.body}</Text>
                <Text style={[st.time, !mine && { color: colors.muted }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            );
          }}
        />
      }

      <View style={st.bar}>
        <Pressable onPress={sendPhoto} disabled={sending} accessibilityRole="button" accessibilityLabel="Send a photo" hitSlop={6} style={[st.attach, sending && { opacity: 0.5 }]}>
          {sending ? <ActivityIndicator color={colors.primary} /> : <ImagePlus size={22} color={colors.primary} strokeWidth={2.2} />}
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Message ${displayName ?? ''}`}
          placeholderTextColor={colors.muted}
          style={st.input}
          maxLength={1000}
          multiline
          accessibilityLabel="Message"
        />
        <Pressable
          onPress={send}
          disabled={sending || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[st.send, (sending || !text.trim()) && { opacity: 0.5 }]}>
          <Send size={19} color="#fff" strokeWidth={2.4} />
        </Pressable>
      </View>
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)} statusBarTranslucent>
        <View style={st.viewer}>
          {viewing ? <Image source={{ uri: viewing }} style={st.viewerImage} resizeMode="contain" /> : null}
          <Pressable onPress={() => setViewing(null)} accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={12} style={st.viewerClose}>
            <X size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  onDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  onText: { color: '#22C55E', fontWeight: '700' },
  report: { marginLeft: 'auto', padding: space(1) },
  back: { color: colors.text, fontSize: 34, lineHeight: 36, width: 24 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  list: { padding: space(4), gap: space(2) },
  empty: { textAlign: 'center', marginTop: space(10), transform: [{ scale: -1 }] }, // undo the inverted list's flip (both axes on Android)
  bubble: { maxWidth: '80%', borderRadius: radius.md, paddingHorizontal: space(3), paddingVertical: space(2) },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  text: { color: '#fff', fontSize: 15 },
  time: { color: '#ffffffaa', fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2), padding: space(3) },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    fontSize: 15,
  },
  cp: { flexDirection: 'row', alignItems: 'center', gap: space(3), marginHorizontal: space(4), marginBottom: space(2), paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.md, borderWidth: 1 },
  cpEmoji: { fontSize: 22 },
  cpMid: { flex: 1, gap: 4 },
  cpTitle: { fontSize: 13, fontWeight: '900' },
  cpTrack: { height: 5, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  cpFill: { height: '100%', borderRadius: 3 },
  cpDays: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  inviteCard: { gap: space(2) },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: radius.pill, backgroundColor: colors.primary },
  joinText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  attach: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  photoWrap: { borderRadius: radius.md, overflow: 'hidden', padding: 3 },
  photo: { width: 220, height: 260, borderRadius: radius.md - 3 },
  photoTime: { position: 'absolute', right: 10, bottom: 8, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 48, right: 20, padding: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
