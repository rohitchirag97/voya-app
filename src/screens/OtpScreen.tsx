import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { auth, errorText } from '../api';
import { Button, Screen, s, toast } from '../components/ui';
import { useNav, type OtpPurpose } from '../nav';
import { showIfBanned } from '../components/BanNotice';
import { colors, radius, space } from '../theme';

export function OtpScreen({ phone, devCode, purpose, changeToken }: { phone: string; devCode?: string; purpose?: OtpPurpose; changeToken?: string }) {
  const nav = useNav();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  async function verify(c = code) {
    setBusy(true);
    try {
      if (purpose === 'verifyCurrent') {
        // Current number proven; this screen becomes the new-number entry, so Back from there returns to Settings.
        nav.replace({ name: 'linkPhone', changeToken: await auth.verifyCurrentPhone(c) });
        return;
      }
      if (purpose === 'link' || purpose === 'change') {
        if (purpose === 'link') await auth.linkPhone(phone, c);
        else await auth.changePhone(changeToken!, phone, c);
        toast(purpose === 'link' ? 'Phone number added' : 'Phone number changed');
        // Back past the number entry to Settings.
        nav.back();
        nav.back();
        return;
      }
      const me = await auth.verifyOtp(phone, c);
      nav.setMe(me);
      nav.reset(me.displayName ? { name: 'home' } : { name: 'profile' });
    } catch (e) {
      if (!showIfBanned(e)) toast(errorText(e));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.wrap}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <Text style={st.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.h1}>{purpose === 'verifyCurrent' ? 'Confirm your number' : 'Enter code'}</Text>
        <Text style={s.muted}>
          We sent a 6-digit code to {purpose === 'verifyCurrent' ? 'your current number, ' : ''}
          {phone}
        </Text>

        {/* One hidden input drives six display boxes. */}
        <Pressable onPress={() => input.current?.focus()} style={st.boxes} accessibilityLabel="Verification code">
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[st.box, i === code.length && st.boxActive]}>
              <Text style={st.digit}>{code[i] ?? ''}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(t) => {
            const c = t.replace(/\D/g, '').slice(0, 6);
            setCode(c);
            if (c.length === 6) verify(c);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          style={st.hidden}
        />
        {devCode ? <Text style={[s.muted, { color: colors.gold }]}>Dev build code: {devCode}</Text> : null}
        <Button title="Verify" onPress={() => verify()} disabled={code.length !== 6} loading={busy} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, padding: space(6), gap: space(4) },
  back: { color: colors.muted, fontSize: 16, marginBottom: space(4) },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: space(4) },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.primary, borderWidth: 2 },
  digit: { color: colors.text, fontSize: 24, fontWeight: '700' },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
