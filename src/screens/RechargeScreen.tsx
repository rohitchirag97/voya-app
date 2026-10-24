import { ChevronLeft, ChevronRight, Coins, FlaskConical, Sparkles, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText, newId, type Me } from '../api';
import { showDialog } from '../components/Dialog';
import { Gradient } from '../components/Gradient';
import { LevelProgress, type LevelInfo } from '../components/Level';
import { Screen, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, gradients, radius, space } from '../theme';

type Package = { id: string; coins: number; pricePaise: number };
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Buy coins. Each ₹1 paid is also 1 level point (XP).
export function RechargeScreen() {
  const nav = useNav();
  const me = nav.me!;
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [level, setLevel] = useState<LevelInfo | null>(me.level ?? null);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Package[]>('GET', '/wallet/packages'), api<{ balance: number }>('GET', '/wallet'), api<Me>('GET', '/me')])
      .then(([p, w, u]) => {
        setPackages(p);
        setBalance(w.balance);
        if (u.level) setLevel(u.level);
      })
      .catch((e) => toast(errorText(e)));
  }, []);

  async function buy(p: Package) {
    setBuying(p.id);
    try {
      const r = await api<{ balance: number; level: LevelInfo; leveledUp: boolean }>(
        'POST',
        '/wallet/recharge',
        { packageId: p.id },
        { 'Idempotency-Key': newId() },
      );
      setBalance(r.balance);
      setLevel(r.level);
      nav.setMe({ ...me, level: r.level });
      if (r.leveledUp) showDialog({ title: 'Level up!', message: `You're now Lv ${r.level.level}.`, Icon: Sparkles, tone: 'gold', actions: [{ label: 'Awesome', value: 'ok', kind: 'primary' }] });
      else toast(`+${p.coins} coins added`);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBuying(null);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Recharge</Text>
      </View>
      <ScrollView contentContainerStyle={st.body}>
        <Gradient colors={['rgba(255,227,138,0.22)', 'rgba(245,166,35,0.08)']} style={st.wallet}>
          <Text style={st.walletLabel}>Your coins</Text>
          <View style={st.balanceRow}>
            <Coins size={30} color={colors.gold} strokeWidth={2.2} />
            <Text style={st.balance}>{balance ?? '—'}</Text>
          </View>
          {level ? <LevelProgress info={level} /> : null}
        </Gradient>

        <View style={st.testNote}>
          <FlaskConical size={14} color={colors.muted} />
          <Text style={st.testText}>Test mode: purchases are free and no money is charged.</Text>
        </View>

        {!packages ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: space(8) }} />
        ) : (
          <View style={st.grid}>
            {packages.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => buy(p)}
                disabled={!!buying}
                accessibilityRole="button"
                accessibilityLabel={`${p.coins} coins for ${rupees(p.pricePaise)}, plus ${Math.floor(p.pricePaise / 100)} XP`}
                style={({ pressed }) => [st.pkg, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}>
                <Coins size={30} color={colors.gold} strokeWidth={2} />
                <Text style={st.pkgCoins}>{p.coins.toLocaleString('en-IN')}</Text>
                <Text style={st.pkgXp}>+{Math.floor(p.pricePaise / 100).toLocaleString('en-IN')} XP</Text>
                <Gradient colors={gradients.primary} style={st.price}>
                  {buying === p.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.priceText}>{rupees(p.pricePaise)}</Text>}
                </Gradient>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => nav.push({ name: 'coinSellers' })}
          accessibilityRole="link"
          accessibilityLabel="Authorised Coin Sellers"
          style={({ pressed }) => [st.sellers, pressed && { opacity: 0.8 }]}>
          <Store size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={st.sellersTitle}>Authorised Coin Sellers</Text>
            <Text style={st.sellersSub}>Buy from trusted sellers, or apply to become one</Text>
          </View>
          <ChevronRight size={20} color={colors.muted} />
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { padding: space(4), gap: space(4), paddingBottom: 140 },
  wallet: { padding: space(4), borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,201,77,0.35)', gap: space(3) },
  walletLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  balance: { color: colors.gold, fontSize: 34, fontWeight: '900' },
  testNote: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  testText: { color: colors.muted, fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  pkg: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: space(4),
    paddingBottom: space(3),
    paddingHorizontal: space(2),
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pkgCoins: { color: colors.text, fontSize: 20, fontWeight: '900' },
  pkgXp: { color: colors.success, fontSize: 11, fontWeight: '800' },
  price: { marginTop: space(2), alignSelf: 'stretch', alignItems: 'center', paddingVertical: 7, borderRadius: radius.pill },
  priceText: { color: '#fff', fontWeight: '900' },
  sellers: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sellersTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sellersSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
