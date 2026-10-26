import { ChevronLeft, Phone } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { auth, errorText } from '../api';
import { LogoMark } from '../components/Logo';
import { Button, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { showIfBanned } from '../components/BanNotice';
import { colors, radius, space } from '../theme';

// link: adding a phone to the signed-in account (from Settings) instead of signing in.
// changeToken: entering the new number while changing it (the current one is already verified).
export function LoginScreen({ link, changeToken }: { link?: boolean; changeToken?: string }) {
  const nav = useNav();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(digits);

  async function next() {
    const phone = '+91' + digits;
    setBusy(true);
    try {
      const { devCode } = await auth.requestOtp(phone);
      nav.push({ name: 'otp', phone, devCode, purpose: changeToken ? 'change' : link ? 'link' : undefined, changeToken });
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setGoogleBusy(true);
    try {
      const me = await auth.google();
      if (!me) return;
      nav.setMe(me);
      nav.reset(me.displayName ? { name: 'home' } : { name: 'profile' });
    } catch (e) {
      if (!showIfBanned(e)) toast(errorText(e));
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <LoginWaves />
      <View style={st.wrap}>
        {link && (
          <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
            <ChevronLeft size={28} color={colors.text} />
          </Pressable>
        )}
        <View style={st.hero}>
          <LoginArt />
          <View style={st.logo}>
            <LogoMark size={96} />
          </View>
          <Text style={s.h1}>{changeToken ? 'New phone number' : link ? 'Add phone number' : 'VoyaLive'}</Text>
          <Text style={[s.muted, { textAlign: 'center' }]}>
            {changeToken
              ? 'You will sign in with this number from now on.'
              : link
                ? 'You can then sign in with your phone or Google.'
                : 'Hop on a seat, talk, and hang out live.'}
          </Text>
        </View>
        <View style={{ gap: space(4) }}>
          <Text style={s.label}>Mobile number</Text>
          {/* One pill: country code and number share a single field. */}
          <View style={[st.phone, valid && st.phoneValid]}>
            <Phone size={18} color={colors.muted} />
            <Text style={st.code}>+91</Text>
            <View style={st.divider} />
            <TextInput
              style={st.input}
              value={digits}
              onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="phone-pad"
              placeholder="98765 43210"
              placeholderTextColor={colors.muted}
              maxLength={10}
              autoFocus
              accessibilityLabel="Mobile number"
            />
          </View>
          <Button title="Send code" onPress={next} disabled={!valid} loading={busy} />
          {!link && (
            <>
              <View style={st.or}>
                <View style={st.orLine} />
                <Text style={s.muted}>or</Text>
                <View style={st.orLine} />
              </View>
              <Button title="Continue with Google" variant="ghost" icon={<GoogleG />} onPress={google} loading={googleBusy} disabled={busy} />
              <Text style={[s.muted, { fontSize: 12, textAlign: 'center' }]}>
                By continuing you agree to the Terms and Privacy Policy.
              </Text>
            </>
          )}
        </View>
      </View>
    </Screen>
  );
}

// Seats floating around the logo: x, y, radius, gradient pair, speaking?
const SEATS: [number, number, number, [string, string], boolean][] = [
  [72, 165, 30, ['#FF3D8B', '#F97316'], true],
  [326, 140, 25, ['#8B5CF6', '#3B82F6'], false],
  [200, 95, 20, ['#06B6D4', '#10B981'], false],
  [48, 400, 23, ['#D946EF', '#8B5CF6'], false],
  [350, 385, 31, ['#3B82F6', '#06B6D4'], true],
  [130, 470, 16, ['#F43F5E', '#FF3D8B'], false],
  [282, 478, 18, ['#10B981', '#06B6D4'], false],
];
const CONFETTI: [number, number, string][] = [
  [130, 110, '#FF3D8B'], [270, 60, '#8B5CF6'], [380, 250, '#F5A623'], [20, 270, '#06B6D4'],
  [250, 200, '#F5A623'], [110, 320, '#10B981'], [300, 290, '#FF3D8B'], [372, 520, '#8B5CF6'], [24, 520, '#F5A623'],
];
const NOTE = 'M0 0v-16l12-3v15 M0 0a4 3 0 1 1-1-0.1 M12-4a4 3 0 1 1-1-0.1';
const HEART = 'M0 4C-7-1-9-6-6-9c2-2 5-1 6 1 1-2 4-3 6-1 3 3 1 8-6 13z';

// Login background art: a live room in the air — sound rings around the logo, guests on seats, confetti.
// It fills the hero only, so when the keyboard shrinks the hero the art is cropped instead of sliding over the form.
// The viewBox centre sits below the rings' centre because the logo sits above the hero's centre (title and tagline below it).
function LoginArt() {
  return (
    <View style={st.art} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 64 400 560" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {SEATS.map(([, , , [a, b]], i) => (
            <LinearGradient key={i} id={`laSeat${i}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={a} />
              <Stop offset="1" stopColor={b} />
            </LinearGradient>
          ))}
        </Defs>
        {[95, 140, 190, 245].map((r, i) => (
          <Circle key={r} cx="200" cy="300" r={r} fill="none" stroke={i % 2 ? '#8B5CF6' : '#FF3D8B'} strokeOpacity={0.16 - i * 0.03} strokeWidth="1.5" strokeDasharray={i % 2 ? '4 8' : undefined} />
        ))}
        {CONFETTI.map(([x, y, c], i) => (
          <Rect key={i} x={x} y={y} width="8" height="4" rx="2" fill={c} opacity="0.45" transform={`rotate(${i * 37} ${x + 4} ${y + 2})`} />
        ))}
        <G transform="translate(282 232)"><Path d={NOTE} stroke="#8B5CF6" strokeOpacity="0.4" strokeWidth="2.5" fill="none" /></G>
        <G transform="translate(96 252) scale(0.8)"><Path d={NOTE} stroke="#FF3D8B" strokeOpacity="0.35" strokeWidth="2.5" fill="none" /></G>
        <G transform="translate(318 470)"><Path d={HEART} fill="#FF3D8B" opacity="0.35" /></G>
        <G transform="translate(70 90) scale(0.7)"><Path d={HEART} fill="#8B5CF6" opacity="0.3" /></G>
        {SEATS.map(([x, y, r, , speaking], i) => (
          <G key={i} transform={`translate(${x} ${y})`}>
            {speaking && <Circle r={r + 7} fill="none" stroke="#FF3D8B" strokeOpacity="0.3" strokeWidth="2" />}
            <Circle r={r} fill={`url(#laSeat${i})`} stroke="#fff" strokeWidth="3" />
            <Circle cy={-r * 0.28} r={r * 0.3} fill="#fff" opacity="0.92" />
            <Path d={`M${-r * 0.55} ${r * 0.62}A${r * 0.55} ${r * 0.5} 0 0 1 ${r * 0.55} ${r * 0.62}Z`} fill="#fff" opacity="0.92" />
            {speaking && <Circle cx={r * 0.72} cy={r * 0.72} r="5" fill="#10B981" stroke="#fff" strokeWidth="2" />}
          </G>
        ))}
      </Svg>
    </View>
  );
}

// Soft waves along the bottom of the screen, behind the form.
function LoginWaves() {
  return (
    <View style={st.waves} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 560 400 240" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="laWave" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FF3D8B" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#8B5CF6" stopOpacity="0.12" />
          </LinearGradient>
        </Defs>
        <Path d="M0 600C90 560 170 640 260 600S380 560 400 575V800H0Z" fill="url(#laWave)" />
        <Path d="M0 650C110 620 200 690 300 650S390 630 400 640V800H0Z" fill="url(#laWave)" />
      </Svg>
    </View>
  );
}

// Google's four-colour "G" mark.
function GoogleG() {
  return (
    <Svg width={20} height={20} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const st = StyleSheet.create({
  // Bleeds past the page padding to the screen edges.
  art: { position: 'absolute', top: 0, bottom: 0, left: -space(6), right: -space(6) },
  waves: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 },
  or:{ flexDirection: 'row', alignItems: 'center', gap: space(3) },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  wrap: { flex: 1, padding: space(6) },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(3) },
  logo: { marginBottom: space(2) },
  phone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    height: 56,
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  phoneValid: { borderColor: colors.primary },
  code: { color: colors.text, fontSize: 17, fontWeight: '800' },
  divider: { width: 1, height: 24, backgroundColor: colors.glassBorder },
  input: { flex: 1, height: 56, color: colors.text, fontSize: 17, fontWeight: '600', letterSpacing: 1 },
});
