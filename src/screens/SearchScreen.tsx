import { ChevronLeft, Search, UserRoundSearch } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { errorText, searchUsers, type FoundUser } from '../api';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { LevelBadge } from '../components/Level';
import { UserIds } from '../components/UserIds';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

// Find someone by their 10-digit ID or their special ID.
export function SearchScreen() {
  const nav = useNav();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundUser[] | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[A-Z0-9]{3,10}$/.test(q);

  async function run() {
    if (!valid) return;
    setBusy(true);
    try {
      setFound((await searchUsers(q)).users);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.head}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={26} color={colors.text} />
        </Pressable>
        <View style={st.box}>
          <Search size={18} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={(t) => setQ(t.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
            onSubmitEditing={run}
            placeholder="Search by ID or special ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={10}
            autoFocus
            style={st.input}
            accessibilityLabel="ID or special ID"
          />
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        <Pressable onPress={run} disabled={!valid || busy} accessibilityRole="button" style={[st.go, !valid && { opacity: 0.4 }]}>
          <Text style={st.goText}>Search</Text>
        </Pressable>
      </View>

      <FlatList
        data={found ?? []}
        keyExtractor={(u) => u.userId}
        contentContainerStyle={st.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={st.empty}>
            <View style={st.emptyIcon}>
              <UserRoundSearch size={30} color={colors.primary} />
            </View>
            <Text style={s.h2}>{found ? 'No one has that ID' : 'Find people by ID'}</Text>
            <Text style={[s.muted, { textAlign: 'center' }]}>Enter a 10-digit ID, or a special ID (3-9 letters or numbers).</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => nav.push({ name: 'user', userId: item.userId })}
            accessibilityRole="button"
            accessibilityLabel={`${item.displayName}, ID ${item.publicId}`}
            style={({ pressed }) => [st.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
            <Avatar id={item.userId} name={item.displayName} uri={item.avatarUrl} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={st.nameRow}>
                <Text style={st.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <OfficialMark role={item.staffRole} />
                <SvipBadge tier={item.svip} />
                {item.level ? <LevelBadge level={item.level} /> : null}
              </View>
              <UserIds publicId={item.publicId} specialId={item.specialId} />
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    height: 46,
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600', letterSpacing: 0.5, paddingVertical: 0 },
  go: { paddingHorizontal: space(2), paddingVertical: space(2) },
  goText: { color: colors.primary, fontSize: 15, fontWeight: '900' },
  list: { padding: space(3), gap: space(2) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), paddingHorizontal: space(8) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
});
