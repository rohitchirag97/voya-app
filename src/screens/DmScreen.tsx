import { Handshake, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorText, newId, type DirectMessage, type StaffRole } from '../api';
import { CpRequestCard } from '../components/Cp';
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

  const add = (list: DirectMessage[]) => setMessages((prev) => newestFirst([...list, ...(prev ?? [])]));

  const load = useCallback(
    async (older = false) => {
      if (older && !cursor) return;
      try {
        const r = await api<{ messages: DirectMessage[]; nextCursor: string | null }>(
          'GET',
          `/dm/${userId}?limit=30${older && cursor ? `&cursor=${cursor}` : ''}`,
        );
        add(r.messages);
        setCursor(r.nextCursor);
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
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
