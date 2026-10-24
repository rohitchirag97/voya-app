import React, { useEffect, useRef, useState } from 'react';
import { Coins, Crown, Users } from 'lucide-react-native';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText, newId, type Gift, type Seat } from '../api';
import { GiftArt } from '../components/Icons';
import { Avatar, Button, Chip, Sheet, rs as s, toast } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';
import type { GiftEvent } from './useRoom';

type Props = {
  visible: boolean;
  onClose: () => void;
  seats: Seat[];
  meId: string;
  initialRecipient?: string;
  send: (to: string, giftId: string, quantity: number, key: string) => Promise<{ balance: number }>; // to: userId or 'ALL'
};

// Recipients are only seated users (never audience); the server re-checks at settlement.
export function GiftSheet({ visible, onClose, seats, meId, initialRecipient, send }: Props) {
  const [catalog, setCatalog] = useState<Gift[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [to, setTo] = useState<string | undefined>();
  const [giftId, setGiftId] = useState<string | undefined>();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const key = useRef(newId()); // reused across retries of the same selection

  // Everyone seated, you included (self-gifting is allowed).
  const recipients = seats.filter((x) => x.occupant);
  const gift = catalog.find((g) => g.id === giftId);

  useEffect(() => {
    if (!visible) return;
    setTo(initialRecipient ?? recipients[0]?.occupant?.userId);
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

  async function submit() {
    setBusy(true);
    try {
      const r = await send(to!, giftId!, qty, key.current);
      setBalance(r.balance);
      key.current = newId();
      onClose();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const cost = (gift?.coinPrice ?? 0) * qty * (to === 'ALL' ? recipients.length : 1);
  return (
    <Sheet visible={visible} onClose={onClose} title="Send a gift">
      <Text style={s.label}>To someone on stage, or everyone</Text>
      {recipients.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(3) }}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: to === 'ALL' }}
            accessibilityLabel={`Everyone on stage, ${recipients.length} people`}
            onPress={() => setTo('ALL')}
            style={st.recipient}>
            <View style={[st.all, to === 'ALL' && st.allOn]}>
              <Users size={22} color={colors.text} />
            </View>
            <Text numberOfLines={1} style={[st.rName, to === 'ALL' && { color: colors.text }]}>
              All ({recipients.length})
            </Text>
          </Pressable>
          {recipients.map((x) => {
            const o = x.occupant!;
            const on = o.userId === to;
            return (
              <Pressable key={o.userId} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setTo(o.userId)} style={st.recipient}>
                <View>
                  <Avatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={48} ring={on ? colors.primary : undefined} />
                  {x.seatIndex === 0 ? (
                    <View style={st.ownerMark}>
                      <Crown size={11} color={colors.gold} fill={colors.gold} />
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={[st.rName, on && { color: colors.text }]}>
                  {o.userId === meId ? 'You' : o.displayName}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <Text style={s.muted}>Nobody is on a seat yet. Gifts can only go to people on stage.</Text>
      )}

      <View style={st.grid}>
        {catalog.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="radio"
            accessibilityLabel={`${g.name}, ${g.coinPrice} coins`}
            accessibilityState={{ selected: g.id === giftId }}
            onPress={() => {
              setGiftId(g.id);
              setQty((q) => Math.min(q, g.maxQuantity));
            }}
            style={[st.gift, g.id === giftId && st.giftOn]}>
            <View style={st.gArt}>
              <GiftArt gift={g} size={40} />
            </View>
            <Text style={st.gName}>{g.name}</Text>
            <View style={st.priceRow}>
              <Coins size={11} color={colors.gold} />
              <Text style={st.gPrice}>{g.coinPrice}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={st.qtyRow}>
        {[1, 5, 10, 99].filter((n) => !gift || n <= gift.maxQuantity).map((n) => (
          <Chip key={n} label={`×${n}`} active={qty === n} onPress={() => setQty(n)} />
        ))}
      </View>

      <View style={st.footer}>
        <View style={st.priceRow}>
          <Coins size={16} color={colors.gold} />
          <Text style={st.balance}>{balance ?? '—'}</Text>
        </View>
        <Button
          title={`Send · ${cost}`}
          onPress={submit}
          loading={busy}
          disabled={!to || !toSeated || !gift || (balance !== null && cost > balance)}
          style={{ flex: 1 }}
        />
      </View>
    </Sheet>
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
        <Text style={{ fontWeight: '800' }}>{event.sender.displayName}</Text> sent {event.gift.name}
        {event.quantity > 1 ? ` ×${event.quantity}` : ''} to <Text style={{ fontWeight: '800' }}>{event.recipient.displayName}</Text>
      </Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  recipient: { alignItems: 'center', width: 64, gap: 4 },
  ownerMark: { position: 'absolute', top: -4, right: -2, backgroundColor: colors.bg, borderRadius: 9, padding: 2 },
  gArt: { height: 44, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  all: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  allOn: { borderColor: colors.primary },
  rName: { color: colors.muted, fontSize: 11, maxWidth: 64 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  gift: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: space(2),
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  giftOn: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  gName: { color: colors.text, fontSize: 12, fontWeight: '600' },
  gPrice: { color: colors.gold, fontSize: 11 },
  qtyRow: { flexDirection: 'row', gap: space(2) },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  balance: { color: colors.gold, fontWeight: '700' },
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
