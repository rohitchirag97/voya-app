import { Clock, Swords } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Pk, Seat } from '../api';
import { Gradient } from '../components/Gradient';
import { Avatar, rs as s } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';

const RED = '#FF4D6D';
const BLUE = '#3B82F6';
export const PK_MINUTES = [3, 5, 10, 15] as const;
const short = (n: number) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(n));

// mm:ss until the battle ends, ticking every second.
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
}

// Widget card for the running battle: timer, red-vs-blue bar, both sides, and a Send Gifts button.
export function PkCard({ pk, onGift, onUserPress }: { pk: Pk; onGift: (userId: string) => void; onUserPress: (userId: string) => void }) {
  const timer = useCountdown(pk.endsAt);
  const total = pk.a.score + pk.b.score;
  const share = total ? pk.a.score / total : 0.5;
  const lead = pk.a.score === pk.b.score ? null : pk.a.score > pk.b.score ? pk.a : pk.b;
  return (
    <View style={st.card} accessibilityLabel={`PK: ${pk.a.displayName} ${pk.a.score} vs ${pk.b.displayName} ${pk.b.score}, ${timer} left`}>
      <Gradient colors={['#4C1D95', '#24104F']} style={StyleSheet.absoluteFill} />
      <View style={st.head}>
        <Swords size={14} color={colors.gold} strokeWidth={2.6} />
        <Text style={st.title}>PK 1v1</Text>
      </View>
      <View style={st.timer}>
        <Clock size={11} color="#fff" strokeWidth={2.6} />
        <Text style={st.timerText}>{timer}</Text>
      </View>
      <View style={st.bar}>
        <View style={[st.barSide, { flex: Math.max(0.08, share), backgroundColor: RED }]}>
          <Text style={st.barText}>{short(pk.a.score)}</Text>
        </View>
        <View style={[st.barSide, st.barRight, { flex: Math.max(0.08, 1 - share), backgroundColor: BLUE }]}>
          <Text style={st.barText}>{short(pk.b.score)}</Text>
        </View>
      </View>
      <View style={st.sides}>
        {[pk.a, pk.b].map((p, i) => (
          <Pressable key={p.userId} onPress={() => onUserPress(p.userId)} accessibilityRole="button" accessibilityLabel={`${p.displayName}'s profile`} style={st.side}>
            <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={30} ring={i ? BLUE : RED} />
            <Text style={st.sideName} numberOfLines={1}>
              {p.displayName}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.lead} numberOfLines={1}>
        {lead ? `${lead.displayName} leads` : 'Tied'}
      </Text>
      <Pressable onPress={() => onGift((lead ?? pk.a).userId)} accessibilityRole="button" style={st.giftBtn}>
        <Text style={st.giftText}>Send Gifts</Text>
      </Pressable>
    </View>
  );
}

// "More" sheet section (owner/admins): pick two people on seats and a length, or cancel the running battle.
export function PkSection({ seats, pk, onStart, onStop }: {
  seats: Seat[];
  pk: Pk | null;
  onStart: (a: string, b: string, minutes: number) => void;
  onStop: () => void;
}) {
  const seated = seats.flatMap((x) => (x.occupant ? [x.occupant] : []));
  const [picked, setPicked] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number>(5);
  if (pk)
    return (
      <View style={st.section}>
        <Text style={s.muted}>
          {pk.a.displayName} vs {pk.b.displayName} is on.
        </Text>
        <Pressable onPress={onStop} accessibilityRole="button" style={[st.action, st.cancel]}>
          <Text style={st.actionText}>Cancel PK</Text>
        </Pressable>
      </View>
    );
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  return (
    <View style={st.section}>
      <Text style={s.muted}>{seated.length < 2 ? 'Two people need to be on seats to start a PK.' : 'Pick two people on seats. Gifts each receives during the PK are their score.'}</Text>
      <View style={st.chips}>
        {seated.map((o) => {
          const at = picked.indexOf(o.userId);
          return (
            <Pressable
              key={o.userId}
              onPress={() => toggle(o.userId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: at >= 0 }}
              style={[st.person, at >= 0 && { borderColor: at ? BLUE : RED, backgroundColor: (at ? BLUE : RED) + '22' }]}>
              <Avatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={22} />
              <Text style={st.personName} numberOfLines={1}>
                {o.displayName}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={st.chips}>
        {PK_MINUTES.map((m) => (
          <Pressable
            key={m}
            onPress={() => setMinutes(m)}
            accessibilityRole="radio"
            accessibilityState={{ selected: minutes === m }}
            style={[st.minute, minutes === m && st.minuteOn]}>
            <Text style={[st.minuteText, minutes === m && { color: '#fff' }]}>{m} min</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={() => picked.length === 2 && onStart(picked[0], picked[1], minutes)}
        disabled={picked.length !== 2}
        accessibilityRole="button"
        style={[st.action, picked.length !== 2 && { opacity: 0.4 }]}>
        <Swords size={16} color="#fff" strokeWidth={2.6} />
        <Text style={st.actionText}>Start PK</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: { width: 132, height: 176, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', padding: space(2), gap: 4, borderWidth: 1.5, borderColor: '#A78BFA' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { color: '#fff', fontSize: 13, fontWeight: '900' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  timerText: { color: '#fff', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', alignSelf: 'stretch', height: 16, borderRadius: radius.pill, overflow: 'hidden', marginTop: 2 },
  barSide: { justifyContent: 'center', paddingHorizontal: 5 },
  barRight: { alignItems: 'flex-end' },
  barText: { color: '#fff', fontSize: 9.5, fontWeight: '900' },
  sides: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between' },
  side: { alignItems: 'center', width: 56, gap: 1 },
  sideName: { color: colors.text, fontSize: 9.5, fontWeight: '700', maxWidth: 56 },
  lead: { color: colors.gold, fontSize: 10.5, fontWeight: '800' },
  giftBtn: { marginTop: 'auto', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.gold },
  giftText: { color: '#2a1d05', fontSize: 11.5, fontWeight: '900' },
  section: { gap: space(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150, paddingLeft: 3, paddingRight: 10, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },
  personName: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  minute: { paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)' },
  minuteOn: { backgroundColor: colors.primary },
  minuteText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: radius.pill, backgroundColor: colors.primary },
  cancel: { backgroundColor: 'rgba(255,77,94,0.25)', borderWidth: 1, borderColor: 'rgba(255,77,94,0.6)' },
  actionText: { color: '#fff', fontWeight: '900' },
});
