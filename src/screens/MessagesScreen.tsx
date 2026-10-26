import { MessageCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { errorText, listConversations, timeAgo, type Conversation } from '../api';
import { CpChip } from '../components/Cp';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { LevelBadge } from '../components/Level';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { connectSocket } from '../services/RoomSocket';
import { colors, radius, space } from '../theme';

// Inbox: every person you've messaged with, latest conversation first.
export function MessagesScreen() {
  const nav = useNav();
  const me = nav.me!;
  const [list, setList] = useState<Conversation[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList((await listConversations()).conversations);
    } catch (e) {
      toast(errorText(e));
      setList((l) => l ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // A new message anywhere moves that conversation to the top.
    const sock = connectSocket();
    sock.on('dm:new', () => load());
    sock.connect();
    return () => {
      sock.removeAllListeners();
      sock.disconnect();
    };
  }, [load]);

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
              <Avatar id={item.user.userId} name={item.user.displayName} uri={item.user.avatarUrl} size={52} />
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
              </View>
              <Text style={st.time}>{timeAgo(m.createdAt)}</Text>
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
  time: { color: colors.muted, fontSize: 12, alignSelf: 'flex-start', marginTop: 4 },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), paddingHorizontal: space(8) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
});
