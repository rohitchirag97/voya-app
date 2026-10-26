import { Check, Forward } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { errorText, getFriends, inviteToRoom, type UserSummary } from '../api';
import { Avatar, Sheet, rs as s, toast } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';

// Invite friends into this room (each gets a banner, wherever they are in the app), or share it outside the app.
export function InviteSheet({ visible, onClose, roomId, title, inRoom }: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  title: string;
  inRoom: Set<string>; // already here: no invite button
}) {
  const [friends, setFriends] = useState<(UserSummary & { online: boolean })[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSent(new Set());
    getFriends().then(
      (r) => setFriends(r.friends),
      (e) => {
        setFriends([]);
        toast(errorText(e));
      },
    );
  }, [visible]);

  async function invite(id: string) {
    setBusy(id);
    try {
      await inviteToRoom(roomId, [id]);
      setSent((x) => new Set(x).add(id));
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const share = () => Share.share({ message: `Join me in "${title}" on VoyaLive! Room ID: ${roomId.slice(0, 8)}` }).catch(() => {});

  return (
    <Sheet visible={visible} onClose={onClose} title="Invite friends">
      <Pressable onPress={share} accessibilityRole="button" style={st.shareRow}>
        <View style={st.shareIcon}>
          <Forward size={18} color="#fff" strokeWidth={2.4} />
        </View>
        <View style={st.grow}>
          <Text style={st.name}>Share this room</Text>
          <Text style={s.muted}>WhatsApp, Instagram and more</Text>
        </View>
      </Pressable>

      <Text style={st.heading}>Your friends</Text>
      {friends === null ? (
        <ActivityIndicator color={colors.primary} style={st.loading} />
      ) : !friends.length ? (
        <Text style={s.muted}>No friends yet. Friends are people you follow who follow you back.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => f.userId}
          style={st.list}
          renderItem={({ item }) => {
            const here = inRoom.has(item.userId);
            const done = sent.has(item.userId);
            // Online: an invite banner pops up for them now. Offline: a Join card waits in their inbox.
            const verb = item.online ? 'Invite' : 'Notify';
            return (
              <View style={st.row}>
                <View>
                  <Avatar id={item.userId} name={item.displayName} uri={item.avatarUrl} size={42} />
                  {item.online ? <View style={st.dot} /> : null}
                </View>
                <View style={st.grow}>
                  <Text style={st.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={[st.status, item.online && st.statusOn]}>{item.online ? 'Online' : 'Offline'}</Text>
                </View>
                {here ? (
                  <Text style={s.muted}>In this room</Text>
                ) : (
                  <Pressable
                    onPress={() => invite(item.userId)}
                    disabled={done || busy === item.userId}
                    accessibilityRole="button"
                    accessibilityLabel={done ? `${verb === 'Invite' ? 'Invited' : 'Notified'} ${item.displayName}` : `${verb} ${item.displayName}`}
                    style={[st.btn, !item.online && st.btnNotify, done && st.btnDone]}>
                    {busy === item.userId ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : done ? (
                      <>
                        <Check size={14} color={colors.success} strokeWidth={3} />
                        <Text style={[st.btnText, st.doneText]}>{verb === 'Invite' ? 'Invited' : 'Notified'}</Text>
                      </>
                    ) : (
                      <Text style={st.btnText}>{verb}</Text>
                    )}
                  </Pressable>
                )}
              </View>
            );
          }}
        />
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  grow: { flex: 1 },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  shareIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366' },
  heading: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  loading: { marginVertical: space(6) },
  list: { maxHeight: 360 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(2) },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  btn: { minWidth: 84, height: 34, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.primary },
  btnNotify: { backgroundColor: colors.accent },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.bg },
  status: { color: colors.muted, fontSize: 12 },
  statusOn: { color: colors.success },
  btnDone: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.success },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  doneText: { color: colors.success },
});
