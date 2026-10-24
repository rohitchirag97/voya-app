import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { roomColors as colors } from '../theme';
import type { GiftEvent } from './useRoom';

const SPARKLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 20 20"><path d="M0,-10 L2.5,-2.5 L10,0 L2.5,2.5 L0,10 L-2.5,2.5 L-10,0 L-2.5,-2.5 Z" fill="#FFF4B0"/></svg>`;
const BURST = 12;

// Full-screen gift animation for gifts that have SVG artwork. The artwork comes from the
// gift catalog; the motion is a preset named by the gift's `animation` ("launch", else "pop").
export function GiftAnimation({ event }: { event: GiftEvent | undefined }) {
  if (!event?.gift.svg) return null;
  return event.gift.animation === 'launch' ? (
    <Launch key={event.transactionId} svg={event.gift.svg} quantity={event.quantity} />
  ) : (
    <Pop key={event.transactionId} svg={event.gift.svg} quantity={event.quantity} />
  );
}

// Rocket-style: rises from below with a wobble, bursts sparkles mid-screen, exits at the top.
function Launch({ svg, quantity }: { svg: string; quantity: number }) {
  const { height } = useWindowDimensions();
  const rise = useRef(new Animated.Value(0)).current;
  const wobble = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shake = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(wobble, { toValue: -1, duration: 120, useNativeDriver: true }),
      ]),
    );
    shake.start();
    Animated.parallel([
      Animated.timing(rise, { toValue: 1, duration: 2600, easing: Easing.bezier(0.45, 0, 0.6, 1), useNativeDriver: true }),
      Animated.sequence([Animated.delay(1000), Animated.timing(burst, { toValue: 1, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true })]),
    ]).start(() => shake.stop());
    return () => shake.stop();
  }, [rise, wobble, burst]);

  const size = 150;
  const translateY = rise.interpolate({ inputRange: [0, 0.45, 0.6, 1], outputRange: [height * 0.55, 0, -20, -height * 0.8] });
  const scale = rise.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.6, 1.15, 0.8] });
  const translateX = wobble.interpolate({ inputRange: [-1, 1], outputRange: [-4, 4] });
  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-2deg', '2deg'] });

  return (
    <View style={st.layer} pointerEvents="none">
      <Sparkles progress={burst} radius={170} />
      <Animated.View style={{ transform: [{ translateY }, { translateX }, { rotate }, { scale }] }}>
        <SvgXml xml={svg} width={size} height={size * (200 / 120)} />
      </Animated.View>
      <Quantity quantity={quantity} progress={burst} />
    </View>
  );
}

// Generic: springs in at the centre, sparkles, then fades.
function Pop({ svg, quantity }: { svg: string; quantity: number }) {
  const t = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(t, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [t, fade]);
  return (
    <Animated.View style={[st.layer, { opacity: fade }]} pointerEvents="none">
      <Sparkles progress={t} radius={130} />
      <Animated.View style={{ transform: [{ scale: t }] }}>
        <SvgXml xml={svg} width={160} height={160} />
      </Animated.View>
      <Quantity quantity={quantity} progress={t} />
    </Animated.View>
  );
}

function Sparkles({ progress, radius }: { progress: Animated.Value; radius: number }) {
  return (
    <>
      {Array.from({ length: BURST }, (_, i) => {
        const a = (i / BURST) * Math.PI * 2;
        const r = radius * (i % 2 ? 0.75 : 1);
        return (
          <Animated.View
            key={i}
            style={[
              st.spark,
              {
                opacity: progress.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(a) * r] }) },
                  { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(a) * r] }) },
                  { scale: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1.2, 0.6] }) },
                ],
              },
            ]}>
            <SvgXml xml={SPARKLE} width={i % 2 ? 16 : 24} height={i % 2 ? 16 : 24} />
          </Animated.View>
        );
      })}
    </>
  );
}

function Quantity({ quantity, progress }: { quantity: number; progress: Animated.Value }) {
  if (quantity < 2) return null;
  return (
    <Animated.Text style={[st.qty, { opacity: progress.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] }) }]}>
      ×{quantity}
    </Animated.Text>
  );
}

const st = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 50, elevation: 50 },
  spark: { position: 'absolute' },
  qty: {
    position: 'absolute',
    bottom: '30%',
    color: colors.gold,
    fontSize: 44,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowRadius: 8,
  },
});

