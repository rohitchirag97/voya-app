import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, type Palette } from '../theme';
import { usePalette } from './ui';

// Display-only copy of the server's layouts; the room screen renders the server's rowLayout.
export const LAYOUTS: Record<number, number[]> = { 8: [4, 4], 10: [5, 5], 12: [4, 4, 4], 16: [4, 4, 4, 4], 20: [5, 5, 5, 5] };

// The 8/10/12/16/20 choice with a dot preview of each layout (used on create and in the room).
// Shown on light screens and in the dark room, so colours come from the current palette.
export function SeatLayoutPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const colors = usePalette();
  const st = styles(colors);
  return (
    <View style={st.wrapRow}>
      {Object.keys(LAYOUTS).map(Number).map((n) => (
        <Pressable
          key={n}
          accessibilityRole="radio"
          accessibilityState={{ selected: n === value }}
          accessibilityLabel={`${n} seats, ${LAYOUTS[n].join(' plus ')}`}
          onPress={() => onChange(n)}
          style={[st.cap, n === value && st.capOn]}>
          <Text style={[st.capNum, n === value && { color: colors.text }]}>{n}</Text>
          <LayoutPreview rows={LAYOUTS[n]} active={n === value} colors={colors} />
        </Pressable>
      ))}
    </View>
  );
}

function LayoutPreview({ rows, active, colors }: { rows: number[]; active: boolean; colors: Palette }) {
  let i = 0;
  return (
    <View style={{ gap: 3 }}>
      {rows.map((cols, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 3, justifyContent: 'center' }}>
          {Array.from({ length: cols }, () => {
            const host = i++ === 0;
            return <View key={i} style={[{ width: 8, height: 8, borderRadius: 4 }, { backgroundColor: host ? colors.gold : active ? colors.primary : colors.border }]} />;
          })}
        </View>
      ))}
    </View>
  );
}

const styles = (colors: Palette) =>
  StyleSheet.create({
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  cap: {
    width: 96,
    paddingVertical: space(3),
    alignItems: 'center',
    gap: space(2),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  capOn: { borderColor: colors.primary, backgroundColor: colors.primaryDim },
  capNum: { color: colors.muted, fontSize: 20, fontWeight: '800' },
});
