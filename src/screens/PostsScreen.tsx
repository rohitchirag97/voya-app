import { ChevronLeft, Heart, Images, MessageCircle, MoreHorizontal, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View, type ListViewToken } from 'react-native';
import { deletePost, errorText, likePost, listPosts, timeAgo, type Post } from '../api';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { confirmDialog } from '../components/Dialog';
import { LevelBadge } from '../components/Level';
import { isShortText, PostMedia } from '../components/PostMedia';
import { Avatar, IconButton, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

// Feed of everyone's posts (photos, videos, text), newest first. Only the post mostly on screen plays its video.
export function PostsScreen() {
  const nav = useNav();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  // FlatList wants these two to never change identity.
  const viewability = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => setActiveId((viewableItems[0]?.item as Post | undefined)?.postId ?? null)).current;

  const load = useCallback(
    async (more = false) => {
      if (more && !cursor) return;
      if (!more) setLoading(true);
      try {
        const r = await listPosts(undefined, more ? cursor : null);
        setPosts((prev) => (more ? [...prev, ...r.posts] : r.posts));
        setCursor(r.nextCursor);
      } catch (e) {
        toast(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [cursor],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  return (
    <Screen backdrop bottom={false}>
      <View style={st.head}>
        <Text style={s.h1}>Posts</Text>
        <IconButton label="New post" tone="primary" size={42} onPress={() => nav.push({ name: 'newPost' })}>
          <Plus size={22} color="#fff" strokeWidth={2.6} />
        </IconButton>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        contentContainerStyle={st.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load()} tintColor={colors.primary} colors={[colors.primary]} />}
        onEndReached={() => load(true)}
        onEndReachedThreshold={0.6}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        // Lazy: build only a few cards at a time and drop the ones far off screen.
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        ListEmptyComponent={
          loading ? undefined : (
            <View style={st.empty}>
              <View style={st.emptyIcon}>
                <Images size={30} color={colors.primary} />
              </View>
              <Text style={s.h2}>No posts yet</Text>
              <Text style={s.muted}>Share the first post with everyone.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PostCard post={item} active={item.postId === activeId} onDeleted={() => setPosts((l) => l.filter((x) => x.postId !== item.postId))} />
        )}
      />
    </Screen>
  );
}

// One post opened from a profile grid.
export function PostScreen({ post }: { post: Post }) {
  const nav = useNav();
  return (
    <Screen backdrop>
      <View style={st.head}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={st.headLeft}>
          <ChevronLeft size={26} color={colors.text} />
          <Text style={s.h2}>Post</Text>
        </Pressable>
      </View>
      <View style={st.list}>
        <PostCard post={post} active onDeleted={nav.back} />
      </View>
    </Screen>
  );
}

export function PostCard({ post, active, onDeleted }: { post: Post; active: boolean; onDeleted: () => void }) {
  const nav = useNav();
  const [p, setP] = useState(post);
  const mine = p.author.userId === nav.me?.userId;

  // Optimistic: flip now, put it back if the server says no.
  async function toggleLike() {
    const before = p;
    setP({ ...p, likedByMe: !p.likedByMe, likes: p.likes + (p.likedByMe ? -1 : 1) });
    try {
      const r = await likePost(before.postId, !before.likedByMe);
      setP((cur) => ({ ...cur, ...r }));
    } catch (e) {
      setP(before);
      toast(errorText(e));
    }
  }

  async function confirmDelete() {
    if (!(await confirmDialog({ title: 'Delete post?', message: 'This removes the post for everyone.', confirmText: 'Delete', danger: true, Icon: Trash2 }))) return;
    deletePost(p.postId).then(onDeleted, (e) => toast(errorText(e)));
  }

  const openAuthor = () => nav.push({ name: 'user', userId: p.author.userId });
  const openComments = () => nav.push({ name: 'comments', postId: p.postId, postAuthorId: p.author.userId });
  return (
    <View style={st.card}>
      <View style={st.cardHead}>
        <Pressable onPress={openAuthor} style={st.author} accessibilityRole="button" accessibilityLabel={`${p.author.displayName}'s profile`}>
          <Avatar id={p.author.userId} name={p.author.displayName} uri={p.author.avatarUrl} size={36} />
          <View style={{ flexShrink: 1 }}>
            <View style={st.nameRow}>
              <Text style={st.name} numberOfLines={1}>
                {p.author.displayName}
              </Text>
              <OfficialMark role={p.author.staffRole} />
              <SvipBadge tier={p.author.svip} />
              {p.author.level ? <LevelBadge level={p.author.level} /> : null}
            </View>
            <Text style={st.time}>{timeAgo(p.createdAt)}</Text>
          </View>
        </Pressable>
        {mine ? (
          <Pressable onPress={confirmDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel="Post options">
            <MoreHorizontal size={22} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <PostMedia post={p} active={active} />
      {p.kind === 'TEXT' && !isShortText(p.caption) ? <Text style={st.textBody}>{p.caption}</Text> : null}
      <View style={st.actions}>
        <Pressable
          onPress={toggleLike}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={p.likedByMe ? 'Unlike' : 'Like'}
          accessibilityState={{ selected: p.likedByMe }}
          style={st.like}>
          <Heart size={24} color={p.likedByMe ? colors.primary : colors.text} fill={p.likedByMe ? colors.primary : 'transparent'} strokeWidth={2.2} />
          <Text style={st.likes}>
            {p.likes} {p.likes === 1 ? 'like' : 'likes'}
          </Text>
        </Pressable>
        <Pressable onPress={openComments} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${p.comments} comments`} style={st.like}>
          <MessageCircle size={23} color={colors.text} strokeWidth={2.2} />
          <Text style={st.likes}>{p.comments}</Text>
        </Pressable>
      </View>
      {p.caption && p.kind !== 'TEXT' ? (
        <Text style={st.caption}>
          <Text style={st.name}>{p.author.displayName} </Text>
          {p.caption}
        </Text>
      ) : null}
      <Pressable onPress={openComments} accessibilityRole="button" style={st.viewComments}>
        <Text style={st.viewCommentsText}>{p.comments ? `View all ${p.comments} ${p.comments === 1 ? 'comment' : 'comments'}` : 'Add a comment...'}</Text>
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(4), paddingVertical: space(3) },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  list: { paddingHorizontal: space(4), paddingBottom: 140, gap: space(4) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#5B3FFF',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(3) },
  author: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  time: { color: colors.muted, fontSize: 12 },
  textBody: { color: colors.text, fontSize: 17, lineHeight: 25, paddingHorizontal: space(4), paddingBottom: space(1) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space(5), paddingHorizontal: space(3), paddingTop: space(3) },
  viewComments: { paddingHorizontal: space(3), paddingTop: space(1), paddingBottom: space(4) },
  viewCommentsText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  like: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  likes: { color: colors.text, fontSize: 14, fontWeight: '800' },
  caption: { color: colors.text, fontSize: 14, lineHeight: 20, paddingHorizontal: space(3), paddingTop: space(2) },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16) },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
});
