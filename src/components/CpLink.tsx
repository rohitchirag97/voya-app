import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CpLabel, CpType } from '../api';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Neon colours per relationship: three threads each, glowing.
const NEON: Record<CpType, [string, string, string]> = {
  LOVE: ['#FF2E88', '#FF7AC2', '#B14BFF'],
  BESTIE: ['#FFB800', '#FFE36B', '#FF7A1A'],
  SIBLING: ['#22D3EE', '#7DD3FC', '#3B82F6'],
};
const EMOJI = (type: CpType, label: CpLabel | null) => (type === 'LOVE' ? '💗' : type === 'BESTIE' ? '🤝' : label === 'SISTER' ? '👭' : '👬');
export const cpTag = (type: CpType, label: CpLabel | null, short = false) =>
  type === 'LOVE' ? 'Lover' : type === 'BESTIE' ? (short ? 'Bestie' : 'Best Friend') : label === 'SISTER' ? 'Sister' : 'Brother';

// Animated neon threads between two people, with the relationship badge in the middle. Fills its box horizontally;
// the threads run along the vertical centre.
export function CpLink({ width, height, type, label, short }: { width: number; height: number; type: CpType; label: CpLabel | null; short?: boolean }) {
  const flow = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Dashes travel along the threads (JS-driven: SVG props can't use the native driver); the glow pulses natively.
    const a = Animated.loop(Animated.timing(flow, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: false }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [flow, glow]);

  const mid = height / 2;
  const bow = Math.min(height * 0.32, 9);
  // Two arcs and a gentle S between them: reads as several strands twisted together.
  const threads = [
    `M0 ${mid} Q ${width / 2} ${mid - bow} ${width} ${mid}`,
    `M0 ${mid} Q ${width / 2} ${mid + bow} ${width} ${mid}`,
    `M0 ${mid} C ${width / 3} ${mid - bow * 0.7} ${(2 * width) / 3} ${mid + bow * 0.7} ${width} ${mid}`,
  ];
  const colors = NEON[type];
  const dash = (i: number) => flow.interpolate({ inputRange: [0, 1], outputRange: i === 1 ? [0, 14] : [14, 0] });
  const badge = Math.min(24, Math.max(18, height * 0.42));

  return (
    <View style={{ width, height }} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.8] }) }]}>
        <Svg width={width} height={height}>
          {threads.map((d, i) => (
            <Path key={i} d={d} stroke={colors[i]} strokeWidth={5} strokeLinecap="round" fill="none" opacity={0.45} />
          ))}
        </Svg>
      </Animated.View>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        {threads.map((d, i) => (
          <AnimatedPath key={i} d={d} stroke={colors[i]} strokeWidth={1.6} strokeLinecap="round" fill="none" strokeDasharray="9 5" strokeDashoffset={dash(i)} />
        ))}
      </Svg>
      <View style={[st.badge, { width: badge, height: badge, borderRadius: badge / 2, left: width / 2 - badge / 2, top: mid - badge / 2, borderColor: colors[0], shadowColor: colors[0] }]}>
        <Text style={{ fontSize: badge * 0.52 }}>{EMOJI(type, label)}</Text>
      </View>
      <View style={[st.tagWrap, { top: mid + badge / 2 - 2 }]}>
        <Text style={[st.tag, { backgroundColor: colors[0] }]} numberOfLines={1}>
          {cpTag(type, label, short)}
        </Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  badge: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A0F2E', borderWidth: 1.5, shadowOpacity: 0.9, shadowRadius: 6, elevation: 8 },
  // Wider than the link on purpose: the tag can overhang between the two pictures.
  tagWrap: { position: 'absolute', left: -40, right: -40, alignItems: 'center' },
  tag: { color: '#fff', fontSize: 8.5, fontWeight: '900', letterSpacing: 0.3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, overflow: 'hidden' },
});
