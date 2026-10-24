import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';

// Animated emotes. Anyone in the room can send one; it plays over the sender's seat (when seated) and fades,
// while the line stays in chat. The server draws dice / roller / coin results. Animations are drawn in code.
export type EmoteKey = 'hand' | 'smile' | 'kiss' | 'angry' | 'dice' | 'roller' | 'coin' | 'heart';
export const EMOTES: { key: EmoteKey; icon: string; label: string }[] = [
  { key: 'hand', icon: '✋', label: 'Raise hand' },
  { key: 'smile', icon: '😊', label: 'Smile' },
  { key: 'kiss', icon: '😘', label: 'Flying kiss' },
  { key: 'angry', icon: '😠', label: 'Angry' },
  { key: 'dice', icon: '🎲', label: 'Dice' },
  { key: 'roller', icon: '🎰', label: 'Roller' },
  { key: 'coin', icon: '🪙', label: 'Coin flip' },
  { key: 'heart', icon: '❤️', label: 'Heart' },
];
const RANDOM: EmoteKey[] = ['dice', 'roller', 'coin'];
const ROLL_MS = 1300; // dice / roller / coin spin this long before showing the result
export const emoteMs = (e: EmoteKey) => (RANDOM.includes(e) ? 3800 : 2800); // how long it stays on the seat

export function EmoteSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (e: EmoteKey) => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Emotes">
      <View style={st.grid}>
        {EMOTES.map((e) => (
          <Pressable
            key={e.key}
            onPress={() => onPick(e.key)}
            accessibilityRole="button"
            accessibilityLabel={e.label}
            style={({ pressed }) => [st.cell, pressed && { transform: [{ scale: 0.92 }], backgroundColor: colors.glassStrong }]}>
            <Text style={st.cellIcon}>{e.icon}</Text>
            <Text style={st.cellLabel} numberOfLines={1}>
              {e.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

// Plays once over a seat avatar of `size`; keyed by message id by the caller so each emote restarts it.
export function EmoteBurst({ emote, result, size }: { emote: EmoteKey; result?: string; size: number }) {
  const total = emoteMs(emote);
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: total, easing: Easing.linear, useNativeDriver: true }).start();
  }, [t, total]);
  const opacity = t.interpolate({ inputRange: [0, 0.05, 0.88, 1], outputRange: [0, 1, 1, 0] });
  const box = Math.max(size, 48);
  return (
    <Animated.View pointerEvents="none" style={[st.burst, { width: box * 1.6, height: box * 1.6, opacity }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {emote === 'dice' ? <Dice result={Number(result) || 1} size={box * 0.72} /> : emote === 'roller' ? <Roller result={result ?? '000'} size={box} /> : emote === 'coin' ? <Coin result={result === 'Tails' ? 'T' : 'H'} size={box * 0.74} /> : <Face emote={emote} size={box} />}
    </Animated.View>
  );
}

// ---------- reactions ----------

function Face({ emote, size }: { emote: EmoteKey; size: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    const fast = emote === 'angry';
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: fast ? 160 : 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pop, wave, emote]);
  const swing = (a: number | string, b: number | string) => wave.interpolate({ inputRange: [0, 0.5, 1], outputRange: [a, b, a] as any });
  const motion =
    emote === 'hand'
      ? [{ rotate: swing('-20deg', '20deg') }]
      : emote === 'angry'
        ? [{ translateX: swing(-3, 3) }]
        : emote === 'heart'
          ? [{ scale: swing(1, 1.18) }]
          : [{ translateY: swing(0, -5) }];
  const icon = EMOTES.find((e) => e.key === emote)!.icon;
  return (
    <View style={st.center}>
      <Animated.Text style={[{ fontSize: size * 0.72 }, { transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, ...motion] }]}>
        {icon}
      </Animated.Text>
      {emote === 'angry' ? <Text style={[st.corner, { fontSize: size * 0.3 }]}>💢</Text> : null}
      {emote === 'kiss' || emote === 'heart'
        ? [0, 1, 2, 3].map((i) => <Floater key={i} delay={250 + i * 380} x={(i % 2 ? 1 : -1) * size * (0.18 + 0.08 * i)} rise={size * 0.9} char={emote === 'kiss' ? (i % 2 ? '💋' : '💗') : '💗'} size={size * 0.26} />)
        : null}
    </View>
  );
}

// A small heart that drifts up and fades.
function Floater({ delay, x, rise, char, size }: { delay: number; x: number; rise: number; char: string; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true })]).start();
  }, [v, delay]);
  return (
    <Animated.Text
      style={[
        st.float,
        { fontSize: size },
        {
          opacity: v.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateX: x }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }],
        },
      ]}>
      {char}
    </Animated.Text>
  );
}

