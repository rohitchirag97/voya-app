import { Bell, BellRing, ChevronLeft, ChevronRight, DoorOpen, Info, LogOut, Mail, PenLine, Smartphone, Store, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { loadNotifySettings, setNotifySetting, type NotifySettings } from '../services/AppEvents';
import { version } from '../../package.json';
import { api, auth, errorText, type SignInMethods } from '../api';
import { confirmDialog } from '../components/Dialog';
import { Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

export function SettingsScreen() {
  const [notifs, setNotifs] = useState<NotifySettings | null>(null);
  useEffect(() => {
    loadNotifySettings().then(setNotifs, () => {});
  }, []);
  const toggle = (key: keyof NotifySettings, on: boolean) => {
    setNotifySetting(key, on);
    setNotifs((n) => (n ? { ...n, [key]: on } : n));
  };
  const nav = useNav();
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [linking, setLinking] = useState(false);

  // Refetched each time Settings shows, so a phone added on the next screens appears on return.
  useEffect(() => {
    api<SignInMethods>('GET', '/me').then(setMethods, () => {});
  }, []);

  // Changing the number starts by sending a code to the current one.
  async function changePhone(phone: string) {
    const ok = await confirmDialog({ title: 'Change phone number?', message: `We'll send a code to ${phone}, then to your new number.`, confirmText: 'Continue', Icon: Smartphone });
    if (!ok) return;
    try {
      const { devCode } = await auth.requestOtp(phone);
      nav.push({ name: 'otp', phone, devCode, purpose: 'verifyCurrent' });
    } catch (e) {
      toast(errorText(e));
    }
  }

  async function linkGoogle() {
    setLinking(true);
    try {
      const m = await auth.linkGoogle();
      if (m) {
        setMethods(m);
        toast('Google account linked');
      }
    } catch (e) {
      toast(errorText(e));
    } finally {
      setLinking(false);
    }
  }

  // Leave any room first so seats and audio are released, then end the session.
  async function confirmLogout() {
    const ok = await confirmDialog({ title: 'Log out?', message: 'You will need your phone number or Google account to sign in again.', confirmText: 'Log out', danger: true, Icon: LogOut });
    if (!ok) return;
    if (nav.activeRoom) {
      await api('POST', `/rooms/${nav.activeRoom.roomId}/leave`).catch(() => {});
      nav.closeRoom();
    }
    await auth.logout();
    nav.setMe(null);
    nav.reset({ name: 'login' });
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={st.body}>
        <Text style={s.label}>Account</Text>
        <View style={st.group}>
          <Row Icon={PenLine} label="Edit profile" onPress={() => nav.push({ name: 'profile' })} />
          <Row Icon={Wallet} label="Wallet" onPress={() => nav.push({ name: 'recharge' })} />
          <Row Icon={Store} label="Authorised Coin Sellers" onPress={() => nav.push({ name: 'coinSellers' })} last />
        </View>

        {/* Ways to sign in: the missing one can be added and the phone changed; none can be removed. */}
        {methods && (
          <>
            <Text style={s.label}>Sign-in methods</Text>
            <View style={st.group}>
              <Row Icon={Smartphone} label="Phone number" value={methods.phone ?? 'Add'} onPress={() => (methods.phone ? changePhone(methods.phone) : nav.push({ name: 'linkPhone' }))} />
              <Row Icon={Mail} label="Google account" value={methods.googleLinked ? 'Linked' : linking ? 'Linking…' : 'Link'} onPress={methods.googleLinked || linking ? undefined : linkGoogle} last />
            </View>
          </>
        )}

        {/* What the app may alert you about; the phone's own settings can still turn notifications off entirely. */}
        <Text style={s.label}>Notifications</Text>
        <View style={st.group}>
          <SwitchRow
            Icon={BellRing}
            label="New messages"
            hint="A notification when someone messages you while the app is in the background"
            value={notifs?.messages ?? true}
            onChange={(v) => toggle('messages', v)}
          />
          <SwitchRow
            Icon={DoorOpen}
            label="Room invites"
            hint="A pop-up when a friend invites you to their room"
            value={notifs?.invites ?? true}
            onChange={(v) => toggle('invites', v)}
          />
          {Platform.OS === 'android' ? <Row Icon={Bell} label="Phone notification settings" onPress={() => Linking.openSettings()} last /> : null}
        </View>

        <Text style={s.label}>About</Text>
        <View style={st.group}>
          <Row Icon={Info} label="Version" value={version} last />
        </View>

        {/* Always the last item. */}
        <Pressable onPress={confirmLogout} accessibilityRole="button" style={({ pressed }) => [st.logout, pressed && { opacity: 0.7 }]}>
          <LogOut size={20} color={colors.danger} strokeWidth={2.4} />
          <Text style={st.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function SwitchRow({ Icon, label, hint, value, onChange }: { Icon: typeof Info; label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[st.row, st.rowLine]}>
      <View style={st.icon}>
        <Icon size={18} color={colors.primary} strokeWidth={2.4} />
      </View>
      <View style={st.grow}>
        <Text style={st.rowLabel}>{label}</Text>
        <Text style={st.hint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

function Row({ Icon, label, value, onPress, last }: { Icon: typeof Info; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [st.row, !last && st.rowLine, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <View style={st.icon}>
        <Icon size={18} color={colors.primary} strokeWidth={2.4} />
      </View>
      <Text style={st.rowLabel}>{label}</Text>
      {value ? <Text style={st.value}>{value}</Text> : null}
      {onPress ? <ChevronRight size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { padding: space(4), gap: space(3), paddingBottom: 140 },
  group: { borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(4) },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
  rowLabel: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' },
  grow: { flex: 1 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  value: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    marginTop: space(4),
    paddingVertical: space(4),
    borderRadius: radius.lg,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  logoutText: { color: colors.danger, fontSize: 16, fontWeight: '800' },
});
