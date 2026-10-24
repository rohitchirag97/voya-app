import { BadgeCheck, ChevronLeft, ChevronRight, Clock, HandCoins, ShieldAlert, Store } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText, type CoinSeller, type CoinSellerStatus } from '../api';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { Gradient } from '../components/Gradient';
import { LevelBadge } from '../components/Level';
import { UserIds } from '../components/UserIds';
import { Avatar, Button, Field, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, gradients, radius, space } from '../theme';

// Who you can safely buy coins from, plus applying to become one.
export function CoinSellersScreen() {
  const nav = useNav();
  const [sellers, setSellers] = useState<CoinSeller[] | null>(null);
  const [mine, setMine] = useState<CoinSellerStatus | undefined>(undefined);

  useEffect(() => {
    api<{ sellers: CoinSeller[] }>('GET', '/coin-sellers')
      .then((r) => setSellers(r.sellers))
      .catch((e) => (toast(errorText(e)), setSellers([])));
    api<{ status: CoinSellerStatus }>('GET', '/coin-sellers/me')
      .then((r) => setMine(r.status))
      .catch(() => setMine(null));
  }, []);

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Authorised Coin Sellers</Text>
      </View>
      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        <View style={st.warn}>
          <ShieldAlert size={18} color={colors.gold} />
          <Text style={st.warnText}>Only buy coins from sellers on this list. VoyaLive staff will never ask for your password or OTP.</Text>
        </View>

        {!sellers ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: space(6) }} />
        ) : sellers.length ? (
          sellers.map((x) => (
            <Pressable
              key={x.userId}
              onPress={() => nav.push({ name: 'user', userId: x.userId })}
              accessibilityRole="button"
              accessibilityLabel={`${x.displayName}, authorised coin seller`}
              style={({ pressed }) => [st.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
              <Avatar id={x.userId} name={x.displayName} uri={x.avatarUrl} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={st.nameRow}>
                  <Text style={st.name} numberOfLines={1}>
                    {x.displayName}
                  </Text>
                  <OfficialMark role={x.staffRole} />
                  <SvipBadge tier={x.svip} />
                  <HandCoins size={17} color="#10B981" strokeWidth={2.4} />
                  {x.level ? <LevelBadge level={x.level} /> : null}
                </View>
                <UserIds publicId={x.publicId} specialId={x.specialId} />
              </View>
              <ChevronRight size={20} color={colors.muted} />
            </Pressable>
          ))
        ) : (
          <Text style={[s.muted, { textAlign: 'center', marginVertical: space(6) }]}>No authorised sellers yet.</Text>
        )}

        <Apply status={mine} onApplied={() => setMine('PENDING')} />
      </ScrollView>
    </Screen>
  );
}

function Apply({ status, onApplied }: { status: CoinSellerStatus | undefined; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await api('POST', '/coin-sellers/apply', { message: message.trim() });
      toast('Application sent');
      onApplied();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (status === undefined) return null;
  return (
    <Gradient colors={['rgba(255,61,139,0.10)', 'rgba(139,92,246,0.10)']} style={st.apply}>
      <View style={st.applyHead}>
        <Gradient colors={gradients.primary} style={st.applyIcon}>
          <Store size={22} color="#fff" />
        </Gradient>
        <View style={{ flex: 1 }}>
          <Text style={st.applyTitle}>Become a coin seller</Text>
          <Text style={st.applySub}>Buy coins in bulk at a discount and sell them to other users.</Text>
        </View>
      </View>

      {status === 'APPROVED' ? (
        <Status Icon={BadgeCheck} color={colors.success} text="You are an authorised coin seller." />
      ) : status === 'PENDING' ? (
        <Status Icon={Clock} color={colors.gold} text="Your application is under review." />
      ) : open ? (
        <>
          <Field
            label="About you"
            value={message}
            onChangeText={setMessage}
            placeholder="Where do you sell, and how many users do you reach?"
            multiline
            maxLength={500}
            style={st.message}
          />
          <Button title="Send application" onPress={submit} loading={busy} disabled={message.trim().length < 10} />
        </>
      ) : (
        <>
          {status === 'REJECTED' ? <Status Icon={ShieldAlert} color={colors.danger} text="Your last application was not approved. You can apply again." /> : null}
          <Button title="Apply now" onPress={() => setOpen(true)} />
        </>
      )}
    </Gradient>
  );
}

function Status({ Icon, color, text }: { Icon: typeof Clock; color: string; text: string }) {
  return (
    <View style={st.status}>
      <Icon size={18} color={color} />
      <Text style={[st.statusText, { color }]}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { padding: space(4), gap: space(3), paddingBottom: 140 },
  warn: { flexDirection: 'row', gap: space(2), padding: space(3), borderRadius: radius.md, backgroundColor: 'rgba(232,146,12,0.10)' },
  warnText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  apply: { marginTop: space(4), padding: space(4), gap: space(3), borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  applyHead: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  applyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  applyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  applySub: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  statusText: { flex: 1, fontSize: 14, fontWeight: '700' },
  message: { height: 96, textAlignVertical: 'top', paddingTop: space(3) },
});
