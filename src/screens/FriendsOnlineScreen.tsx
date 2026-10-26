import { ChevronLeft, DoorOpen, Lock, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DOCK_BOTTOM, FloatingBubble } from '../components/FloatingBubble';
import { getFollowingActive, type FriendActivity } from '../api';
import { Avatar, Screen, s } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

const POLL_MS = 30_000;

// People you follow who are in a room right now, one row each (someone in a room is listed once).
function flatten(items: FriendActivity[]) {
  const seen = new Set<string>();
  return items.flatMap(({ room, friends }) =>
    friends.filter((f) => !seen.has(f.userId) && seen.add(f.userId)).map((friend) => ({ friend, room })),
  );
}

function useFriendsInRooms() {
  const [items, setItems] = useState<FriendActivity[] | null>(null);
  const load = useCallback(() => getFollowingActive().then((r) => setItems(r.items), () => setItems((x) => x ?? [])), []);
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);
  // rows: one per person (the pill's count); items: grouped by room (the screen).
  return { rows: useMemo(() => flatten(items ?? []), [items]), items: items ?? [], loading: items === null, load };
}

// Home: a draggable pill with how many people you follow are in rooms now (starts 15% up from the bottom; drag it
// anywhere and it snaps to the nearest side). Tap for the full list.
const PILL_H = 42;
const GAP = 12;
// Bottoms of the room bubble (56 high at DOCK_BOTTOM) and the game bubble (60 high, 16 above it); the pill goes above both.
const pillAbove = (room: boolean, game: boolean) => (game ? DOCK_BOTTOM + 56 + 16 + 60 + GAP : room ? DOCK_BOTTOM + 56 + GAP : 0);
export function FriendsOnlinePill() {
  const nav = useNav();
  const { height } = useWindowDimensions();
  const { rows } = useFriendsInRooms();
  if (!rows.length) return null;
  const faces = Math.min(3, rows.length);
  const w = 26 + (faces - 1) * 16 + 58; // faces + count + padding
  return (
    // Everything floats on the right edge, stacked bottom-up: the minimized room, the minimized game, then this pill
    // (15% up when it's alone, else just above whichever bubbles are showing).
    <FloatingBubble id="friends-online" size={PILL_H} w={w} bottom={Math.max(Math.round(height * 0.15), pillAbove(!!nav.activeRoom, !!nav.game?.minimized))}>
      <Pressable
        onPress={() => nav.push({ name: 'friendsOnline' })}
        accessibilityRole="button"
        accessibilityLabel={`${rows.length} ${rows.length === 1 ? 'friend is' : 'friends are'} in rooms now. Open the list`}
        style={st.pill}>
        <View style={st.faces}>
          {rows.slice(0, faces).map(({ friend }, i) => (
            <View key={friend.userId} style={[st.face, i > 0 && st.faceOverlap]}>
              <Avatar id={friend.userId} name={friend.displayName} uri={friend.avatarUrl} size={26} />
            </View>
          ))}
        </View>
        <View style={st.pillText}>
          <Text style={st.pillCount}>{rows.length}</Text>
          <Text style={st.pillLabel}>online</Text>
        </View>
        <View style={st.liveDot} />
      </Pressable>
    </FloatingBubble>
  );
}

// Everyone you follow who's in a room right now, with the room and a Join button.
export function FriendsOnlineScreen() {
  const nav = useNav();
  const { rows, items, loading, load } = useFriendsInRooms();
  const [refreshing, setRefreshing] = useState(false);

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <View style={st.grow}>
          <Text style={st.title}>Friends online</Text>
          <Text style={s.muted}>{loading ? ' ' : `${rows.length} in ${items.length} ${items.length === 1 ? 'room' : 'rooms'} right now`}</Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={st.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.room.roomId}
          contentContainerStyle={st.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <Users size={30} color={colors.primary} />
              <Text style={s.h2}>Nobody's in a room right now</Text>
              <Text style={[s.muted, st.center]}>When people you follow join a room or go live, they show up here.</Text>
            </View>
          }
          // One card per room: the room, a Join button, and everyone you follow who's in it.
          renderItem={({ item: { room, friends } }) => {
            const live = room.kind === 'LIVE';
            return (
              <View style={st.card}>
                <View style={st.cardHead}>
                  <View style={st.grow}>
                    <View style={st.roomLine}>
                      <View style={[st.tag, live ? st.tagLive : st.tagRoom]}>
                        <Text style={st.tagText}>{live ? 'LIVE' : 'ROOM'}</Text>
                      </View>
                      {room.privacy === 'LOCKED' ? <Lock size={12} color={colors.muted} /> : null}
                      <Text style={st.cardTitle} numberOfLines={1}>
                        {room.title}
                      </Text>
                    </View>
                    <Text style={st.cardSub}>
                      {friends.length} {friends.length === 1 ? 'friend' : 'friends'} here · {room.listenerCount} in the room
                    </Text>
                  </View>
                  <Pressable onPress={() => nav.openRoom(room.roomId)} accessibilityRole="button" accessibilityLabel={`Join ${room.title}`} style={st.join}>
                    <DoorOpen size={15} color="#fff" strokeWidth={2.6} />
                    <Text style={st.joinText}>Join</Text>
                  </Pressable>
                </View>
                <View style={st.people}>
                  {friends.map((f) => (
                    <Pressable
                      key={f.userId}
                      onPress={() => nav.push({ name: 'user', userId: f.userId })}
                      accessibilityRole="button"
                      accessibilityLabel={`${f.displayName}'s profile`}
                      style={st.person}>
                      <View>
                        <Avatar id={f.userId} name={f.displayName} uri={f.avatarUrl} size={46} />
                        <View style={st.onDot} />
                      </View>
                      <Text style={st.personName} numberOfLines={1}>
                        {f.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  faces: { flexDirection: 'row' },
  face: { borderRadius: 15, borderWidth: 2, borderColor: colors.surface },
  faceOverlap: { marginLeft: -10 },
  pillText: { alignItems: 'center' },
  pillCount: { color: colors.text, fontSize: 15, fontWeight: '900', lineHeight: 17 },
  pillLabel: { color: colors.success, fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  liveDot: { position: 'absolute', top: 4, left: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success, borderWidth: 1.5, borderColor: colors.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  loading: { marginTop: space(10) },
  list: { paddingHorizontal: space(3), paddingBottom: space(10), gap: space(2) },
  card: { gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.surface },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  cardTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 3 },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  person: { width: 64, alignItems: 'center', gap: 4 },
  personName: { color: colors.text, fontSize: 11, fontWeight: '600', maxWidth: 64 },
  onDot: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.surface },
  roomLine: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  tag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  tagLive: { backgroundColor: '#FF3B5C' },
  tagRoom: { backgroundColor: colors.accent },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  join: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.primary },
  joinText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), paddingHorizontal: space(8) },
  center: { textAlign: 'center' },
});
