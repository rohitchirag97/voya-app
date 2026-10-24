import React, { createContext, useContext } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, radius, roomColors, space, tintPairFor, type Palette } from '../theme';
import { Gradient, LightBackdrop, RoomBackdrop } from './Gradient';
import { imageUri } from '../api';

// Screens are light; everything rendered inside <RoomTheme> (the room and its sheets) uses the dark palette.
const DarkUi = createContext(false);
// Shown until someone uploads their own picture. Source: assets/avatars/default.svg.
const DEFAULT_AVATAR = require('../../assets/avatars/default.png');
export const RoomTheme = ({ children }: { children: React.ReactNode }) => <DarkUi.Provider value={true}>{children}</DarkUi.Provider>;
export const usePalette = () => (useContext(DarkUi) ? roomColors : colors);
const useStyles = () => (useContext(DarkUi) ? rs : s);

export const toast = (msg: string) => (Platform.OS === 'android' ? ToastAndroid.show(msg, ToastAndroid.SHORT) : Alert.alert(msg));

// top/bottom = false: the screen draws under that system bar itself (e.g. a full-bleed cover image).
// backdropTheme: the room's chosen background preset (dark/room screens only).
export function Screen({ children, style, backdrop, backdropTheme, top = true, bottom = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; backdrop?: boolean; backdropTheme?: string | null; top?: boolean; bottom?: boolean }) {
  const i = useSafeAreaInsets();
  const s = useStyles();
  const dark = useContext(DarkUi);
  // RN 0.88 is edge-to-edge, so Android no longer resizes the window for the keyboard; every screen pads itself.
  // Insets go on the outer view: KeyboardAvoidingView overwrites its own paddingBottom.
  return (
    <View style={[s.screen, { paddingTop: top ? i.top : 0, paddingBottom: bottom ? i.bottom : 0 }]}>
      {backdrop ? dark ? <RoomBackdrop theme={backdropTheme} /> : <LightBackdrop /> : null}
      <KeyboardAvoidingView behavior="padding" style={[{ flex: 1 }, style]}>
        {children}
      </KeyboardAvoidingView>
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  icon,
  ...rest
}: { title: string; loading?: boolean; variant?: 'primary' | 'ghost' | 'danger'; style?: StyleProp<ViewStyle>; icon?: React.ReactNode } & PressableProps) {
  const off = disabled || loading;
  const s = useStyles();
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [s.btn, variant === 'ghost' && s.ghost, off && s.btnOff, pressed && s.pressed, style]}
      {...rest}>
      {variant !== 'ghost' ? <Gradient colors={variant === 'danger' ? gradients.danger : gradients.primary} style={StyleSheet.absoluteFill} /> : null}
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? c.text : '#fff'} />
      ) : (
        <View style={s.btnRow}>
          {icon}
          <Text style={[s.btnText, variant === 'ghost' && { color: c.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Round icon button: frosted glass by default, gradient for the main actions.
export function IconButton({
  onPress,
  label,
  children,
  size = 40,
  tone = 'glass',
  style,
}: {
  onPress?: () => void;
  label: string;
  children: React.ReactNode;
  size?: number;
  tone?: 'glass' | 'primary' | 'danger' | 'gold';
  style?: StyleProp<ViewStyle>;
}) {
  const s = useStyles();
  const grad = tone === 'primary' ? gradients.primary : tone === 'danger' ? gradients.danger : tone === 'gold' ? gradients.gold : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
        !grad && s.glass,
        pressed && s.pressed,
        style,
      ]}>
      {grad ? <Gradient colors={grad} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </Pressable>
  );
}

export const Field = React.forwardRef<React.ComponentRef<typeof TextInput>, TextInputProps & { label?: string }>(({ label, style, ...p }, ref) => {
  const s = useStyles();
  return (
    <View style={{ gap: space(2) }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput ref={ref} placeholderTextColor={usePalette().muted} style={[s.field, style]} {...p} />
    </View>
  );
});

// The person's photo when they have one (`uri`: a server path like /v1/uploads/x.png), else their initial on a gradient.
export function Avatar({ id, name, size = 44, ring, uri }: { id: string; name?: string | null; size?: number; ring?: string; uri?: string | null }) {
  const inner = ring ? size - 6 : size;
  if (uri)
    return (
      <View accessibilityLabel={name ?? undefined} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 3 : 0, borderColor: ring }}>
        <Image source={{ uri: imageUri(uri) }} style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: tintPairFor(id)[0] }} />
      </View>
    );
  return (
    <View accessibilityLabel={name ?? undefined} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 3 : 0, borderColor: ring }}>
      <Image source={DEFAULT_AVATAR} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const s = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export const SHEET_HERO = 96;
export const SHEET_BG_HEIGHT = 150;

// `hero` (e.g. a profile picture) sits centered on the sheet's top edge: half above, half inside.
export function Sheet({ visible, onClose, children, title, hero, background }: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  hero?: React.ReactNode;
  background?: React.ReactNode; // artwork behind the top of the sheet, clipped to its rounded corners
}) {
  const i = useSafeAreaInsets();
  const s = useStyles();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: i.bottom + space(4) }, hero ? { paddingTop: SHEET_HERO / 2 + space(2) } : null]}>
        {background ? (
          <View style={s.sheetBg} pointerEvents="none">
            {background}
          </View>
        ) : null}
        {hero ? (
          <View style={s.hero} pointerEvents="box-none">
            {hero}
          </View>
        ) : (
          <View style={s.grabber} />
        )}
        {title ? <Text style={s.sheetTitle}>{title}</Text> : null}
        {children}
      </View>
    </Modal>
  );
}

export function SheetAction({ label, onPress, danger, icon }: { label: string; onPress: () => void; danger?: boolean; icon?: React.ReactNode }) {
  const s = useStyles();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.action, pressed && s.pressed]}>
      {icon ? <View style={s.actionIcon}>{icon}</View> : null}
      <Text style={[s.actionText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { color: colors.text, fontSize: 28, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 20, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  label: { color: colors.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
  btn: { height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(6), overflow: 'hidden' },
  ghost: { backgroundColor: colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder },
  glass: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  btnOff: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    color: colors.text,
    fontSize: 17,
    paddingHorizontal: space(4),
  },
  chip: {
    paddingHorizontal: space(4),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipText: { color: colors.muted, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.glassBorder,
    padding: space(4),
    gap: space(3),
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  sheetBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_BG_HEIGHT,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  hero: { position: 'absolute', top: -96 / 2, left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  action: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(4), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  actionIcon: { width: 22, alignItems: 'center' },
  actionText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});

// Light styles for app screens; rs = the same styles in the room's dark palette.
export const s = makeStyles(colors);
export const rs = makeStyles(roomColors);
