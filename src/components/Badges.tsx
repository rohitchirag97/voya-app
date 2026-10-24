import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors, radius, space } from '../theme';
import { showDialog } from './Dialog';

export type Badge = { id: string; name: string; description: string; svg: string; expiresAt: string | null };

// "Expires in 3 days" / "Expires today" / "Never expires".
export function expiryText(expiresAt: string | null) {
  if (!expiresAt) return 'Never expires';
  const ms = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
}

export const showBadgeDetails = (b: Badge) =>
  showDialog({
    title: b.name,
    message: `${b.description}\n\n${expiryText(b.expiresAt)}${b.expiresAt ? ` (${new Date(b.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}`,
    art: <SvgXml xml={b.svg} width={96} height={96} />,
    actions: [{ label: 'Close', value: 'ok', kind: 'primary' }],
  });

// Compact row of badge icons (profile card). Tap one for details. `tile`: each icon sits in an equal rounded tile, row centred.
export function BadgeRow({ badges, size = 34, tile }: { badges: Badge[]; size?: number; tile?: boolean }) {
  if (!badges.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[st.row, tile && st.rowFlush]}>
      {badges.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => showBadgeDetails(b)}
          accessibilityRole="button"
          accessibilityLabel={`${b.name} badge. ${expiryText(b.expiresAt)}`}
          hitSlop={4}
          style={({ pressed }) => [tile && [st.tile, { width: size + 14, height: size + 14 }], pressed && { opacity: 0.7 }]}>
          <SvgXml xml={b.svg} width={size} height={size} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { gap: space(2), paddingHorizontal: space(1) },
  rowFlush: { paddingHorizontal: 0, flexGrow: 1, justifyContent: 'center' }, // centred while it fits, scrolls when it doesn't
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

