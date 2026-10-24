import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText, getProfileOptions, uploadAvatar, type Me, type ProfileOptions } from '../api';
import { pickPhoto } from './ProfileParts';
import { Avatar, Button, Field, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

type Gender = NonNullable<Me['gender']>;
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: '♂ Male' },
  { value: 'FEMALE', label: '♀ Female' },
  { value: 'OTHER', label: '⚧ Other' },
];
// "29/08/2001" <-> "2001-08-29"
const toIso = (dmy: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const toDmy = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
// Typing "29082001" becomes "29/08/2001".
const maskDate = (t: string) => {
  const d = t.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
};

// First-time setup (display name) and Edit profile (everything, including About me).
export function ProfileSetupScreen() {
  const nav = useNav();
  const me = nav.me;
  const editing = !!me?.displayName;
  const [name, setName] = useState(me?.displayName ?? '');
  const [bio, setBio] = useState(me?.bio ?? '');
  const [gender, setGender] = useState<Gender | null>(me?.gender ?? null);
  const [birthday, setBirthday] = useState(toDmy(me?.birthday ?? null));
  const [hometown, setHometown] = useState(me?.hometown ?? '');
  const [interests, setInterests] = useState<string[]>(me?.interests ?? []);
  const [opts, setOpts] = useState<ProfileOptions | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getProfileOptions().then(setOpts).catch(() => {});
  }, []);

  // Names double as @mention handles, so no spaces or symbols; say exactly what's wrong instead of a silently disabled Save.
  const nameError = /\s/.test(name)
    ? `Spaces aren't allowed. Try ${name.trim().replace(/\s+/g, '_') || 'your_name'}`
    : /[^A-Za-z0-9_.]/.test(name)
      ? 'Only letters, numbers, _ and . are allowed'
      : name.length < 3
        ? 'At least 3 characters'
        : name.length > 24
          ? 'At most 24 characters'
          : null;
  const validName = !nameError;
  const birthdayIso = toIso(birthday);
  const birthdayOk = !birthday || !!birthdayIso;

  function toggleInterest(t: string) {
    setInterests((cur) => {
      if (cur.includes(t)) return cur.filter((x) => x !== t);
      if (opts && cur.length >= opts.maxInterests) {
        toast(`Pick up to ${opts.maxInterests}`);
        return cur;
      }
      return [...cur, t];
    });
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api<Me>('PATCH', '/me/profile', {
        displayName: name,
        bio: bio.trim() || null,
        gender,
        birthday: birthdayIso,
        hometown: hometown.trim() || null,
        interests,
      });
      nav.setMe(updated);
      if (editing) nav.back();
      else nav.reset({ name: 'home' });
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.h1}>{editing ? 'Edit profile' : 'Set up your profile'}</Text>
        <Text style={s.muted}>This is how people see and @mention you in rooms.</Text>
        <Pressable
          onPress={async () => {
            const file = await pickPhoto(800);
            if (!file) return;
            try {
              nav.setMe(await uploadAvatar(file));
            } catch (e) {
              toast(errorText(e));
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Change profile picture"
          style={st.avatar}>
          <Avatar id={me?.userId ?? 'x'} name={name || '?'} uri={me?.avatarUrl} size={96} />
          <Text style={st.changePhoto}>{me?.avatarUrl ? 'Change photo' : 'Add a photo'}</Text>
        </Pressable>
        <Field label="Display name" value={name} onChangeText={setName} placeholder="chai_lover" autoCapitalize="none" maxLength={24} />
        {nameError && name ? (
          <Pressable
            onPress={() => /\s/.test(name) && setName(name.trim().replace(/\s+/g, '_'))}
            accessibilityRole={/\s/.test(name) ? 'button' : 'text'}
            accessibilityHint={/\s/.test(name) ? 'Replaces the spaces with underscores' : undefined}>
            <Text style={st.error}>
              {nameError}
              {/\s/.test(name) ? <Text style={st.fix}>  Use this</Text> : null}
            </Text>
          </Pressable>
        ) : (
          <Text style={[s.muted, { fontSize: 12 }]}>3–24 characters: letters, numbers, _ or .</Text>
        )}
        <Field label="Bio (optional)" value={bio} onChangeText={setBio} placeholder="Say something about you" maxLength={160} />

        <Text style={st.label}>Gender (optional)</Text>
        <View style={st.chips}>
          {GENDERS.map((g) => (
            <Pressable
              key={g.value}
              onPress={() => setGender((cur) => (cur === g.value ? null : g.value))}
              accessibilityRole="radio"
              accessibilityState={{ selected: gender === g.value }}
              style={[st.chip, gender === g.value && st.chipOn]}>
              <Text style={[st.chipText, gender === g.value && st.chipTextOn]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>

        <Field
          label={`Birthday (optional, ${opts?.minAge ?? 18}+)`}
          value={birthday}
          onChangeText={(t) => setBirthday(maskDate(t))}
          placeholder="DD/MM/YYYY"
          keyboardType="number-pad"
          maxLength={10}
        />
        {!birthdayOk ? <Text style={st.error}>Use DD/MM/YYYY, e.g. 29/08/2001</Text> : <Text style={[s.muted, { fontSize: 12 }]}>Shows your age and zodiac sign on your profile.</Text>}
        <Field label="Hometown (optional)" value={hometown} onChangeText={setHometown} placeholder="e.g. Surat" maxLength={40} />

        <Text style={st.label}>
          Interests {opts ? `(${interests.length}/${opts.maxInterests})` : ''}
        </Text>
        <View style={st.chips}>
          {(opts?.interests ?? interests).map((t) => (
            <Pressable
              key={t}
              onPress={() => toggleInterest(t)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: interests.includes(t) }}
              style={[st.chip, interests.includes(t) && st.chipOn]}>
              <Text style={[st.chipText, interests.includes(t) && st.chipTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Button title={editing ? 'Save' : 'Continue'} onPress={save} disabled={!validName || !birthdayOk} loading={busy} style={{ marginTop: space(4) }} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  wrap: { padding: space(6), gap: space(4), paddingBottom: space(12) },
  avatar: { alignItems: 'center', gap: space(2), marginVertical: space(2) },
  changePhoto: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  label: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  chip: { paddingHorizontal: space(3), paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  fix: { color: colors.primary, fontWeight: '900' },
});
