import { ChevronRight, Mic, UserPlus, Video } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { getFollowingActive, type FriendActivity } from '../api';
import { Gradient } from '../components/Gradient';
import { Avatar } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space, tintPairFor } from '../theme';

// "Riya is live", "Riya and 2 others are in Late night chai".
function headline({ room, friends }: FriendActivity) {
  const who = friends[0].displayName ?? 'Someone';
  const many = friends.length > 1 ? `${who} and ${friends.length - 1} other${friends.length > 2 ? 's' : ''}` : who;
  if (room.kind === 'LIVE' && friends.some((f) => f.userId === room.host.userId)) return `${room.host.displayName} is live`;
  return `${many} ${friends.length > 1 ? 'are' : 'is'} ${room.kind === 'LIVE' ? 'watching a live' : 'in a room'}`;
}

// Home "Friends" tab: rooms and live streams where people you follow are right now.
export function FriendsTab({ width }: { width: number }) {
  const nav = useNav();
  const [items, setItems] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setItems((await getFollowingActive()).items);
    } catch {
      // keep the last list; the next poll retries
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <FlatList
      style={{ width }}
      data={items}
      keyExtractor={(i) => i.room.roomId}
      contentContainerStyle={st.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />}
      ListEmptyComponent={
        loading ? undefined : (
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <UserPlus size={28} color={colors.muted} />
            </View>
            <Text style={st.emptyTitle}>No friends around yet</Text>
            <Text style={st.emptySub}>When people you follow join a room or go live, they show up here.</Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const live = item.room.kind === 'LIVE';
        return (
          <Pressable
            onPress={() => nav.openRoom(item.room.roomId)}
            accessibilityRole="button"
            accessibilityLabel={`${headline(item)}: ${item.room.title}`}
            style={({ pressed }) => [st.card, pressed && { opacity: 0.9 }]}>
            <Gradient colors={tintPairFor(item.room.roomId)} style={st.thumb}>
              {live ? <Video size={22} color="#fff" strokeWidth={2.4} /> : <Mic size={22} color="#fff" strokeWidth={2.4} />}
            </Gradient>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.head} numberOfLines={1}>
                {headline(item)}
              </Text>
              <Text style={st.title} numberOfLines={1}>
                {live ? '● LIVE · ' : ''}
                {item.room.title}
              </Text>
              <View style={st.faces}>
                {item.friends.slice(0, 5).map((f, i) => (
                  <View key={f.userId} style={{ marginLeft: i ? -8 : 0 }}>
                    <Avatar id={f.userId} name={f.displayName} uri={f.avatarUrl} size={24} ring={colors.surface} />
                  </View>
                ))}
                <Text style={st.count}>{item.room.listenerCount} inside</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </Pressable>
        );
      }}
    />
  );
}

const st = StyleSheet.create({
  list: { padding: space(4), paddingBottom: 140, gap: space(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  thumb: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  head: { color: colors.text, fontSize: 15, fontWeight: '900' },
  title: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  faces: { flexDirection: 'row', alignItems: 'center' },
  count: { color: colors.muted, fontSize: 12, fontWeight: '700', marginLeft: space(2) },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(12), paddingHorizontal: space(6) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.muted, fontSize: 14, textAlign: 'center' },
});
