import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText } from '../api';
import { RoleTag, roleOf, type Role } from '../components/Icons';
import { Avatar, Button, Chip, Sheet, rs as s, toast } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';
import type { KickedUser, RoomState } from './useRoom';

type Props = { visible: boolean; onClose: () => void; room: RoomState; meId: string; onSelect: (userId: string) => void };

// Everyone in the room (tap → profile card with actions) and, for owner/admins, the kicked-out list.
export function PeopleSheet({ visible, onClose, room, meId, onSelect }: Props) {
  const snap = room.snap!;
  const [tab, setTab] = useState<'in' | 'kicked'>('in');
  const [kicked, setKicked] = useState<KickedUser[] | null>(null);

  const loadKicked = () =>
    room
      .listKicked()
      .then(setKicked)
      .catch((e) => toast(errorText(e)));

  useEffect(() => {
    if (visible && tab === 'kicked' && room.isMod) loadKicked();
    if (!visible) setTab('in');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, tab]);

  const badge = (id: string): Role =>
    roleOf(id, { hostUserId: snap.hostUserId, admins: snap.admins, seated: snap.seats.some((x) => x.occupant?.userId === id) });

  return (
    <Sheet visible={visible} onClose={onClose} title="People">
      {room.isMod ? (
        <View style={st.tabs}>
          <Chip label={`In room (${snap.participants.length})`} active={tab === 'in'} onPress={() => setTab('in')} />
          <Chip label={`Kicked out${kicked ? ` (${kicked.length})` : ''}`} active={tab === 'kicked'} onPress={() => setTab('kicked')} />
        </View>
      ) : null}

      <ScrollView style={st.list}>
        {tab === 'in'
          ? snap.participants.map((p) => (
              <Pressable
                key={p.userId}
                accessibilityRole="button"
                accessibilityLabel={`${p.displayName}, ${badge(p.userId)}`}
                onPress={() => onSelect(p.userId)}
                style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}>
                <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={40} />
                <Text style={st.name} numberOfLines={1}>
                  {p.displayName}
                  {p.userId === meId ? ' (you)' : ''}
                </Text>
                <RoleTag role={badge(p.userId)} />
              </Pressable>
            ))
          : kicked?.length
            ? kicked.map((k) => (
                <View key={k.userId} style={st.row}>
                  <Avatar id={k.userId} name={k.displayName} uri={k.avatarUrl} size={40} />
                  <Text style={st.name} numberOfLines={1}>
                    {k.displayName}
                  </Text>
                  <Button
                    title="Allow back"
                    variant="ghost"
                    style={st.allow}
                    onPress={() =>
                      room
                        .unkick(k.userId)
                        .then(() => (toast(`${k.displayName} can join again`), loadKicked()))
                        .catch((e) => toast(errorText(e)))
                    }
                  />
                </View>
              ))
            : <Text style={[s.muted, { paddingVertical: space(4) }]}>{kicked ? 'Nobody has been removed from this room.' : 'Loading…'}</Text>}
      </ScrollView>
    </Sheet>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space(2) },
  list: { maxHeight: 440 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingVertical: space(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  badge: { color: colors.muted, fontSize: 12, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  allow: { height: 36, paddingHorizontal: space(4) },
});
