import { House, Images, MessageCircle, UserRound } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Gradient } from '../components/Gradient';
import { useNav, type Tab } from '../nav';
import { colors, gradients, space } from '../theme';
import { HomeScreen } from './HomeScreen';
import { MessagesScreen } from './MessagesScreen';
import { PostsScreen } from './PostsScreen';
import { UserProfileScreen } from './UserProfileScreen';

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: 'rooms', label: 'Rooms', Icon: House },
  { id: 'posts', label: 'Posts', Icon: Images },
  { id: 'messages', label: 'Messages', Icon: MessageCircle },
  { id: 'me', label: 'Profile', Icon: UserRound },
];

const BAR_H = 64;
const BUBBLE = 56; // the popped-out active tab
const LIFT = 26; // how far the bubble rises above the bar
const NOTCH_DEPTH = 38;

// Bar shape 3x the bar width with the notch in the middle; sliding it sideways moves the notch
// under the active tab without redrawing the path (the native driver can animate it).
const barPath = (w: number) => {
  const W = w * 3;
  const c = W / 2;
  const d = NOTCH_DEPTH;
  return `M0,0 L${c - 58},0 C${c - 40},0 ${c - 42},${d} ${c},${d} C${c + 42},${d} ${c + 40},0 ${c + 58},0 L${W},0 L${W},${BAR_H} L0,${BAR_H} Z`;
};

// The tab lives in the route, so coming back from a pushed screen lands on the same tab.
export function MainTabs({ tab }: { tab: Tab }) {
  const nav = useNav();
  const i = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const index = TABS.findIndex((t) => t.id === tab);
  const centerOf = (n: number) => (w / TABS.length) * (n + 0.5);

  const x = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);
  useEffect(() => {
    if (!w) return;
    if (!placed.current) {
      placed.current = true;
      return x.setValue(centerOf(index)); // first layout: no slide-in
    }
    Animated.spring(x, { toValue: centerOf(index), useNativeDriver: true, friction: 8, tension: 70 }).start();
    pop.setValue(0.6);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, w]);

  const Active = TABS[index].Icon;
  return (
    <View style={{ flex: 1 }}>
      {tab === 'rooms' ? <HomeScreen /> : tab === 'posts' ? <PostsScreen /> : tab === 'messages' ? <MessagesScreen /> : <UserProfileScreen userId={nav.me!.userId} tab />}

      <View style={[st.dock, { bottom: i.bottom + space(2) }]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist">
        {w ? (
          <>
            {/* Shadow + clip live on separate views: overflow hidden would cut the shadow off. */}
            <View style={st.shadow} />
            <View style={st.clip}>
              <Animated.View style={{ width: w * 3, height: BAR_H, transform: [{ translateX: Animated.subtract(x, w * 1.5) }] }}>
                <Svg width={w * 3} height={BAR_H}>
                  <Path d={barPath(w)} fill={colors.surface} />
                </Svg>
              </Animated.View>
            </View>
            <Animated.View
              pointerEvents="none"
              style={[st.bubbleWrap, { transform: [{ translateX: Animated.subtract(x, BUBBLE / 2) }, { scale: pop }] }]}>
              <Gradient colors={gradients.primary} style={st.bubble}>
                <Active size={24} color="#fff" strokeWidth={2.4} />
              </Gradient>
            </Animated.View>
          </>
        ) : null}

        <View style={st.row}>
          {TABS.map(({ id, label, Icon }) => {
            const on = id === tab;
            return (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={label}
                onPress={() => !on && nav.replace({ name: 'home', tab: id })}
                style={st.item}>
                {on ? (
                  <Text style={st.activeLabel}>{label}</Text>
                ) : (
                  <>
                    <Icon size={22} color={colors.muted} strokeWidth={2} />
                    <Text style={st.label}>{label}</Text>
                  </>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  dock: { position: 'absolute', left: space(4), right: space(4), height: BAR_H },
  shadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: NOTCH_DEPTH, // below the notch, or this white box would show through it
    borderRadius: 26,
    backgroundColor: colors.surface,
    elevation: 14,
    shadowColor: '#5B3FFF',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  clip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 26, overflow: 'hidden' },
  bubbleWrap: {
    position: 'absolute',
    left: 0,
    top: -LIFT,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    elevation: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  bubble: { width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2, alignItems: 'center', justifyContent: 'center' },
  row: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  activeLabel: { color: colors.primary, fontSize: 11, fontWeight: '900', position: 'absolute', bottom: 8 },
});
