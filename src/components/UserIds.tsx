import Clipboard from '@react-native-clipboard/clipboard';
import { Copy, Gem } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { gradients, radius } from '../theme';
import { Gradient } from './Gradient';
import { toast, usePalette } from './ui';

// One ID per user: the special ID (gold pill) when they own one, otherwise the regular 10-digit ID. Tap the icon to copy it.
// `light`: white text and icon, for use over a cover image.
export function UserIds({ publicId, specialId, light }: { publicId?: number; specialId?: string | null; light?: boolean }) {
  const p = usePalette();
  const c = light ? { ...p, muted: 'rgba(255,255,255,0.88)' } : p;
  if (!publicId) return null;
  const id = specialId ?? String(publicId);
  const copy = () => {
    Clipboard.setString(id);
    toast('ID copied');
  };
  return (
    <View style={st.row}>
      {specialId ? (
        <Gradient colors={gradients.gold} style={st.special}>
          <Gem size={12} color="#7A3E00" strokeWidth={2.6} />
          <Text style={st.specialText} accessibilityLabel={`Special ID ${specialId}`}>
            {specialId}
          </Text>
        </Gradient>
      ) : (
        <Text style={[st.id, { color: c.muted }]} accessibilityLabel={`ID ${publicId}`}>
          ID {publicId}
        </Text>
      )}
      <Pressable onPress={copy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Copy ID" style={({ pressed }) => pressed && { opacity: 0.5 }}>
        <Copy size={15} color={c.muted} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  special: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  specialText: { color: '#5A2D00', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  id: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
});
