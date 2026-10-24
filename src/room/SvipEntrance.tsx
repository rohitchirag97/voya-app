import { Crown, Gem } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gradient } from '../components/Gradient';
import { SVIP_COLORS } from '../components/Svip';
import { Avatar } from '../components/ui';
import { space } from '../theme';
import type { Entrance } from './useRoom';

// SVIP2+ entrance: a tier-coloured ribbon sweeps in from the left with a shine, holds, then flies off right.
// Higher tiers stay longer and get a crown and more sparkle.
export function SvipEntrance({ entry, onDone }: { entry: Entrance | undefined; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const x = useRef(new Animated.Value(-width)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!entry) return;
    x.setValue(-width); shine.setValue(0); glow.setValue(0);
    const hold = 1600 + entry.svip * 250;
    const sparkle = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]));
    sparkle.start();
    Animated.sequence([
      Animated.spring(x, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(shine, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(hold),
      Animated.timing(x, { toValue: width, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => { sparkle.stop(); onDone(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.at, entry?.userId]);

  if (!entry) return null;
  const colors = SVIP_COLORS[entry.svip] ?? SVIP_COLORS[7];
  const gold = entry.svip === 7 ? '#FFD86B' : '#fff';
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.wrap, { transform: [{ translateX: x }] }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`SVIP ${entry.svip} ${entry.displayName} entered the room`}>
      <View style={[st.card, { borderColor: entry.svip >= 5 ? '#FFD86B' : 'rgba(255,255,255,0.6)' }]}>
        <Gradient colors={[colors[1], colors[0], colors[1]]} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[st.shine, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-80, width] }) }, { rotate: '20deg' }] }]}
        />
        <View>
          <Avatar id={entry.userId} name={entry.displayName} uri={entry.avatarUrl} size={44} ring={gold} />
          {entry.svip >= 5 ? (
            <View style={st.crown}>
              <Crown size={18} color="#FFD86B" fill="#FFD86B" strokeWidth={1.8} />
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.tierRow}>
            <Gem size={13} color={gold} strokeWidth={2.6} />
            <Text style={[st.tier, { color: gold }]}>SVIP{entry.svip}</Text>
          </View>
          <Text style={st.name} numberOfLines={1}>
            {entry.displayName} <Text style={st.entered}>entered the room</Text>
          </Text>
        </View>
        {Array.from({ length: Math.min(entry.svip, 6) }, (_, i) => (
          <Animated.Text
            key={i}
            style={[st.spark, { left: `${12 + i * 15}%`, top: i % 2 ? 4 : 50, opacity: glow.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [1, 0.2] : [0.2, 1] }) }]}>
            ✦
          </Animated.Text>
        ))}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: space(3), right: space(3), top: '32%', zIndex: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    borderRadius: 999,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  shine: { position: 'absolute', top: -20, bottom: -20, width: 50, backgroundColor: 'rgba(255,255,255,0.28)' },
  crown: { position: 'absolute', top: -13, left: 13 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tier: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  name: { color: '#fff', fontSize: 16, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },
  entered: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  spark: { position: 'absolute', color: '#FFF3B0', fontSize: 12 },
});
