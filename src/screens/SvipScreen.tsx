import { Check, ChevronLeft, Gem, Lock } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText, getSvip, type SvipStatus } from '../api';
import { Gradient } from '../components/Gradient';
import { SVIP_COLORS, SvipBadge } from '../components/Svip';
import { Button, Screen, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Your SVIP tier, this month's progress and what each tier unlocks.
export function SvipScreen() {
  const nav = useNav();
  const [s, setS] = useState<SvipStatus | null>(null);
  useEffect(() => {
    getSvip()
      .then(setS)
      .catch((e) => toast(errorText(e)));
  }, []);

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>SVIP</Text>
      </View>
      {!s ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space(8) }} />
      ) : (
        <ScrollView contentContainerStyle={st.body}>
          <Gradient colors={s.tier ? SVIP_COLORS[s.tier] : ['#4B5563', '#1F2937']} style={st.hero}>
            <View style={st.heroTop}>
              <Gem size={28} color={s.tier === 7 ? '#FFD86B' : '#fff'} strokeWidth={2.2} />
              <Text style={[st.heroTier, s.tier === 7 && { color: '#FFD86B' }]}>{s.tier ? `SVIP${s.tier}` : 'Not SVIP yet'}</Text>
            </View>
            <Text style={st.heroSub}>
              {s.validUntil ? `Active until ${day(s.validUntil)}` : `Recharge ${inr(s.tiers[0].rupees)} this month to unlock SVIP1`}
            </Text>
            <View style={st.monthBox}>
              <Text style={st.monthLabel}>Recharged this month</Text>
              <Text style={st.monthValue}>{inr(s.thisMonthRupees)}</Text>
              {s.next ? (
                <>
                  <View style={st.track}>
                    <View style={[st.fill, { width: `${Math.max(3, Math.min(100, (s.thisMonthRupees / s.next.rupees) * 100))}%` }]} />
                  </View>
                  <Text style={st.monthHint}>
                    {inr(s.next.remaining)} more for SVIP{s.next.tier} ({inr(s.next.rupees)})
                  </Text>
                </>
              ) : (
                <Text style={st.monthHint}>Top tier reached this month</Text>
              )}
            </View>
          </Gradient>

          <Text style={st.rule}>
            Your SVIP tier comes from what you recharge from the 1st to the last day of this month. It ends with the month, and the new month starts again from ₹0.
          </Text>
          <Button title="Recharge" onPress={() => nav.push({ name: 'recharge' })} />

          {s.tiers.map((t) => {
            const mine = t.tier === s.tier;
            const open = t.tier <= s.tier;
            return (
              <View key={t.tier} style={[st.tierCard, mine && st.tierMine]}>
                <View style={st.tierHead}>
                  <SvipBadge tier={t.tier} size="md" />
                  <Text style={st.tierNeed}>{inr(t.rupees)} / month</Text>
                  {mine ? <Text style={st.youTag}>You</Text> : !open ? <Lock size={15} color={colors.muted} /> : null}
                </View>
                {t.perks.map((p) => (
                  <View key={p.title} style={st.perk}>
                    <Check size={15} color={open ? colors.success : colors.muted} strokeWidth={2.8} />
                    <View style={{ flex: 1 }}>
                      <Text style={[st.perkTitle, !open && { color: colors.muted }]}>{p.title}</Text>
                      <Text style={st.perkDetail}>{p.detail}</Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { padding: space(4), gap: space(4), paddingBottom: 140 },
  hero: { padding: space(5), borderRadius: radius.lg, gap: space(2) },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  heroTier: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 0.5 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700' },
  monthBox: { marginTop: space(2), padding: space(3), borderRadius: radius.md, backgroundColor: 'rgba(0,0,0,0.22)', gap: 6 },
  monthLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  monthValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#fff' },
  monthHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  rule: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  tierCard: { padding: space(4), gap: space(3), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tierMine: { borderColor: colors.primary, borderWidth: 2 },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  tierNeed: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  youTag: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  perk: { flexDirection: 'row', gap: space(2), alignItems: 'flex-start' },
  perkTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  perkDetail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
