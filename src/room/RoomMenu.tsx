import { Dices, Gem } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Charisma, Pk, Seat } from '../api';
import { SeatLayoutPicker } from '../components/SeatLayoutPicker';
import { Sheet, rs as s } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';
import { GameCards, type GameKey } from './GameSheet';
import { MusicSection } from './MusicSection';
import { PkSection } from './Pk';

// The room's "More" sheet: one place for extras, by section. New features go in as another section.
export function RoomMenu({ visible, onClose, onPickGame, music, seats, charisma, pk, ludo }: {
  visible: boolean;
  onClose: () => void;
  onPickGame: (g: GameKey) => void;
  music: boolean; // on a seat: your audio goes out, so a song can ride along
  seats: { count: number; onChange: (n: number) => void } | null; // owner/admins only; null hides the section
  charisma: { state: Charisma | null; onToggle: (on: boolean) => void } | null; // owner/admins only
  pk: { seats: Seat[]; state: Pk | null; onStart: (a: string, b: string, minutes: number) => void; onStop: () => void } | null; // owner/admins only
  ludo: { on: boolean; onToggle: (on: boolean) => void } | null; // owner/admins only
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="More">
      <ScrollView style={st.scroll} contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
        <View style={st.section}>
          <Text style={st.heading}>Games</Text>
          <GameCards onPick={onPickGame} />
        </View>
        {music ? (
          <View style={st.section}>
            <Text style={st.heading}>Music</Text>
            <MusicSection />
          </View>
        ) : null}
        {ludo ? (
          <View style={st.section}>
            <Text style={st.heading}>Ludo</Text>
            <View style={st.row}>
              <View style={[st.gem, st.ludoIcon]}>
                <Dices size={18} color="#FFD36B" strokeWidth={2.4} />
              </View>
              <View style={st.grow}>
                <Text style={st.title}>Ludo mode</Text>
                <Text style={s.muted}>
                  {ludo.on
                    ? 'The board is on. Seated people join, you start. Turning it off ends any game.'
                    : 'Put a Ludo board in the room. 2 to 4 seated people play; everyone watches.'}
                </Text>
              </View>
              <Pressable
                onPress={() => ludo.onToggle(!ludo.on)}
                accessibilityRole="switch"
                accessibilityState={{ checked: ludo.on }}
                accessibilityLabel="Ludo mode"
                style={[st.toggle, ludo.on ? st.stop : st.start]}>
                <Text style={[st.toggleText, ludo.on && { color: colors.text }]}>{ludo.on ? 'Turn off' : 'Turn on'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {pk ? (
          <View style={st.section}>
            <Text style={st.heading}>PK 1v1</Text>
            <PkSection seats={pk.seats} pk={pk.state} onStart={pk.onStart} onStop={pk.onStop} />
          </View>
        ) : null}
        {charisma ? (
          <View style={st.section}>
            <Text style={st.heading}>Charisma</Text>
            <View style={st.row}>
              <View style={st.gem}>
                <Gem size={18} color="#FF8AC6" strokeWidth={2.4} />
              </View>
              <View style={st.grow}>
                <Text style={st.title}>Charisma counter</Text>
                <Text style={s.muted}>
                  {charisma.state
                    ? `Counting since ${new Date(charisma.state.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Each seat shows the gift coins received.`
                    : 'Show the gift coins each person on stage receives, from when you start.'}
                </Text>
              </View>
              <Pressable
                onPress={() => charisma.onToggle(!charisma.state)}
                accessibilityRole="switch"
                accessibilityState={{ checked: !!charisma.state }}
                accessibilityLabel="Charisma counter"
                style={[st.toggle, charisma.state ? st.stop : st.start]}>
                <Text style={[st.toggleText, charisma.state && { color: colors.text }]}>{charisma.state ? 'Stop' : 'Start'}</Text>
              </Pressable>
            </View>
            {charisma.state ? (
              <Pressable onPress={() => charisma.onToggle(true)} accessibilityRole="button" style={st.reset}>
                <Text style={st.resetText}>Restart from zero</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {seats ? (
          <View style={st.section}>
            <Text style={st.heading}>Seats</Text>
            <SeatLayoutPicker value={seats.count} onChange={seats.onChange} />
            <Text style={s.muted}>Making the room smaller moves people on removed seats to free seats, or back to the audience if none are free.</Text>
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const st = StyleSheet.create({
  scroll: { maxHeight: 600 },
  body: { gap: space(5), paddingBottom: space(1) },
  section: { gap: space(2) },
  heading: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  gem: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,95,174,0.14)', borderWidth: 1, borderColor: 'rgba(255,138,198,0.35)' },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  toggle: { minWidth: 72, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space(3) },
  start: { backgroundColor: colors.primary },
  stop: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  toggleText: { color: '#fff', fontWeight: '800' },
  ludoIcon: { backgroundColor: 'rgba(255,201,77,0.14)', borderColor: 'rgba(255,211,107,0.4)' },
  reset: { alignSelf: 'flex-start', paddingVertical: space(1) },
  resetText: { color: '#FF8AC6', fontWeight: '700', fontSize: 13 },
});
