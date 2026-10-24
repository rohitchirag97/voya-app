import { Heart, Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type RoomStats } from '../api';
import { showDialog } from '../components/Dialog';
import { Gradient } from '../components/Gradient';
import { roomColors as colors, radius, space } from '../theme';

const inr = (n: number) => n.toLocaleString('en-IN');
export const rankText = (rank: number | null) => (rank === null || rank > 99 ? '99+' : String(rank));
export const daysLeft = (iso: string) => Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

// Weekly rank + heart level, refreshed every minute while the room is open.
export function useRoomStats(roomId: string | undefined) {
  const [stats, setStats] = useState<RoomStats | null>(null);
  useEffect(() => {
    if (!roomId) return;
    let live = true;
    const load = () => api<RoomStats>('GET', `/rooms/${roomId}/stats`).then((s) => live && setStats(s)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [roomId]);
  return stats;
}

// Under the room title: "No.12" weekly rank and "Lv. 3 Heart". Tap either for what it means.
export function RoomStatChips({ stats }: { stats: RoomStats | null }) {
  if (!stats) return null;
  const { heart } = stats;
  return (
    <View style={st.row}>
      <Pressable
        onPress={() =>
          showDialog({
            title: stats.rank ? `No.${stats.rank} this week` : 'Not ranked yet',
            message: `Rooms are ranked by the gift coins received this week. This room: ${inr(stats.weekCoins)} coins.\n\nThe ranking resets in ${daysLeft(stats.weekEndsAt)} day(s), on Monday.`,
            Icon: Trophy,
            tone: 'gold',
            actions: [{ label: 'OK', value: 'ok', kind: 'primary' }],
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Weekly room rank ${rankText(stats.rank)}`}
        style={st.chip}>
        <Gradient colors={['#A78BFA', '#7C3AED']} style={st.rankBadge}>
          <Trophy size={10} color="#fff" strokeWidth={2.8} />
        </Gradient>
        <Text style={st.chipText}>No.{rankText(stats.rank)}</Text>
      </Pressable>
      <Pressable
        onPress={() =>
          showDialog({
            title: `Lv. ${heart.level} Heart`,
            message: `The room's heart grows with every gift received here: ${inr(heart.coins)} coins so far.${heart.nextAt ? `\n\n${inr(heart.nextAt - heart.coins)} more for Lv. ${heart.level + 1}.` : '\n\nTop level reached.'}`,
            Icon: Heart,
            actions: [{ label: 'OK', value: 'ok', kind: 'primary' }],
          })
        }
        accessibilityRole="button"
        accessibilityLabel={`Room heart level ${heart.level}`}
        style={st.chip}>
        <Heart size={16} color="#FF4D9A" fill="#FF4D9A" strokeWidth={2} />
        <Text style={st.chipText}>Lv. {heart.level} Heart</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rankBadge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '800' },
});
