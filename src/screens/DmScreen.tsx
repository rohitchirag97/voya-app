import { Handshake, ImagePlus, Send, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorText, imageUri, newId, sendDmPhoto, type Conversation, type DirectMessage, type StaffRole } from '../api';
import { pickPhoto } from './ProfileParts';
import { CP_LOOK, cpName, CpRequestCard, daysText } from '../components/Cp';
import { OfficialMark } from '../components/Official';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { connectSocket } from '../services/RoomSocket';
import { colors, radius, space } from '../theme';

const newestFirst = (list: DirectMessage[]) => {
  const seen = new Set<number>();
  return list.filter((m) => !seen.has(m.id) && seen.add(m.id)).sort((a, b) => b.id - a.id);
};

// 1:1 chat with a friend. If a room is active it keeps running as the bubble.
export function DmScreen({ userId, displayName, staffRole }: { userId: string; displayName: string | null; staffRole?: StaffRole | null }) {
  const nav = useNav();
  const me = nav.me!;
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null); // full-screen photo
  const [cp, setCp] = useState<Conversation['cp']>(null); // your CP with them, shown under the header

  const add = (list: DirectMessage[]) => setMessages((prev) => newestFirst([...list, ...(prev ?? [])]));

  const load = useCallback(
    async (older = false) => {
      if (older && !cursor) return;
      try {
        const r = await api<{ messages: DirectMessage[]; nextCursor: string | null; cp: Conversation['cp'] }>(
          'GET',
          `/dm/${userId}?limit=30${older && cursor ? `&cursor=${cursor}` : ''}`,
        );
        add(r.messages);
        setCursor(r.nextCursor);
        if (!older) setCp(r.cp ?? null);
      } catch (e) {
        toast(errorText(e));
        setMessages((m) => m ?? []);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, cursor],
  );

  useEffect(() => {
    load();
    // Live delivery while this screen is open.
    const sock = connectSocket();
    sock.on('dm:new', (m: DirectMessage) => {
      const ours = (m.senderId === userId && m.recipientId === me.userId) || (m.senderId === me.userId && m.recipientId === userId);
      if (ours) add([m]);
    });
    // A CP request answered, cancelled or expired: refresh its card.
    sock.on('cp:update', (e: { proposalId: string; status: NonNullable<DirectMessage['cp']>['status'] }) =>
      setMessages((prev) => prev && prev.map((m) => (m.cp?.id === e.proposalId ? { ...m, cp: { ...m.cp, status: e.status } } : m))),
    );
    sock.on('connect', () => load()); // catch up on anything missed while reconnecting
    sock.connect();
    return () => {
      sock.removeAllListeners();
      sock.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      add([await api<DirectMessage>('POST', `/dm/${userId}`, { body, clientMessageId: newId() })]);
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
      add([await sendDmPhoto(userId, file, newId())]);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={st.back}>‹</Text>
        </Pressable>
        <Pressable onPress={() => nav.push({ name: 'user', userId })} style={st.who} accessibilityRole="button" accessibilityLabel={`${displayName}'s profile`}>
          <Avatar id={userId} name={displayName} size={36} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={[s.body, { fontWeight: '700' }]}>{displayName}</Text>
              <OfficialMark role={staffRole} still />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Handshake size={12} color={colors.muted} />
              <Text style={[s.muted, { fontSize: 12 }]}>Friends</Text>
            </View>
          </View>
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

      {messages === null ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          inverted
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          onEndReached={() => load(true)}
          contentContainerStyle={st.list}
          ListEmptyComponent={<Text style={[s.muted, st.empty]}>Say hi to {displayName}</Text>}
          renderItem={({ item }) => {
            const mine = item.senderId === me.userId;
            if (item.cp) {
              return <CpRequestCard cp={item.cp} meId={me.userId} onChange={(cp) => setMessages((prev) => prev && prev.map((m) => (m.id === item.id ? { ...m, cp } : m)))} />;
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
      )}

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
  attach: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  photoWrap: { borderRadius: radius.md, overflow: 'hidden', padding: 3 },
  photo: { width: 220, height: 260, borderRadius: radius.md - 3 },
  photoTime: { position: 'absolute', right: 10, bottom: 8, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  viewer: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 48, right: 20, padding: 6, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