// ---------- random results ----------

// Ticks while rolling, then stops: `done` flips after ROLL_MS (+ extra).
function useRoll(every: number, extra = 0) {
  const [tick, setTick] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), every);
    const stop = setTimeout(() => {
      clearInterval(id);
      setDone(true);
    }, ROLL_MS + extra);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [every, extra]);
  return { tick, done };
}

// Result pops in with a little bounce once the roll stops.
function useLand(done: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (done) Animated.spring(v, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
  }, [done, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

function Dice({ result, size }: { result: number; size: number }) {
  const { tick, done } = useRoll(90);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(spin, { toValue: 1, duration: ROLL_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [spin]);
  const land = useLand(done);
  const face = done ? result : ((tick * 7 + 3) % 6) + 1; // looks random, stays deterministic per tick
  const pip = size * 0.18;
  return (
    <Animated.View
      style={[
        st.die,
        { width: size, height: size, borderRadius: size * 0.22 },
        { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '720deg'] }) }, { scale: land }] },
      ]}>
      {Array.from({ length: 9 }, (_, i) => (
        <View key={i} style={[st.pipCell, { width: size / 3.4, height: size / 3.4 }]}>
          {PIPS[face]!.includes(i) ? <View style={{ width: pip, height: pip, borderRadius: pip / 2, backgroundColor: face === 1 ? colors.danger : '#2A1A4A' }} /> : null}
        </View>
      ))}
    </Animated.View>
  );
}

// Three reels, 000-999, that stop one after another.
function Roller({ result, size }: { result: string; size: number }) {
  const { tick, done } = useRoll(60, 400);
  const land = useLand(done);
  const stops = [ROLL_MS - 400, ROLL_MS, ROLL_MS + 400];
  const digits = [...result].map((d, i) => (done || tick * 60 >= stops[i]! ? d : String((tick * (3 + i * 2) + i * 4) % 10)));
  const w = size * 0.36;
  return (
    <Animated.View style={[st.reels, { transform: [{ scale: land }] }]}>
      {digits.map((d, i) => (
        <View key={i} style={[st.reel, { width: w, height: w * 1.3 }]}>
          <Text style={[st.reelText, { fontSize: w * 0.85 }]}>{d}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

function Coin({ result, size }: { result: 'H' | 'T'; size: number }) {
  const { tick, done } = useRoll(110);
  const flip = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (done) return;
    const loop = Animated.loop(Animated.timing(flip, { toValue: 1, duration: 220, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => {
      loop.stop();
      flip.setValue(0);
    };
  }, [done, flip]);
  const land = useLand(done);
  const face = done ? result : tick % 2 ? 'T' : 'H';
  return (
    <View style={st.center}>
      <Animated.View
        style={[
          st.coin,
          { width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.07 },
          { transform: [{ scaleX: flip.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.08, 1] }) }, { translateY: done ? 0 : -size * 0.15 }, { scale: land }] },
        ]}>
        <Text style={[st.coinText, { fontSize: size * 0.48 }]}>{face}</Text>
      </Animated.View>
      {done ? <Text style={st.coinLabel}>{result === 'H' ? 'Heads' : 'Tails'}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space(3), marginHorizontal: -space(1) },
  cell: { width: '25%', alignItems: 'center', gap: space(1), paddingVertical: space(3), borderRadius: radius.md },
  cellIcon: { fontSize: 34 },
  cellLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  // Android stacks by elevation before zIndex: stay above the owner seat's glow (elevation 10).
  burst: { position: 'absolute', alignItems: 'center', justifyContent: 'center', zIndex: 5, elevation: 20 },
  center: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', top: '4%', right: '8%' },
  float: { position: 'absolute' },
  die: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E3DBFF',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pipCell: { alignItems: 'center', justifyContent: 'center' },
  reels: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 8, backgroundColor: '#1B1035', borderWidth: 1.5, borderColor: colors.gold, elevation: 6 },
  reel: { alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: '#2C1C55' },
  reelText: { color: colors.gold, fontWeight: '900', fontVariant: ['tabular-nums'] },
  coin: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7C843', borderColor: '#C98A12', elevation: 6 },
  coinText: { color: '#8A5300', fontWeight: '900' },
  coinLabel: { position: 'absolute', bottom: -4, color: '#fff', fontSize: 11, fontWeight: '900', paddingHorizontal: 6, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.6)' },
});
