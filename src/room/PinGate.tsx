import { Lock } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gradient } from '../components/Gradient';
import { roomColors as colors, gradients, radius, space } from '../theme';

// Locked room: enter the 4-digit password. Submits on the 4th digit; a wrong one clears the boxes.
export function PinGate({ wrong, onSubmit, onCancel }: { wrong: boolean; onSubmit: (pin: string) => Promise<void>; onCancel: () => void }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  useEffect(() => {
    if (wrong) setPin('');
  }, [wrong]);

  async function change(t: string) {
    const digits = t.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    if (digits.length === 4) {
      setBusy(true);
      await onSubmit(digits);
      setBusy(false);
      setPin('');
    }
  }

  return (
    <View style={st.wrap}>
      <Gradient colors={gradients.primary} style={st.lock}>
        <Lock size={30} color="#fff" strokeWidth={2.4} />
      </Gradient>
      <Text style={st.title}>This room is locked</Text>
      <Text style={st.sub}>Enter the 4-digit password to join.</Text>
      <Pressable onPress={() => input.current?.focus()} accessibilityRole="button" accessibilityLabel={`Password, ${pin.length} of 4 digits entered`} style={st.boxes}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[st.box, i === pin.length && st.boxActive, wrong && !pin && st.boxWrong]}>
            <Text style={st.dot}>{pin[i] ? '●' : ''}</Text>
          </View>
        ))}
      </Pressable>
      {/* Hidden input behind the boxes: brings up the number pad. */}
      <TextInput
        ref={input}
        value={pin}
        onChangeText={change}
        keyboardType="number-pad"
        maxLength={4}
        autoFocus
        secureTextEntry
        editable={!busy}
        style={st.hidden}
        accessibilityLabel="Room password"
      />
      {busy ? <ActivityIndicator color={colors.primary} /> : wrong ? <Text style={st.error}>Wrong password. Try again.</Text> : <View style={{ height: 20 }} />}
      <Pressable onPress={onCancel} accessibilityRole="button" style={st.cancel}>
        <Text style={st.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(3), padding: space(6) },
  lock: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.muted, fontSize: 14 },
  boxes: { flexDirection: 'row', gap: space(3), marginTop: space(3) },
  box: { width: 54, height: 62, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  boxActive: { borderColor: colors.primary },
  boxWrong: { borderColor: colors.danger },
  dot: { color: colors.text, fontSize: 22 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  error: { color: '#FF8A95', fontSize: 13, fontWeight: '700' },
  cancel: { marginTop: space(4), paddingHorizontal: space(6), paddingVertical: space(2) },
  cancelText: { color: colors.muted, fontSize: 15, fontWeight: '800' },
});
