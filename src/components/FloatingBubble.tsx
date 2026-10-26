import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Where each bubble was last left (by id), for the app's lifetime, so it reappears in the same spot.
const spots = new Map<string, { x: number; y: number }>();
const EDGE = 12, DRAG_SLOP = 6;
// Default height of the minimized room's bubble above the bottom edge; the game's bubble starts just above it.
export const DOCK_BOTTOM = 136;

// A draggable floating bubble (the minimized room, the minimized game, the friends-online pill). Starts on the right,
// `bottom` points above the screen's bottom edge; drag it anywhere and it snaps to the nearest side inside the safe
// area. Taps on its children (open / close buttons) still work: dragging only starts once the finger has really moved.
// `size` is its height (and width, unless `w` makes it a wider pill).
export function FloatingBubble({ id, size, w, bottom, left, children }: { id: string; size: number; w?: number; bottom: number; left?: boolean; children: React.ReactNode }) {
  const boxW = w ?? size;
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clampY = (y: number) => Math.min(height - insets.bottom - size - EDGE, Math.max(insets.top + EDGE, y));
  const start = spots.get(id) ?? { x: left ? EDGE : width - boxW - EDGE, y: height - insets.bottom - bottom - size }; // `left`: start on the left side
  const pos = useRef(new Animated.ValueXY({ x: start.x, y: clampY(start.y) })).current;
  const cur = useRef({ x: start.x, y: clampY(start.y) });
  useEffect(() => {
    const sub = pos.addListener((v) => (cur.current = v));
    return () => pos.removeListener(sub);
  }, [pos]);

  const snap = (x: number, y: number) => {
    const to = { x: x + boxW / 2 < width / 2 ? EDGE : width - boxW - EDGE, y: clampY(y) };
    spots.set(id, to);
    Animated.spring(pos, { toValue: to, friction: 7, tension: 60, useNativeDriver: false }).start();
  };
  // Also re-snap after the screen size changes, or the pill grows or shrinks (it stays against its side).
  useEffect(() => snap(cur.current.x, cur.current.y), [width, height, boxW]); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > DRAG_SLOP,
        onPanResponderGrant: () => {
          pos.setOffset(cur.current);
          pos.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => {
          pos.flattenOffset();
          snap(cur.current.x, cur.current.y);
        },
        onPanResponderTerminate: () => {
          pos.flattenOffset();
          snap(cur.current.x, cur.current.y);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height, insets.top, insets.bottom, boxW],
  );

  return (
    <Animated.View style={[st.wrap, { width: boxW, height: size, transform: pos.getTranslateTransform() }]} {...drag.panHandlers}>
      {children}
    </Animated.View>
  );
}

const st = StyleSheet.create({ wrap: { position: 'absolute', left: 0, top: 0 } });
