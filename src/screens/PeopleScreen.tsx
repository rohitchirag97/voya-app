import { ChevronLeft, Eye, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api, errorText, setFollowing, timeAgo, type Person, type PeopleKind } from '../api';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { LevelBadge } from '../components/Level';
import { UserIds } from '../components/UserIds';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, gradients, radius, space } from '../theme';
import { Gradient } from '../components/Gradient';

const titles: Record<PeopleKind, string> = { followers: 'Followers', following: 'Following', visitors: 'Profile visitors' };
const path = (kind: PeopleKind, userId: string) => (kind === 'visitors' ? '/me/visitors' : `/users/${userId}/${kind}`);

// Followers / Following of any profile, or your own profile visitors.
export function PeopleScreen({ userId, kind }: { userId: string; kind: PeopleKind }) {
  const nav = useNav();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (more = false) => {
      if (more && !cursor) return;
      setLoading(true);
      try {
        const r = await api<{ people: Person[]; nextCursor: string | null }>(
          'GET',
          `${path(kind, userId)}?limit=30${more && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        setPeople((prev) => (more ? [...(prev ?? []), ...r.people] : r.people));
        setCursor(r.nextCursor);
      } catch (e) {
        toast(errorText(e));
        setPeople((p) => p ?? []);
      } finally {
        setLoading(false);
      }
    },
    [cursor, kind, userId],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const setFollow = (id: string, on: boolean) => setPeople((l) => l?.map((x) => (x.userId === id ? { ...x, isFollowing: on } : x)) ?? null);

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>{titles[kind]}</Text>
      </View>
      {people === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space(10) }} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(p) => p.userId}
          contentContainerStyle={st.list}
          onEndReached={() => load(true)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.primary} colors={[colors.primary]} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <View style={st.emptyIcon}>{kind === 'visitors' ? <Eye size={30} color={colors.primary} /> : <Users size={30} color={colors.primary} />}</View>
              <Text style={s.h2}>{kind === 'visitors' ? 'No visitors yet' : kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</Text>
              {kind === 'visitors' ? <Text style={[s.muted, { textAlign: 'center' }]}>People who open your profile show up here.</Text> : null}
            </View>
          }
          renderItem={({ item }) => <PersonRow person={item} kind={kind} onFollow={(on) => setFollow(item.userId, on)} />}
        />
      )}
    </Screen>
  );
}

function PersonRow({ person: x, kind, onFollow }: { person: Person; kind: PeopleKind; onFollow: (on: boolean) => void }) {
  const nav = useNav();
  const isMe = x.userId === nav.me?.userId;
  async function toggle() {
    onFollow(!x.isFollowing); // optimistic
    try {
      await setFollowing(x.userId, !x.isFollowing);
    } catch (e) {
      onFollow(x.isFollowing);
      toast(errorText(e));
    }
  }
  return (
    <Pressable
      onPress={() => nav.push({ name: 'user', userId: x.userId })}
      accessibilityRole="button"
      accessibilityLabel={`${x.displayName}'s profile`}
      style={({ pressed }) => [st.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <Avatar id={x.userId} name={x.displayName} uri={x.avatarUrl} size={50} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={st.nameRow}>
          <Text style={st.name} numberOfLines={1}>
            {x.displayName}
          </Text>
          <OfficialMark role={x.staffRole} />
          <SvipBadge tier={x.svip} />
          {x.level ? <LevelBadge level={x.level} /> : null}
        </View>
        {kind === 'visitors' ? (
          <Text style={st.meta}>
            Visited {timeAgo(x.at)}
            {x.visits && x.visits > 1 ? ` · ${x.visits} times` : ''}
          </Text>
        ) : (
          <UserIds publicId={x.publicId} specialId={x.specialId} />
        )}
      </View>
      {isMe ? null : (
        <Pressable onPress={toggle} accessibilityRole="button" hitSlop={6} style={[st.follow, x.isFollowing && st.following]}>
          {x.isFollowing ? null : <Gradient colors={gradients.primary} style={st.fill} />}
          <Text style={[st.followText, x.isFollowing && { color: colors.text }]}>
            {x.isFollowing ? 'Following' : kind === 'followers' || kind === 'visitors' ? 'Follow back' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  list: { padding: space(3), gap: space(2), paddingBottom: 140 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.lg, backgroundColor: colors.surface },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  follow: { height: 34, paddingHorizontal: space(4), borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  following: { backgroundColor: colors.surfaceHigh },
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  followText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), paddingHorizontal: space(8) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
});
