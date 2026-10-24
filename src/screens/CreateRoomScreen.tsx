import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorText, type RoomSnapshot, type ZegoCreds } from '../api';
import { LAYOUTS, SeatLayoutPicker } from '../components/SeatLayoutPicker';
import { Button, Chip, Field, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, space } from '../theme';

const CATEGORIES = ['Casual', 'Music', 'Talk', 'Games', 'Study'];

export function CreateRoomScreen() {
  const nav = useNav();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Casual');
  const [seatCount, setSeatCount] = useState(8);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      const created = await api<{ room: RoomSnapshot; zego: ZegoCreds }>('POST', '/rooms', { title: title.trim(), category, seatCount });
      nav.back(); // drop the create screen
      nav.openRoom(created.room.roomId, created);
    } catch (e) {
      toast(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
          <X size={24} color={colors.muted} />
        </Pressable>
        <Text style={s.h2}>Create your room</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={st.body}>
        <Field label="Room title" value={title} onChangeText={setTitle} placeholder="Evening Chai" maxLength={60} />

        <Text style={s.label}>Category</Text>
        <View style={st.wrapRow}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
          ))}
        </View>

        <Text style={s.label}>Seats (including you)</Text>
        <SeatLayoutPicker value={seatCount} onChange={setSeatCount} />
        <Text style={s.muted}>
          {LAYOUTS[seatCount].join(' + ')} layout. This is your permanent room: its name, admins and settings stay, and anyone can join any time.
        </Text>
      </ScrollView>
      <View style={{ padding: space(4) }}>
        <Button title="Create room" onPress={create} disabled={!title.trim()} loading={busy} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space(4) },
  close: { color: colors.muted, fontSize: 20, width: 24 },
  body: { padding: space(4), gap: space(4) },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
});
