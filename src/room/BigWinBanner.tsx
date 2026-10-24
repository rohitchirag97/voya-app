import { ChevronRight, Leaf, Orbit, Rocket } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/ui';
import { Gradient } from '../components/Gradient';
import { space } from '../theme';
import type { GameKey } from './GameSheet';

export type BigWin = { userId: string; displayName: string; avatarUrl: string | null; game: GameKey; amount: number; at: string };

// Each game has its own banner look, so no game name is needed in the text.
const THEMES: Record<GameKey, { colors: string[]; border: string; amount: string; caption: string; Icon: typeof Leaf; icon: string; sparkle: string }> = {
  jungle: { colors: ['#35a067', '#0f4a2e'], border: '#e9c47c', amount: '#ffe08a', caption: '#bff5c9', Icon: Leaf, icon: '#d9ffe1', sparkle: '#fff3b0' },
  galaxy: { colors: ['#6a55e8', '#1d1660'], border: '#c4b2ff', amount: '#ffe08a', caption: '#d9d0ff', Icon: Orbit, icon: '#efeaff', sparkle: '#cfe3ff' },
  rocket: { colors: ['#ff9a45', '#b81f3a'], border: '#ffd36b', amount: '#fff6b0', caption: '#ffe2c9', Icon: Rocket, icon: '#fff6e6', sparkle: '#fff1c2' },
};
const SPARKLES = [
  { left: '12%', top: 6, size: 4 }, { left: '34%', top: 52, size: 3 }, { left: '58%', top: 8, size: 3 },
  { left: '74%', top: 50, size: 4 }, { left: '88%', top: 14, size: 3 },
] as const;

// One big win at a time drops in from the top, shimmers, and leaves after a few seconds. Tap to open that game.
export function BigWinBanner({ win, onDone, onOpen }: { win: BigWin | undefined; onDone: () => void; onOpen: (g: GameKey) => void }) {
  const y = useRef(new Animated.Value(-140)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!win) return;
    y.setValue(-140); shine.setValue(0); pulse.setValue(0);
    const shimmer = Animated.loop(Animated.timing(shine, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    const twinkle = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]));
    shimmer.start(); twinkle.start();
    Animated.sequence([
      Animated.spring(y, { toValue: 0, friction: 6, tension: 70, useNativeDriver: true }),
      Animated.delay(4200),
      Animated.timing(y, { toValue: -140, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => { shimmer.stop(); twinkle.stop(); onDone(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [win?.at, win?.userId]);

  if (!win) return null;
  const t = THEMES[win.game] ?? THEMES.rocket;
  const amount = win.amount.toLocaleString('en-IN');
  return (
    <Animated.View style={[st.wrap, { transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <Pressable
        onPress={() => onOpen(win.game)}
        accessibilityRole="button"
        accessibilityLabel={`Big win: ${win.displayName} won ${amount} coins. Tap to play`}
        accessibilityLiveRegion="polite"
        style={[st.card, { borderColor: t.border, shadowColor: t.border }]}>
        <Gradient colors={t.colors} style={StyleSheet.absoluteFill} />
        {/* A soft light sweeping across, and a few twinkles. */}
        <Animated.View
          pointerEvents="none"
          style={[st.shine, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { rotate: '18deg' }] }]}
        />
        {SPARKLES.map((s, i) => (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={[st.sparkle, { left: s.left, top: s.top, width: s.size, height: s.size, backgroundColor: t.sparkle, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.9, 0.2] : [0.2, 0.9] }) }]}
          />
        ))}
        <View style={st.emblem}>
          <t.Icon size={22} color={t.icon} strokeWidth={2.2} />
        </View>
        <View style={st.text}>
          <Text style={[st.caption, { color: t.caption }]}>BIG WIN</Text>
          <Text style={st.line} numberOfLines={1}>
            <Text style={st.name}>{win.displayName}</Text> won <Text style={[st.amount, { color: t.amount }]}>{amount}</Text> coins
          </Text>
        </View>
        <Avatar id={win.userId} name={win.displayName} uri={win.avatarUrl} size={34} ring={t.border} />
        <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', top: space(16), left: space(3), right: space(3), zIndex: 50 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), paddingHorizontal: space(3),
    borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', elevation: 12, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
  },
  shine: { position: 'absolute', top: -30, bottom: -30, width: 60, backgroundColor: 'rgba(255,255,255,0.18)' },
  sparkle: { position: 'absolute', borderRadius: 4 },
  emblem: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  text: { flex: 1, minWidth: 0 },
  caption: { fontSize: 10.5, fontWeight: '900', letterSpacing: 1.6 },
  line: { color: '#fff', fontSize: 15, fontWeight: '600', marginTop: 1 },
  name: { fontWeight: '900' },
  amount: { fontWeight: '900', fontSize: 17 },
});
