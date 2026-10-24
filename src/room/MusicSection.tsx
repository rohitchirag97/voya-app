import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { Mic, Minus, Music2, Pause, Play, Plus, Square } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { rs as s, toast } from '../components/ui';
import { zego, type Music } from '../services/ZegoAudioRoomService';
import { roomColors as colors, radius, space } from '../theme';

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong');

// Play a song from the phone into the room (mixed into your seat's audio), plus song and mic volume.
export function MusicSection() {
  const [m, setM] = useState<Music>(zego.music);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    zego.onMusic = setM;
    return () => {
      zego.onMusic = null;
    };
  }, []);

  const choose = async () => {
    try {
      const [file] = await pick({ type: [types.audio] });
      setLoading(true);
      // A local copy gives ZEGO a plain file path on both platforms (it can't read iOS security-scoped URLs).
      const [copy] = await keepLocalCopy({ files: [{ uri: file.uri, fileName: file.name ?? 'song' }], destination: 'cachesDirectory' });
      if (copy.status !== 'success') throw new Error(copy.copyError || "Couldn't open that file");
      await zego.playSong(decodeURIComponent(copy.localUri.replace(/^file:\/\//, '')), (file.name ?? 'Song').replace(/\.[^.]+$/, ''));
    } catch (e) {
      if (!(isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED)) fail(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={st.wrap}>
      <View style={st.row}>
        <View style={st.icon}>
          <Music2 size={18} color="#8FD3FF" strokeWidth={2.4} />
        </View>
        <View style={st.grow}>
          <Text style={st.title} numberOfLines={1}>{m.name ?? 'Play a song'}</Text>
          <Text style={s.muted} numberOfLines={2}>
            {m.name ? (m.playing ? 'Everyone in the room hears it.' : 'Paused') : 'Pick a song from your phone. Everyone in the room hears it.'}
          </Text>
        </View>
        {m.name ? (
          <>
            <Round label={m.playing ? 'Pause song' : 'Resume song'} onPress={() => zego.toggleSong().catch(fail)}>
              {m.playing ? <Pause size={16} color="#fff" strokeWidth={2.6} /> : <Play size={16} color="#fff" strokeWidth={2.6} />}
            </Round>
            <Round label="Stop song" onPress={() => zego.stopSong().catch(fail)}>
              <Square size={14} color="#fff" strokeWidth={2.6} />
            </Round>
          </>
        ) : null}
      </View>
      <Pressable onPress={choose} disabled={loading} accessibilityRole="button" style={st.pick}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={st.pickText}>{m.name ? 'Change song' : 'Choose song'}</Text>}
      </Pressable>
      <Stepper icon={<Music2 size={16} color={colors.muted} />} label="Song volume" value={m.songVolume} max={100} onChange={(v) => zego.setSongVolume(v).catch(fail)} />
      <Stepper icon={<Mic size={16} color={colors.muted} />} label="Mic volume" value={m.micVolume} max={200} onChange={(v) => zego.setMicVolume(v).catch(fail)} />
    </View>
  );
}

function Round({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={st.round}>
      {children}
    </Pressable>
  );
}

// shortcut: 10% steps instead of a slider, no slider dependency; swap in one if people want finer control.
function Stepper({ icon, label, value, max, onChange }: { icon: React.ReactNode; label: string; value: number; max: number; onChange: (v: number) => void }) {
  const step = (d: number) => onChange(Math.min(max, Math.max(0, value + d)));
  return (
    <View
      style={st.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value, text: `${value}%` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 10 : -10)}>
      {icon}
      <Text style={[st.grow, st.label]}>{label}</Text>
      <Round label={`Lower ${label.toLowerCase()}`} onPress={() => step(-10)}>
        <Minus size={16} color="#fff" strokeWidth={2.6} />
      </Round>
      <Text style={st.value}>{value}%</Text>
      <Round label={`Raise ${label.toLowerCase()}`} onPress={() => step(10)}>
        <Plus size={16} color="#fff" strokeWidth={2.6} />
      </Round>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: space(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(95,180,255,0.14)', borderWidth: 1, borderColor: 'rgba(143,211,255,0.35)' },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  round: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pick: { height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pickText: { color: '#fff', fontWeight: '800' },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  value: { color: colors.text, fontWeight: '700', minWidth: 44, textAlign: 'center' },
});
