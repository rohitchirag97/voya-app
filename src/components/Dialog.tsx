import type { LucideIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, gradients, radius, space } from '../theme';
import { Gradient } from './Gradient';

// App-wide replacement for the native Alert: a rounded card with an icon (or artwork) and pill buttons.
type Action = { label: string; value: string; kind?: 'cancel' | 'primary' | 'danger' };
export type DialogOptions = {
  title: string;
  message?: string;
  Icon?: LucideIcon;
  tone?: 'primary' | 'danger' | 'gold';
  art?: React.ReactNode; // replaces the icon, e.g. an avatar or badge artwork
  actions: Action[];
  dismissable?: boolean; // tap outside / back button closes it (resolves null); default true
};
type Pending = DialogOptions & { resolve: (value: string | null) => void };

let enqueue: ((d: Pending) => void) | null = null;
const early: Pending[] = []; // shown once the host mounts

// Resolves with the tapped action's value, or null when dismissed.
export function showDialog(options: DialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const d = { ...options, resolve };
    if (enqueue) enqueue(d);
    else early.push(d);
  });
}

export async function confirmDialog(o: { title: string; message?: string; confirmText: string; cancelText?: string; danger?: boolean; Icon?: LucideIcon }) {
  const v = await showDialog({
    title: o.title,
    message: o.message,
    Icon: o.Icon,
    tone: o.danger ? 'danger' : 'primary',
    actions: [
      { label: o.cancelText ?? 'Cancel', value: 'cancel', kind: 'cancel' },
      { label: o.confirmText, value: 'ok', kind: o.danger ? 'danger' : 'primary' },
    ],
  });
  return v === 'ok';
}

const toneGradient = { primary: gradients.primary, danger: gradients.danger, gold: gradients.gold };
const toneHalo = { primary: 'rgba(255,61,139,0.12)', danger: 'rgba(239,68,68,0.12)', gold: 'rgba(245,166,35,0.16)' };

// Mount once at the app root. Dialogs queue up and show one at a time.
export function DialogHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const anim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  useEffect(() => {
    enqueue = (d) => setQueue((q) => [...q, d]);
    if (early.length) setQueue(early.splice(0));
    return () => {
      enqueue = null;
    };
  }, []);

  const cur = queue[0];
  useEffect(() => {
    if (!cur) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 90 }).start();
  }, [cur, anim]);

  if (!cur) return null;
  const close = (value: string | null) => {
    cur.resolve(value);
    setQueue((q) => q.slice(1));
  };
  const dismiss = () => {
    if (cur.dismissable !== false) close(null);
  };
  const tone = cur.tone ?? 'primary';
  const stacked = cur.actions.length > 2;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={st.backdrop} onPress={dismiss} accessibilityLabel="Close" />
      <View style={st.center} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[
            st.card,
            { width: Math.min(360, width - space(12)), opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] },
          ]}>
          {cur.art ? (
            <View style={st.art}>{cur.art}</View>
          ) : cur.Icon ? (
            <View style={[st.halo, { backgroundColor: toneHalo[tone] }]}>
              <Gradient colors={toneGradient[tone]} style={st.icon}>
                <cur.Icon size={28} color="#fff" strokeWidth={2.4} />
              </Gradient>
            </View>
          ) : null}
          <Text style={st.title} accessibilityRole="header">
            {cur.title}
          </Text>
          {cur.message ? <Text style={st.message}>{cur.message}</Text> : null}
          <View style={[st.actions, stacked && { flexDirection: 'column' }]}>
            {cur.actions.map((a) => (
              <Pressable
                key={a.value}
                onPress={() => close(a.value)}
                accessibilityRole="button"
                style={({ pressed }) => [st.btn, !stacked && { flex: 1 }, a.kind === 'cancel' || !a.kind ? st.btnCancel : null, pressed && { opacity: 0.8 }]}>
                {a.kind === 'primary' || a.kind === 'danger' ? (
                  <Gradient colors={a.kind === 'danger' ? gradients.danger : gradients.primary} style={st.btnFill} />
                ) : null}
                <Text style={[st.btnText, (a.kind === 'cancel' || !a.kind) && { color: colors.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(15,10,36,0.55)' },
  center: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: {
    alignItems: 'center',
    gap: space(2),
    paddingHorizontal: space(5),
    paddingTop: space(6),
    paddingBottom: space(5),
    borderRadius: 28,
    backgroundColor: colors.surface,
    elevation: 24,
    shadowColor: '#2B1466',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
  halo: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: space(2) },
  icon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  art: { marginBottom: space(2), alignItems: 'center' },
  title: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  actions: { flexDirection: 'row', alignSelf: 'stretch', gap: space(2), marginTop: space(4) },
  btn: { height: 50, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnCancel: { backgroundColor: colors.surfaceHigh },
  btnFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
