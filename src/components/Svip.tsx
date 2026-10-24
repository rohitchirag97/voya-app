import { Gem } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { radius } from '../theme';
import { Gradient } from './Gradient';

// SVIP1-7 (from the month's recharge, server-side). Colours climb bronze → silver → gold → rose → violet → black-gold.
export const SVIP_COLORS: Record<number, [string, string]> = {
  1: ['#C08457', '#8A5A3B'],
  2: ['#B8C4D6', '#7B8BA3'],
  3: ['#FFD86B', '#E09B12'],
  4: ['#FF8FB1', '#E0457B'],
  5: ['#B98CFF', '#7C3AED'],
  6: ['#5EEAD4', '#0E7490'],
  7: ['#3A2A12', '#0B0B0B'],
};

export function SvipBadge({ tier, size = 'sm' }: { tier?: number | null; size?: 'sm' | 'md' }) {
  if (!tier) return null;
  const big = size === 'md';
  const gold = tier === 7 ? '#FFD86B' : '#fff'; // SVIP7: gold on black
  return (
    <Gradient colors={SVIP_COLORS[tier] ?? SVIP_COLORS[7]} style={[st.badge, big && st.badgeMd, tier === 7 && st.top]}>
      <Gem size={big ? 12 : 9} color={gold} strokeWidth={2.6} />
      <Text style={[st.text, big && { fontSize: 13 }, { color: gold }]} accessibilityLabel={`SVIP ${tier}`}>
        SVIP{tier}
      </Text>
    </Gradient>
  );
}

const st = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.pill, overflow: 'hidden' },
  badgeMd: { paddingHorizontal: 9, paddingVertical: 3, gap: 4 },
  top: { borderWidth: 1, borderColor: '#FFD86B' },
  text: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
});
