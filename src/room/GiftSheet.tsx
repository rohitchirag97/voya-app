import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Coins, Crown, Users } from 'lucide-react-native';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { api, ApiError, errorText, newId, type Gift, type Seat } from '../api';
import { showDialog } from '../components/Dialog';
import { Gradient } from '../components/Gradient';
import { GiftArt } from '../components/Icons';
import { Avatar, Sheet, rs as s, toast } from '../components/ui';
import { gradients, roomColors as colors, radius, space } from '../theme';
import type { GiftEvent } from './useRoom';

// What was just sent, so the combo button can send it again.
export type LastGift = { to: string; gift: Gift; quantity: number; toName: string };
type SendFn = (to: string, giftId: string, quantity: number, key: string) => Promise<{ balance: number }>; // to: userId or 'ALL'

type Props = {
  visible: boolean;
  onClose: () => void;
  seats: Seat[];
  meId: string;
  initialRecipient?: string;
  send: SendFn;
  onSent: (last: LastGift) => void;
  onRecharge: () => void;
};

const QUANTITIES = [1, 5, 10, 33, 66, 99, 199, 520, 999];
// Tabs by price, so the box stays tidy as the catalog grows; empty tabs are hidden.
const TABS: { key: string; label: string; test: (price: number) => boolean }[] = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'popular', label: 'Popular', test: (p) => p < 50 },
  { key: 'premium', label: 'Premium', test: (p) => p >= 50 && p < 500 },
  { key: 'luxury', label: 'Luxury', test: (p) => p >= 500 },
];

// Not enough coins: say how many are missing and offer Recharge. Resolves true when they chose to recharge.
export async function notEnoughCoins(cost: number, balance: number | null) {
  const missing = balance === null ? null : cost - balance;
  const v = await showDialog({
    title: 'Not enough coins',
    message:
      missing && missing > 0
        ? `This needs ${cost.toLocaleString('en-IN')} coins. You're ${missing.toLocaleString('en-IN')} short.`
        : 'Recharge to keep sending gifts.',
    tone: 'gold',
    Icon: Coins,
    actions: [
      { label: 'Not now', value: 'no', kind: 'cancel' },
      { label: 'Recharge', value: 'recharge', kind: 'primary' },
    ],
  });
  return v === 'recharge';
}
export const isNoCoins = (e: unknown) => e instanceof ApiError && e.code === 'INSUFFICIENT_COINS';

