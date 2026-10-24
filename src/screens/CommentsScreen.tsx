import { ChevronLeft, MessageCircle, Send, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, errorText, timeAgo, type PostComment } from '../api';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { confirmDialog } from '../components/Dialog';
import { LevelBadge } from '../components/Level';
import { Avatar, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

// Comments on one post: newest at the bottom next to the input, like a chat. Scroll up for older ones.
export function CommentsScreen({ postId, postAuthorId }: { postId: string; postAuthorId: string }) {
  const nav = useNav();
  const me = nav.me!;
  const [comments, setComments] = useState<PostComment[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (older = false) => {
      if (older && !cursor) return;
      try {
        const r = await api<{ comments: PostComment[]; nextCursor: string | null }>('GET', `/posts/${postId}/comments?limit=30${older && cursor ? `&cursor=${cursor}` : ''}`);
        setComments((prev) => (older ? [...(prev ?? []), ...r.comments] : r.comments));
        setCursor(r.nextCursor);
      } catch (e) {
        toast(errorText(e));
        setComments((c) => c ?? []);
      }
    },
    [cursor, postId],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const c = await api<PostComment>('POST', `/posts/${postId}/comments`, { body });
      setComments((prev) => [c, ...(prev ?? [])]);
      setText('');
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  }

  async function remove(c: PostComment) {
    if (!(await confirmDialog({ title: 'Delete comment?', message: c.body, confirmText: 'Delete', danger: true, Icon: Trash2 }))) return;
    try {
      await api('DELETE', `/posts/${postId}/comments/${c.id}`);
      setComments((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
    } catch (e) {
      toast(errorText(e));
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Comments</Text>
      </View>

      {comments === null ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          inverted
          style={{ flex: 1 }}
          data={comments}
          keyExtractor={(c) => String(c.id)}
          onEndReached={() => load(true)}
          contentContainerStyle={st.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={st.empty}>
              <View style={st.emptyIcon}>
                <MessageCircle size={28} color={colors.primary} />
              </View>
              <Text style={s.h2}>No comments yet</Text>
              <Text style={s.muted}>Start the conversation.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const canDelete = item.user.userId === me.userId || postAuthorId === me.userId;
            return (
              <Pressable
                onLongPress={canDelete ? () => remove(item) : undefined}
                accessibilityHint={canDelete ? 'Long press to delete' : undefined}
                style={st.row}>
                <Pressable onPress={() => nav.push({ name: 'user', userId: item.user.userId })} accessibilityRole="button" accessibilityLabel={`${item.user.displayName}'s profile`}>
                  <Avatar id={item.user.userId} name={item.user.displayName} uri={item.user.avatarUrl} size={38} />
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={st.nameRow}>
                    <Text style={st.name} numberOfLines={1}>
                      {item.user.displayName}
                    </Text>
                    <OfficialMark role={item.user.staffRole} />
                    <SvipBadge tier={item.user.svip} />
                    {item.user.level ? <LevelBadge level={item.user.level} /> : null}
                    <Text style={st.time}>{timeAgo(item.createdAt)}</Text>
                  </View>
                  <Text style={st.body}>{item.body}</Text>
                </View>
                {canDelete ? (
                  <Pressable onPress={() => remove(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete comment">
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <View style={st.bar}>
        <Avatar id={me.userId} name={me.displayName} uri={me.avatarUrl} size={36} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a comment..."
          placeholderTextColor={colors.muted}
          style={st.input}
          maxLength={500}
          multiline
          accessibilityLabel="Comment"
        />
        <Pressable
          onPress={send}
          disabled={sending || !text.trim()}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          style={[st.send, (sending || !text.trim()) && { opacity: 0.4 }]}>
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={18} color="#fff" strokeWidth={2.4} />}
        </Pressable>
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  list: { padding: space(4), gap: space(4) },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space(3) },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 14, fontWeight: '800', flexShrink: 1 },
  time: { color: colors.muted, fontSize: 12 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  empty: { alignItems: 'center', gap: space(2), marginTop: space(16), transform: [{ scale: -1 }] }, // undo the inverted list's flip (both axes on Android)
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2),
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, minHeight: 40, maxHeight: 110, paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius.lg, backgroundColor: colors.surfaceHigh, color: colors.text, fontSize: 15 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
});
