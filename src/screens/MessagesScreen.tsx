import { MessageCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorText, getCards, getPresence, presenceText, timeAgo, type Conversation, type Presence, type UserSummary } from '../api';
import { getChats, subscribeDms, syncPending } from '../services/DmStore';
import { CpChip } from '../components/Cp';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { LevelBadge } from '../components/Level';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

// Inbox: every person you've messaged with, latest conversation first.
export function MessagesScreen() {
  const nav = useNav();
  const me = nav.me!;
  // Chats are saved on this phone; the list follows that copy (the app-wide listener saves new messages).
  const toList = (cps: Map<string, Conversation['cp']>): Conversation[] =>
    getChats().map((c) => ({ user: c.peer as UserSummary, lastMessage: c.last, unread: c.unread, cp: cps.get(c.peer.userId) ?? null }));
  const [cps, setCps] = useState<Map<string, Conversation['cp']>>(new Map());
  const [list, setList] = useState<Conversation[] | null>(() => toList(new Map()));
  const [loading, setLoading] = useState(false);

  // Your CPs, for the chips next to names.
  const loadCps = useCallback(
    () =>
      getCards([me.userId])
        .then(({ profiles }) => {
          const map = new Map<string, Conversation['cp']>((profiles[0]?.relationships ?? []).map((r) => [r.user.userId, { type: r.type, label: r.label, since: r.since, level: r.level }]));
          setCps(map);
          setList(toList(map));
        })
        .catch(() => {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me.userId],
  );
  const load = useCallback(async () => {
    setLoading(true);
    try {
      await syncPending(null); // anything waiting on the server
    } catch (e) {
      toast(errorText(e));
    } finally {
      setList(toList(cps));
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cps]);

  useEffect(() => {
    loadCps();
    return subscribeDms(() => setList(toList(cpsRef.current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cpsRef = React.useRef(cps);
  cpsRef.current = cps;

  // Who's online / last seen, for everyone in the list; refreshed every 30s.
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const peerKey = (list ?? []).map((c) => c.user.userId).join(',');
  useEffect(() => {
    if (!peerKey) return;
    const load = () =>
      getPresence(peerKey.split(','))
        .then((r) => setPresence(Object.fromEntries(r.presence.map((p) => [p.userId, p]))))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [peerKey]);

  return (
    <Screen backdrop bottom={false}>
      <View style={st.head}>
        <Text style={s.h1}>Messages</Text>
      </View>
      <FlatList
        data={list ?? []}
        keyExtractor={(c) => c.user.userId}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          list === null ? undefined : (
            <View style={st.empty}>
              <View style={st.emptyIcon}>
                <MessageCircle size={30} color={colors.primary} />
              </View>
              <Text style={s.h2}>No messages yet</Text>
              <Text style={[s.muted, { textAlign: 'center' }]}>Follow each other to become friends, then tap Message on their profile.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const m = item.lastMessage;
          const mine = m.senderId === me.userId;
          return (
            <Pressable
              onPress={() => nav.push({ name: 'dm', userId: item.user.userId, displayName: item.user.displayName, staffRole: item.user.staffRole })}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${item.user.displayName}. ${mine ? 'You' : item.user.displayName}: ${m.body}`}
              style={({ pressed }) => [st.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
              <View>
                <Avatar id={item.user.userId} name={item.user.displayName} uri={item.user.avatarUrl} size={52} />
                {presence[item.user.userId]?.online ? <View style={st.onDot} /> : null}
              </View>
              <View style={st.mid}>
                <View style={st.nameRow}>
                  <Text style={st.name} numberOfLines={1}>
                    {item.user.displayName}
                  </Text>
                  <OfficialMark role={item.user.staffRole} />
                  <SvipBadge tier={item.user.svip} />
                  {item.user.level ? <LevelBadge level={item.user.level} /> : null}
                  {item.cp ? <CpChip type={item.cp.type} level={item.cp.level.level} since={item.cp.since} /> : null}
                </View>
                <Text style={st.preview} numberOfLines={1}>
                  {mine ? 'You: ' : ''}
                  {m.body}
                </Text>
                {presenceText(presence[item.user.userId]) ? (
                  <Text style={[st.status, presence[item.user.userId]?.online && st.statusOn]}>{presenceText(presence[item.user.userId])}</Text>
                ) : null}
              </View>
              <View style={st.side}>
                <Text style={st.time}>{timeAgo(m.createdAt)}</Text>
                {item.unread ? (
                  <View style={st.unread}>
                    <Text style={st.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { paddingHorizontal: space(4), paddingVertical: space(3) },
  list: { paddingHorizontal: space(3), paddingBottom: 140, gap: space(1) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.surface },
  mid: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  preview: { color: colors.muted, fontSize: 14 },
  status: { color: colors.muted, fontSize: 11.5 },
  statusOn: { color: '#16A34A', fontWeight: '700' },
  onDot: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: colors.surface },
  time: { color: colors.muted, fontSize: 12 },
  side: { alignSelf: 'stretch', alignItems: 'flex-end', gap: 6, paddingTop: 4 },
  unread: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF3B5C' },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), paddingHorizontal: space(8) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
});