// Recipients are only seated users (never audience); the server re-checks at settlement.
export function GiftSheet({ visible, onClose, seats, meId, initialRecipient, send, onSent, onRecharge }: Props) {
  const [catalog, setCatalog] = useState<Gift[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [to, setTo] = useState<string | undefined>();
  const [giftId, setGiftId] = useState<string | undefined>();
  const [qty, setQty] = useState(1);
  const [qtyOpen, setQtyOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);
  const key = useRef(newId()); // reused across retries of the same selection

  // Everyone seated, you included (self-gifting is allowed).
  const recipients = seats.filter((x) => x.occupant);
  const gift = catalog.find((g) => g.id === giftId);
  const tabs = TABS.filter((t) => t.key === 'all' || catalog.some((g) => t.test(g.coinPrice)));
  const shown = catalog.filter((g) => (TABS.find((t) => t.key === tab) ?? TABS[0]!).test(g.coinPrice));

  useEffect(() => {
    if (!visible) return;
    setTo(initialRecipient ?? recipients[0]?.occupant?.userId);
    setQtyOpen(false);
    api<Gift[]>('GET', '/gifts').then((g) => {
      setCatalog(g);
      setGiftId((id) => id ?? g[0]?.id);
    });
    api<{ balance: number }>('GET', '/wallet').then((w) => setBalance(w.balance));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    key.current = newId();
  }, [to, giftId, qty]);

  // Recipient left their seat while the sheet was open.
  const toSeated = to === 'ALL' ? recipients.length > 0 : recipients.some((x) => x.occupant!.userId === to);
  const cost = (gift?.coinPrice ?? 0) * qty * (to === 'ALL' ? recipients.length : 1);
  const canSend = !busy && !!to && toSeated && !!gift;

  const recharge = () => {
    onClose();
    onRecharge();
  };

  async function submit() {
    if (!gift || !to) return;
    if (balance !== null && cost > balance) {
      if (await notEnoughCoins(cost, balance)) recharge();
      return;
    }
    setBusy(true);
    try {
      const r = await send(to, gift.id, qty, key.current);
      setBalance(r.balance);
      key.current = newId();
      const toName = to === 'ALL' ? 'everyone on stage' : recipients.find((x) => x.occupant!.userId === to)?.occupant?.displayName ?? '';
      onSent({ to, gift, quantity: qty, toName: toName ?? '' });
      onClose();
    } catch (e) {
      if (isNoCoins(e)) {
        if (await notEnoughCoins(cost, balance)) recharge();
      } else toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      {/* Who it's for: everyone seated; "All" selects every one of them. */}
      {recipients.length ? (
        <View style={st.toRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.toList} style={st.grow}>
            {recipients.map((x) => {
              const o = x.occupant!;
              const on = to === 'ALL' || o.userId === to;
              return (
                <Pressable
                  key={o.userId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${o.userId === meId ? 'You' : o.displayName}, seat ${x.seatIndex + 1}`}
                  onPress={() => setTo(o.userId)}
                  style={[st.to, on && st.toOn]}>
                  <Avatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={38} />
                  <View style={[st.seatTag, x.seatIndex === 0 && st.ownerTag]}>
                    {x.seatIndex === 0 ? <Crown size={9} color="#1A1030" fill="#1A1030" /> : <Text style={st.seatTagText}>{x.seatIndex + 1}</Text>}
                  </View>
                  {on ? (
                    <View style={st.check}>
                      <Check size={10} color="#fff" strokeWidth={3.5} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: to === 'ALL' }}
            accessibilityLabel={`Everyone on stage, ${recipients.length} people`}
            onPress={() => setTo('ALL')}
            style={[st.allBtn, to === 'ALL' && st.allBtnOn]}>
            <Users size={16} color={to === 'ALL' ? '#fff' : colors.muted} />
            <Text style={[st.allText, to === 'ALL' && st.white]}>All</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={s.muted}>Nobody is on a seat yet. Gifts can only go to people on stage.</Text>
      )}

      {tabs.length > 1 ? (
        <View style={st.tabs} accessibilityRole="tablist">
          {tabs.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} hitSlop={6}>
              <Text style={[st.tab, tab === t.key && st.tabOn]}>{t.label}</Text>
              {tab === t.key ? <View style={st.tabBar} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <ScrollView style={st.gridScroll} contentContainerStyle={st.grid} showsVerticalScrollIndicator={false}>
        {shown.map((g) => {
          const on = g.id === giftId;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="radio"
              accessibilityLabel={`${g.name}, ${g.coinPrice} coins`}
              accessibilityState={{ selected: on }}
              onPress={() => {
                setGiftId(g.id);
                setQty((q) => Math.min(q, g.maxQuantity));
              }}
              style={[st.gift, on && st.giftOn]}>
              <View style={st.gArt}>
                <GiftArt gift={g} size={on ? 50 : 44} />
              </View>
              <Text style={st.gName} numberOfLines={1}>
                {g.name}
              </Text>
              <View style={st.priceRow}>
                <Coins size={11} color={colors.gold} />
                <Text style={st.gPrice}>{g.coinPrice.toLocaleString('en-IN')}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Balance (opens Recharge) · quantity · send */}
      <View style={st.footer}>
        <Pressable onPress={recharge} accessibilityRole="button" accessibilityLabel={`Balance ${balance ?? 'loading'} coins. Recharge`} style={st.wallet}>
          <Coins size={16} color={colors.gold} />
          <Text style={st.balance}>{balance === null ? '—' : balance.toLocaleString('en-IN')}</Text>
          <ChevronRight size={14} color={colors.gold} />
        </Pressable>
        <View style={st.grow} />
        <View>
          {qtyOpen ? (
            <View style={st.qtyMenu}>
              {QUANTITIES.filter((n) => !gift || n <= gift.maxQuantity).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => {
                    setQty(n);
                    setQtyOpen(false);
                  }}
                  accessibilityRole="menuitem"
                  style={[st.qtyItem, qty === n && st.qtyItemOn]}>
                  <Text style={[st.qtyItemText, qty === n && st.white]}>×{n}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={st.sendGroup}>
            <Pressable onPress={() => setQtyOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`Quantity ${qty}. Change`} style={st.qty}>
              <Text style={st.qtyText}>×{qty}</Text>
              <ChevronDown size={14} color={colors.text} style={qtyOpen ? st.flip : undefined} />
            </Pressable>
            <Pressable onPress={submit} disabled={!canSend} accessibilityRole="button" accessibilityLabel={`Send for ${cost} coins`} style={[st.send, !canSend && st.sendOff]}>
              <Gradient colors={gradients.primary} style={StyleSheet.absoluteFill} />
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={st.sendText}>Send</Text>
                  <Text style={st.sendCost}>{cost.toLocaleString('en-IN')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Sheet>
  );
}

// After a gift goes out: a round button with a ring that runs down. Tap to send the same gift again (the ring
// restarts); when it runs out, the button goes away.
const COMBO_MS = 5000;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export function GiftCombo({ last, send, onDone, onRecharge }: { last: LastGift; send: SendFn; onDone: () => void; onRecharge: () => void }) {
  const ring = useRef(new Animated.Value(0)).current;
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const run = () => {
    ring.stopAnimation();
    ring.setValue(0);
    // SVG props can't use the native driver.
    Animated.timing(ring, { toValue: 1, duration: COMBO_MS, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => finished && onDone());
  };
  useEffect(() => {
    setCount(1);
    run();
    return () => ring.stopAnimation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  async function again() {
    if (busy) return;
    setBusy(true);
    run(); // the countdown restarts on every tap
    try {
      await send(last.to, last.gift.id, last.quantity, newId());
      setCount((n) => n + 1);
    } catch (e) {
      if (isNoCoins(e)) {
        ring.stopAnimation();
        onDone();
        if (await notEnoughCoins(last.gift.coinPrice * last.quantity, null)) onRecharge();
      } else toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const R = 31;
  const C = 2 * Math.PI * R;
  return (
    <View style={st.combo} pointerEvents="box-none">
      {count > 1 ? <Text style={st.comboCount}>×{count}</Text> : null}
      <Pressable onPress={again} accessibilityRole="button" accessibilityLabel={`Send ${last.gift.name} to ${last.toName} again`} style={st.comboBtn}>
        <Svg width={72} height={72} style={StyleSheet.absoluteFill}>
          <Circle cx={36} cy={36} r={R} stroke="rgba(255,255,255,0.15)" strokeWidth={4} fill="none" />
          <AnimatedCircle
            cx={36}
            cy={36}
            r={R}
            stroke={colors.gold}
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C} ${C}`}
            strokeDashoffset={ring.interpolate({ inputRange: [0, 1], outputRange: [0, C] })}
            transform="rotate(-90 36 36)"
          />
        </Svg>
        <GiftArt gift={last.gift} size={32} />
        <Text style={st.comboLabel}>AGAIN</Text>
      </Pressable>
    </View>
  );
}

// One confirmed gift at a time slides in over the stage.
export function GiftBanner({ event, onDone }: { event: GiftEvent | undefined; onDone: () => void }) {
  const x = useRef(new Animated.Value(-400)).current;
  useEffect(() => {
    if (!event) return;
    x.setValue(-400);
    Animated.sequence([
      Animated.spring(x, { toValue: 0, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(x, { toValue: 500, duration: 300, useNativeDriver: true }),
    ]).start(onDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.transactionId]);
  if (!event) return null;
  return (
    <Animated.View style={[st.banner, { transform: [{ translateX: x }] }]} accessibilityLiveRegion="polite">
      <GiftArt gift={event.gift} size={34} />
      <Text style={st.bannerText} numberOfLines={2}>
        <Text style={st.bold}>{event.sender.displayName}</Text> sent {event.gift.name}
        {event.quantity > 1 ? ` ×${event.quantity}` : ''} to <Text style={st.bold}>{event.recipient.displayName}</Text>
      </Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  grow: { flex: 1 },
  white: { color: '#fff' },
  bold: { fontWeight: '800' },
  toRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  toList: { gap: space(2), paddingVertical: 4, paddingHorizontal: 3 },
  to: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  toOn: { borderColor: colors.primary },
  seatTag: {
    position: 'absolute',
    bottom: -3,
    left: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  ownerTag: { backgroundColor: colors.gold },
  seatTagText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  check: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  allBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  allText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  tabs: { flexDirection: 'row', gap: space(5), borderBottomWidth: 1, borderBottomColor: colors.glassBorder, paddingBottom: space(2) },
  tab: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  tabOn: { color: colors.text },
  tabBar: { position: 'absolute', bottom: -space(2) - 1, left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: colors.primary },
  gridScroll: { maxHeight: 300 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space(2), columnGap: '1.33%' },
  gift: { width: '24%', alignItems: 'center', gap: 2, paddingVertical: space(2), borderRadius: radius.md, borderWidth: 1.5, borderColor: 'transparent' },
  giftOn: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  gArt: { height: 54, alignItems: 'center', justifyContent: 'center' },
  gName: { color: colors.text, fontSize: 12, fontWeight: '600', maxWidth: '92%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  gPrice: { color: colors.gold, fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: space(2) },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,201,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,201,77,0.3)',
  },
  balance: { color: colors.gold, fontWeight: '800' },
  sendGroup: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.glassBorder, overflow: 'hidden' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 40, paddingHorizontal: space(3) },
  qtyText: { color: colors.text, fontWeight: '800' },
  flip: { transform: [{ rotate: '180deg' }] },
  qtyMenu: {
    position: 'absolute',
    bottom: 46,
    left: 0,
    width: 84,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    elevation: 12,
    zIndex: 5,
  },
  qtyItem: { paddingVertical: 7, paddingHorizontal: space(3) },
  qtyItemOn: { backgroundColor: colors.primary },
  qtyItemText: { color: colors.text, fontWeight: '700' },
  send: { height: 40, minWidth: 96, paddingHorizontal: space(4), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sendOff: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '900', fontSize: 15, lineHeight: 17 },
  sendCost: { color: '#fff', opacity: 0.85, fontSize: 10, fontWeight: '700' },
  combo: { position: 'absolute', right: space(3), bottom: 150, alignItems: 'center', zIndex: 30, elevation: 30 },
  comboBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,12,40,0.88)' },
  comboLabel: { position: 'absolute', bottom: 7, color: colors.gold, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  comboCount: { color: colors.gold, fontSize: 22, fontWeight: '900', fontStyle: 'italic', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, marginBottom: 2 },
  banner: {
    position: 'absolute',
    top: space(2),
    left: space(4),
    right: space(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    elevation: 8,
  },
  bannerText: { color: '#fff', flex: 1, fontSize: 14 },
});
