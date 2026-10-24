import { Crown, Gift } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, type UserSummary } from '../api';
import { FramedAvatar } from '../components/Decor';
import { Gradient } from '../components/Gradient';
import { LevelBadge } from '../components/Level';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { Avatar, Sheet, rs as s } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';
import { useCatalog } from './catalog';

type Gifter = UserSummary & { coins: number };
type Period = 'week' | 'month';
const MEDALS = ['#FFD24D', '#C9D3E0', '#E0A06B']; // gold, silver, bronze
const inr = (n: number) => n.toLocaleString('en-IN');

const load = (roomId: string, period: Period) => api<Gifter[]>('GET', `/rooms/${roomId}/top-gifters?period=${period}`);

// Beside the listener count: this week's top 3 gifters in a little stack. Tap for the week / month leaderboard.
export function TopGiftersChip({ roomId, onUserPress }: { roomId: string; onUserPress: (userId: string) => void }) {
  const [top, setTop] = useState<Gifter[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => load(roomId, 'week').then((g) => live && setTop(g.slice(0, 3))).catch(() => {});
    refresh();
    const t = setInterval(refresh, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [roomId]);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Top gifters this week and month" style={st.chip}>
        <Crown size={13} color={colors.gold} fill={colors.gold} strokeWidth={2} />
        {top.length ? (
          <View style={st.stack}>
            {top.map((g, i) => (
              <View key={g.userId} style={[st.stackItem, { marginLeft: i ? -7 : 0, borderColor: MEDALS[i], zIndex: 3 - i }]}>
                <Avatar id={g.userId} name={g.displayName} uri={g.avatarUrl} size={18} />
              </View>
            ))}
          </View>
        ) : (
          <Gift size={14} color={colors.text} strokeWidth={2.4} />
        )}
      </Pressable>
      <TopGiftersSheet
        roomId={roomId}
        visible={open}
        onClose={() => setOpen(false)}
        onUserPress={(id) => {
          setOpen(false);
          onUserPress(id);
        }}
      />
    </>
  );
}

function TopGiftersSheet({ roomId, visible, onClose, onUserPress }: { roomId: string; visible: boolean; onClose: () => void; onUserPress: (userId: string) => void }) {
  const [period, setPeriod] = useState<Period>('week');
  const [rows, setRows] = useState<Gifter[] | null>(null);
  const catalog = useCatalog();
  const fetchRows = useCallback(
    (p: Period) => {
      setRows(null);
      load(roomId, p).then(setRows).catch(() => setRows([]));
    },
    [roomId],
  );
  useEffect(() => {
    if (visible) fetchRows(period);
  }, [visible, period, fetchRows]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Top gifters">
      <View style={st.tabs} accessibilityRole="tablist">
        {(['week', 'month'] as const).map((p) => (
          <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="tab" accessibilityState={{ selected: period === p }} style={[st.tab, period === p && st.tabOn]}>
            {period === p ? <Gradient colors={['#FFD24D', '#F5A623']} style={StyleSheet.absoluteFill} /> : null}
            <Text style={[st.tabText, period === p && st.tabTextOn]}>{p === 'week' ? 'This week' : 'This month'}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.note}>{period === 'week' ? 'Gift coins sent in this room since Monday.' : 'Gift coins sent in this room since the 1st.'}</Text>
      {!rows ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: space(6) }} />
      ) : !rows.length ? (
        <Text style={[s.muted, { textAlign: 'center', marginVertical: space(6) }]}>No gifts yet {period === 'week' ? 'this week' : 'this month'}. Be the first!</Text>
      ) : (
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: space(2) }}>
          {rows.map((g, i) => (
            <Pressable key={g.userId} onPress={() => onUserPress(g.userId)} accessibilityRole="button" accessibilityLabel={`Number ${i + 1}, ${g.displayName}, ${g.coins} coins`} style={[st.row, i < 3 && { borderColor: MEDALS[i] + '88' }]}>
              <View style={[st.rank, i < 3 && { backgroundColor: MEDALS[i] }]}>
                <Text style={[st.rankText, i < 3 && { color: '#2a1d05' }]}>{i + 1}</Text>
              </View>
              <FramedAvatar id={g.userId} name={g.displayName} uri={g.avatarUrl} size={38} frameSvg={g.frameId ? catalog.frames[g.frameId]?.svg : undefined} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={st.nameRow}>
                  <Text style={st.name} numberOfLines={1}>
                    {g.displayName}
                  </Text>
                  <OfficialMark role={g.staffRole} size={14} still />
                </View>
                <View style={st.nameRow}>
                  <SvipBadge tier={g.svip} />
                  {g.level ? <LevelBadge level={g.level} /> : null}
                </View>
              </View>
              <View style={st.coins}>
                <Gift size={13} color={colors.gold} strokeWidth={2.4} />
                <Text style={st.coinsText}>{inr(g.coins)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,201,77,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,201,77,0.4)',
  },
  stack: { flexDirection: 'row' },
  stackItem: { borderRadius: 11, borderWidth: 1.5 },
  tabs: { flexDirection: 'row', gap: space(2), padding: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.06)' },
  tab: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, overflow: 'hidden' },
  tabOn: {},
  tabText: { color: colors.muted, fontWeight: '800', fontSize: 14 },
  tabTextOn: { color: '#2a1d05' },
  note: { color: colors.muted, fontSize: 12, marginVertical: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(2), paddingRight: space(3), borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  rank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' },
  rankText: { color: colors.text, fontWeight: '900', fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800', flexShrink: 1 },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coinsText: { color: colors.gold, fontSize: 14, fontWeight: '900' },
});
