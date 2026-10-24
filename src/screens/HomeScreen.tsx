import {
  BadgeCheck,
  ChevronRight,
  Lock,
  Pin,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { api, errorText, type RoomCard } from '../api';
import { Gradient } from '../components/Gradient';
import { LevelBadge } from '../components/Level';
import { Avatar, IconButton, Screen, toast } from '../components/ui';
import { tickColor } from '../components/Official';
import { useNav } from '../nav';
import { FriendsTab } from './FriendsTab';
import { LiveTab } from './LiveTab';
import { colors, gradients, radius, space, tintPairFor } from '../theme';

const TABS = ['Friends', 'Live', 'Rooms'] as const;
const TAB_W = 84;
const ROOMS_TAB = 2; // opens on Rooms
// Same list as Create room; null = All.
const CATEGORIES = [null, 'Casual', 'Music', 'Talk', 'Games', 'Study'];

export function HomeScreen() {
  const nav = useNav();
  const { width } = useWindowDimensions();
  const pager = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollX = useRef(new Animated.Value(width * ROOMS_TAB)).current;
  const [tab, setTab] = useState(ROOMS_TAB);
  const me = nav.me!;

  const goTo = (i: number) => {
    setTab(i);
    pager.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <Screen backdrop bottom={false}>
      <View style={st.top}>
        <View style={st.header}>
          <Pressable
            onPress={() => nav.replace({ name: 'home', tab: 'me' })}
            accessibilityRole="button"
            accessibilityHint="Opens your profile, where you can edit it or log out"
            style={st.me}
          >
            <Avatar
              id={me.userId}
              name={me.displayName}
              uri={me.avatarUrl}
              size={44}
              ring={colors.glassBorder}
            />
            <View>
              <Text style={st.hey}>Welcome back</Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={st.myName}>{me.displayName}</Text>
                {me.level ? <LevelBadge level={me.level.level} /> : null}
              </View>
            </View>
          </Pressable>
          <View style={st.headRight}>
            <IconButton
              label="Search by ID"
              onPress={() => nav.push({ name: 'search' })}
            >
              <Search size={19} color={colors.text} strokeWidth={2.4} />
            </IconButton>
          </View>
        </View>

        {/* Tab labels with a pink underline that follows the swipe. */}
        <View style={st.tabs} accessibilityRole="tablist">
          {TABS.map((t, i) => (
            <Pressable
              key={t}
              onPress={() => goTo(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === i }}
              style={st.tab}
            >
              <Text style={[st.tabText, tab === i && st.tabTextOn]}>{t}</Text>
            </Pressable>
          ))}
          <Animated.View
            style={[
              st.underline,
              {
                transform: [
                  {
                    translateX: scrollX.interpolate({
                      inputRange: [0, width * (TABS.length - 1)],
                      outputRange: [0, TAB_W * (TABS.length - 1)],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            <Gradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>

      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: width * ROOMS_TAB, y: 0 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={e =>
          setTab(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        <FriendsTab width={width} />
        <LiveTab width={width} />
        <RoomsTab width={width} />
      </Animated.ScrollView>
    </Screen>
  );
}

// Home "Rooms" tab: your room, category chips, then pinned and ranked party rooms.
function RoomsTab({ width }: { width: number }) {
  const nav = useNav();
  const [rooms, setRooms] = useState<RoomCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  // undefined = not loaded yet, null = no room yet.
  const [myRoom, setMyRoom] = useState<RoomCard | null | undefined>(undefined);

  const load = useCallback(
    async (more = false) => {
      if (more && !cursor) return;
      if (!more) setLoading(true);
      try {
        const q =
          (more && cursor ? `&cursor=${cursor}` : '') +
          (category ? `&category=${encodeURIComponent(category)}` : '');
        const r = await api<{ rooms: RoomCard[]; nextCursor: string | null }>(
          'GET',
          `/rooms?limit=20${q}`,
        );
        setRooms(prev => (more ? [...prev, ...r.rooms] : r.rooms));
        setCursor(r.nextCursor);
        if (!more) {
          setMyRoom(
            (await api<{ room: RoomCard | null }>('GET', '/me/room')).room,
          );
        }
      } catch (e) {
        toast(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [cursor, category],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [category]);

  const header = (
    <View style={{ gap: space(4), paddingBottom: space(1) }}>
      {/* Your permanent room: open it, or create it the first time. Placeholder until we know which. */}
      {myRoom === undefined ? (
        <View style={[st.mine, st.minePending]} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            myRoom ? `Open your room, ${myRoom.title}` : 'Create your room'
          }
          onPress={() =>
            myRoom ? nav.openRoom(myRoom.roomId) : nav.push({ name: 'create' })
          }
          style={({ pressed }) => [
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <Gradient colors={gradients.primary} style={st.mine}>
            <View style={st.mineIcon}>
              {myRoom ? (
                <Sparkles size={22} color="#fff" />
              ) : (
                <Plus size={24} color="#fff" strokeWidth={2.6} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.mineLabel}>
                {myRoom ? 'YOUR ROOM' : 'START PARTYING'}
              </Text>
              <Text style={st.mineTitle} numberOfLines={1}>
                {myRoom ? myRoom.title : 'Create your room'}
              </Text>
            </View>
            <ChevronRight size={24} color="#fff" strokeWidth={2.6} />
          </Gradient>
        </Pressable>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.chips}
      >
        {CATEGORIES.map(c => (
          <Pressable
            key={c ?? 'all'}
            onPress={() => setCategory(c)}
            accessibilityRole="radio"
            accessibilityState={{ selected: category === c }}
            style={[st.chip, category === c && st.chipOn]}
          >
            <Text style={[st.chipText, category === c && st.chipTextOn]}>
              {c ?? 'All'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={{ width }}
      data={rooms}
      keyExtractor={r => r.roomId}
      ListHeaderComponent={header}
      contentContainerStyle={{
        padding: space(4),
        paddingBottom: 140,
        gap: space(3),
      }}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => load()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
      onEndReached={() => load(true)}
      ListEmptyComponent={
        loading ? undefined : (
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <Sparkles size={30} color={colors.muted} />
            </View>
            <Text style={st.emptyTitle}>
              {category ? `No ${category} rooms right now` : "It's quiet right now"}
            </Text>
            <Text style={st.emptySub}>
              Create your room and invite your friends.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => (
        <RoomTile room={item} onPress={() => nav.openRoom(item.roomId)} />
      )}
    />
  );
}

// Three bars bouncing like an audio meter, for rooms with people talking.
function Equalizer() {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, {
            toValue: 1,
            duration: 300 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(b, {
            toValue: 0,
            duration: 300 + i * 90,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [bars]);
  return (
    <View style={st.eq}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={[
            st.eqBar,
            {
              transform: [
                {
                  scaleY: b.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const SEAT_DOTS = 5;

// One room per row: cover on the left, then title, host and the seats (who's on mic, open seats as empty rings).
function RoomTile({ room, onPress }: { room: RoomCard; onPress: () => void }) {
  const live = room.listenerCount > 0;
  const stage = room.stage ?? [];
  const free = room.seatsFree ?? 0;
  const empties = Math.max(0, Math.min(free, SEAT_DOTS - stage.length));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.title}, hosted by ${room.host.displayName}, ${room.listenerCount} inside, ${stage.length} on mic, ${free ? `${free} seats free` : 'seats full'}`}
      onPress={onPress}
      style={({ pressed }) => [
        st.card,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Gradient colors={tintPairFor(room.roomId)} style={st.cover}>
        <Text style={st.coverLetter}>{room.title.slice(0, 1).toUpperCase()}</Text>
        <View style={[st.badge, live ? st.badgeLive : st.badgeOpen]}>
          {live ? <Equalizer /> : <View style={st.openDot} />}
          <Text style={st.badgeText}>{live ? 'LIVE' : 'OPEN'}</Text>
        </View>
      </Gradient>

      <View style={st.body}>
        <View style={st.titleRow}>
          {/* Staff rooms get their host's tick (gold for the owner), pinned or not; the official room always has one. */}
          {room.official || room.host.staffRole ? (
            <BadgeCheck size={16} color="#fff" fill={tickColor(room.host.staffRole)} strokeWidth={2.4} accessibilityLabel="Official room" />
          ) : room.pinned ? (
            <Pin size={14} color={colors.primary} fill={colors.primary} strokeWidth={2.4} accessibilityLabel="Pinned room" />
          ) : null}
          {room.privacy === 'LOCKED' ? <Lock size={13} color={colors.muted} strokeWidth={2.8} accessibilityLabel="Locked room" /> : null}
          <Text style={st.cardTitle} numberOfLines={1}>
            {room.title}
          </Text>
        </View>
        <View style={st.hostRow}>
          <Avatar id={room.host.userId} name={room.host.displayName} uri={room.host.avatarUrl} size={18} />
          <Text style={st.hostName} numberOfLines={1}>
            {room.host.displayName}
          </Text>
          {room.category ? <Text style={st.cat}>{room.category}</Text> : null}
        </View>
        <View style={st.seats}>
          {stage.map((p, i) => (
            <View key={p.userId} style={[st.dot, i > 0 && st.dotOverlap]}>
              <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={26} ring={colors.surface} />
            </View>
          ))}
          {Array.from({ length: empties }, (_, i) => (
            <View key={`e${i}`} style={[st.emptySeat, (stage.length || i) > 0 && st.seatGap]}>
              <Plus size={11} color={colors.muted} strokeWidth={2.8} />
            </View>
          ))}
          <Text style={[st.seatText, !free && st.seatsFull, !stage.length && !empties && { marginLeft: 0 }]}>
            {free ? `${free} seat${free > 1 ? 's' : ''} free` : 'Seats full'}
          </Text>
        </View>
      </View>

      <View style={st.count}>
        <Users size={12} color={colors.muted} strokeWidth={2.6} />
        <Text style={st.countText}>{room.listenerCount}</Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { paddingHorizontal: space(4), paddingTop: space(4), gap: space(3) },
  tabs: { flexDirection: 'row' },
  tab: { width: TAB_W, paddingVertical: space(2), alignItems: 'center' },
  tabText: { color: colors.muted, fontSize: 16, fontWeight: '800' },
  tabTextOn: { color: colors.text, fontSize: 18, fontWeight: '900' },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: (TAB_W - 28) / 2,
    width: 28,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  chips: { gap: space(2) },
  chip: {
    paddingHorizontal: space(4),
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    flexShrink: 1,
  },
  headRight: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  hey: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  myName: { color: colors.text, fontSize: 18, fontWeight: '800' },
  minePending: { height: 76, backgroundColor: colors.surfaceHigh },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(4),
    borderRadius: radius.lg,
  },
  mineIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mineLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  mineTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space(2),
  },
  section: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sectionSub: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(2),
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cover: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: 5,
  },
  coverLetter: {
    position: 'absolute',
    right: 6,
    top: -6,
    fontSize: 64,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.3)',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeLive: { backgroundColor: 'rgba(255,61,94,0.9)' },
  badgeOpen: { backgroundColor: 'rgba(0,0,0,0.4)' },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  eq: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 10 },
  eqBar: { width: 2.5, height: 10, borderRadius: 1, backgroundColor: '#fff' },
  body: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '900', flexShrink: 1 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hostName: { color: colors.muted, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  cat: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255,61,139,0.12)',
    overflow: 'hidden',
  },
  seats: { flexDirection: 'row', alignItems: 'center' },
  dot: { borderRadius: 13 },
  dotOverlap: { marginLeft: -6 },
  seatGap: { marginLeft: 4 },
  seatsFull: { color: colors.muted },
  emptySeat: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.muted,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatText: { color: colors.primary, fontSize: 12, fontWeight: '800', marginLeft: space(2) },
  count: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: space(1),
    paddingRight: space(1),
  },
  countText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(12) },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  emptySub: { color: colors.muted, fontSize: 14 },
});
