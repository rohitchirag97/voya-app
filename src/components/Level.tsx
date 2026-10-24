import { Star } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { Gradient } from './Gradient';

// Level numbers and progress come from the server (thresholds live in the database).
export type LevelInfo = { level: number; xp: number; levelXp: number; levelXpNeeded: number; nextLevelAt: number | null };

// Badge colours step up with the level range.
const tier = (level: number) =>
  level >= 30 ? ['#FFE38A', '#F5A623'] : level >= 20 ? ['#FB923C', '#EF4444'] : level >= 10 ? ['#A855F7', '#EC4899'] : ['#38BDF8', '#6366F1'];

// Level 0 (never recharged) shows no badge at all.
export function LevelBadge({ level, size = 'sm' }: { level: number; size?: 'sm' | 'md' }) {
  if (level < 1) return null;
  const big = size === 'md';
  return (
    <Gradient colors={tier(level)} style={[st.badge, big && st.badgeMd]}>
      <Star size={big ? 12 : 9} color="#fff" fill="#fff" />
      <Text style={[st.text, big && { fontSize: 13 }]} accessibilityLabel={`Level ${level}`}>
        Lv {level}
      </Text>
    </Gradient>
  );
}

// "Lv 3 · 60 / 300 XP to Lv 4" with a filled bar.
export function LevelProgress({ info }: { info: LevelInfo }) {
  const done = info.nextLevelAt === null;
  const pct = done ? 1 : Math.min(1, info.levelXp / Math.max(1, info.levelXpNeeded));
  return (
    <View style={st.progress}>
      <View style={st.progressTop}>
        <LevelBadge level={info.level} size="md" />
        <Text style={st.progressText}>{done ? 'Max level' : info.level === 0 ? 'Recharge to unlock Lv 1' : `${info.levelXp} / ${info.levelXpNeeded} XP to Lv ${info.level + 1}`}</Text>
      </View>
      <View style={st.track}>
        <Gradient colors={tier(info.level)} style={[st.fill, { width: `${Math.max(4, pct * 100)}%` }]} />
      </View>
      <Text style={st.hint}>Every ₹1 recharged earns 1 XP</Text>
    </View>
  );
}

const st = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: radius.pill },
  badgeMd: { paddingHorizontal: 9, paddingVertical: 3, gap: 4 },
  text: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
  progress: { gap: 8, alignSelf: 'stretch' },
  progressTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  track: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  hint: { color: colors.muted, fontSize: 11 },
});
