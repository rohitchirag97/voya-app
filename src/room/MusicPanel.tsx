import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import { Check, ChevronDown, ChevronLeft, FolderOpen, Mic, Minus, Music2, Pause, Play, Plus, Search, SkipBack, SkipForward, Square, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, NativeModules, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, rs as s, toast } from '../components/ui';
import { zego, type Music, type Song } from '../services/ZegoAudioRoomService';
import { roomColors as colors, radius, space } from '../theme';

// Android only (MusicLibrary.kt): the phone's songs. iOS falls back to picking files.
const MusicLibrary: { list(): Promise<Song[]> } | undefined = NativeModules.MusicLibrary;
const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong');
const time = (ms: number | null) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}` : '');
const ROW = 60;

export function useMusic() {
  const [m, setM] = useState<Music>(zego.music);
  useEffect(() => zego.subscribeMusic(setM), []);
  return m;
}

async function audioPermission() {
  if (Platform.OS !== 'android') return 'granted';
  const perm = Platform.Version >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  return PermissionsAndroid.request(perm, {
    title: 'Your music',
    message: 'VoyaLive needs your music files so you can pick songs to play in the room.',
    buttonPositive: 'Allow',
  });
}

// Files from the system picker get a local copy: ZEGO needs a plain file path (it can't read iOS security-scoped urls).
async function browseFiles(): Promise<Song[]> {
  try {
    const files = await pick({ type: [types.audio], allowMultiSelection: true });
    const copies = await keepLocalCopy({ files: files.map((f) => ({ uri: f.uri, fileName: f.name ?? 'song' })) as [{ uri: string; fileName: string }], destination: 'cachesDirectory' });
    return copies.flatMap((c, i) =>
      c.status === 'success'
        ? [{ id: c.sourceUri, uri: decodeURIComponent(c.localUri.replace(/^file:\/\//, '')), title: (files[i]!.name ?? 'Song').replace(/\.[^.]+$/, ''), artist: null, durationMs: null }]
        : [],
    );
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return [];
    throw e;
  }
}

// Shown in the room while a song is loaded; opens the music page.
export function MusicPill({ onPress }: { onPress: () => void }) {
  const m = useMusic();
  const song = m.queue[m.current];
  if (!song) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${m.playing ? 'Playing' : 'Paused'}: ${song.title}. Open music`} style={st.pill}>
      {m.playing ? <Music2 size={14} color="#fff" strokeWidth={2.6} /> : <Pause size={14} color="#fff" strokeWidth={2.6} />}
      <Text style={st.pillText} numberOfLines={1}>{song.title}</Text>
    </Pressable>
  );
}

// Full-screen music page: now playing, volumes and the playlist; "Add songs" switches to the phone's songs.
export function MusicPanel({ visible, onClose, seated }: { visible: boolean; onClose: () => void; seated: boolean }) {
  const [adding, setAdding] = useState(false);
  const i = useSafeAreaInsets();
  const close = () => (adding ? setAdding(false) : onClose());
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={[st.page, { paddingTop: i.top + space(2), paddingBottom: i.bottom + space(2) }]}>
        {adding ? <Library onBack={() => setAdding(false)} /> : <Playlist onClose={onClose} onAdd={() => setAdding(true)} seated={seated} />}
      </View>
    </Modal>
  );
}

function Playlist({ onClose, onAdd, seated }: { onClose: () => void; onAdd: () => void; seated: boolean }) {
  const m = useMusic();
  const song = m.queue[m.current];
  return (
    <>
      <View style={st.header}>
        <IconButton label="Close music" onPress={onClose} size={36}>
          <ChevronDown size={22} color={colors.text} />
        </IconButton>
        <Text style={st.h1}>Music</Text>
        <Pressable onPress={onAdd} accessibilityRole="button" style={st.addBtn}>
          <Plus size={16} color="#fff" strokeWidth={2.8} />
          <Text style={st.addText}>Add songs</Text>
        </Pressable>
      </View>

      {!seated ? <Text style={st.notice}>Take a seat to play music. Everyone in the room hears what you play.</Text> : null}

      <View style={st.card}>
        <View style={st.row}>
          <View style={st.art}>
            <Music2 size={22} color="#8FD3FF" strokeWidth={2.4} />
          </View>
          <View style={st.grow}>
            <Text style={st.title} numberOfLines={1}>{song?.title ?? 'Nothing playing'}</Text>
            <Text style={s.muted} numberOfLines={1}>{song ? song.artist ?? (m.playing ? 'Everyone in the room hears it' : 'Paused') : m.queue.length ? 'Tap a song to play it' : 'Add songs from your phone'}</Text>
          </View>
        </View>
        {song ? (
          <View style={st.controls}>
            <Round label="Previous song" onPress={() => zego.playFrom(Math.max(0, m.current - 1)).catch(fail)}>
              <SkipBack size={18} color="#fff" strokeWidth={2.4} />
            </Round>
            <Round big label={m.playing ? 'Pause' : 'Resume'} onPress={() => zego.toggleSong().catch(fail)}>
              {m.playing ? <Pause size={22} color="#fff" strokeWidth={2.6} /> : <Play size={22} color="#fff" strokeWidth={2.6} />}
            </Round>
            <Round label="Next song" onPress={() => zego.playFrom(m.current + 1).catch(fail)}>
              <SkipForward size={18} color="#fff" strokeWidth={2.4} />
            </Round>
            <Round label="Stop" onPress={() => zego.stopSong().catch(fail)}>
              <Square size={16} color="#fff" strokeWidth={2.6} />
            </Round>
          </View>
        ) : null}
        <Stepper icon={<Music2 size={16} color={colors.muted} />} label="Song volume" value={m.songVolume} max={100} onChange={(v) => zego.setSongVolume(v).catch(fail)} />
        <Stepper icon={<Mic size={16} color={colors.muted} />} label="Mic volume" value={m.micVolume} max={200} onChange={(v) => zego.setMicVolume(v).catch(fail)} />
      </View>

      <View style={st.listHead}>
        <Text style={st.heading}>Playlist · {m.queue.length} {m.queue.length === 1 ? 'song' : 'songs'}</Text>
        {m.queue.length ? (
          <Pressable onPress={() => zego.clearSongs().catch(fail)} accessibilityRole="button" hitSlop={8}>
            <Text style={st.link}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={m.queue}
        keyExtractor={(x) => x.id}
        getItemLayout={(_, n) => ({ length: ROW, offset: ROW * n, index: n })}
        ListEmptyComponent={<Button title="Add songs" onPress={onAdd} style={st.emptyBtn} />}
        renderItem={({ item, index }) => {
          const on = index === m.current;
          return (
            <Pressable onPress={() => zego.playFrom(index).catch(fail)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`Play ${item.title}`} style={[st.song, on && st.songOn]}>
              <Text style={[st.num, on && { color: colors.primary }]}>{on ? '♪' : index + 1}</Text>
              <View style={st.grow}>
                <Text style={[st.songTitle, on && { color: colors.primary }]} numberOfLines={1}>{item.title}</Text>
                <Text style={st.songSub} numberOfLines={1}>{[item.artist, time(item.durationMs)].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pressable onPress={() => zego.removeSong(index).catch(fail)} accessibilityRole="button" accessibilityLabel={`Remove ${item.title}`} hitSlop={10} style={st.remove}>
                <X size={16} color={colors.muted} strokeWidth={2.4} />
              </Pressable>
            </Pressable>
          );
        }}
      />
    </>
  );
}

// The phone's songs with checkboxes; "Add" puts the picked ones on the playlist (and starts it if idle).
function Library({ onBack }: { onBack: () => void }) {
  const m = useMusic();
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [denied, setDenied] = useState<'denied' | 'never' | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!MusicLibrary) return setSongs([]);
    const r = await audioPermission();
    if (r !== 'granted') return setDenied(r === 'never_ask_again' ? 'never' : 'denied');
    setDenied(null);
    MusicLibrary.list().then(setSongs, (e) => {
      setSongs([]);
      fail(e);
    });
  };
  useEffect(() => {
    load();
  }, []);

  const inPlaylist = useMemo(() => new Set(m.queue.map((x) => x.id)), [m.queue]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q && songs ? songs.filter((x) => x.title.toLowerCase().includes(q) || x.artist?.toLowerCase().includes(q)) : songs ?? [];
  }, [songs, query]);
  const choosable = shown.filter((x) => !inPlaylist.has(x.id));
  const allPicked = choosable.length > 0 && choosable.every((x) => picked.has(x.id));

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (!n.delete(id)) n.add(id);
      return n;
    });
  const add = async (list: Song[]) => {
    if (!list.length) return;
    setBusy(true);
    try {
      await zego.addSongs(list);
      onBack();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <View style={st.header}>
        <IconButton label="Back to playlist" onPress={onBack} size={36}>
          <ChevronLeft size={22} color={colors.text} />
        </IconButton>
        <Text style={st.h1}>Add songs</Text>
        <Pressable onPress={() => browseFiles().then(add).catch(fail)} accessibilityRole="button" style={st.addBtn}>
          <FolderOpen size={16} color="#fff" strokeWidth={2.4} />
          <Text style={st.addText}>Files</Text>
        </Pressable>
      </View>

      {songs?.length ? (
        <View style={st.search}>
          <Search size={16} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder={`Search ${songs.length} songs`} placeholderTextColor={colors.muted} style={st.searchInput} accessibilityLabel="Search songs" />
          {choosable.length ? (
            <Pressable onPress={() => setPicked(allPicked ? new Set() : new Set([...picked, ...choosable.map((x) => x.id)]))} accessibilityRole="button" hitSlop={8}>
              <Text style={st.link}>{allPicked ? 'Clear' : 'Select all'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {denied ? (
        <View style={st.empty}>
          <Text style={st.emptyText}>Allow access to your music to see the songs on your phone.</Text>
          <Button title={denied === 'never' ? 'Open settings' : 'Allow access'} onPress={() => (denied === 'never' ? Linking.openSettings() : load())} />
        </View>
      ) : songs === null ? (
        <ActivityIndicator color={colors.primary} style={st.empty} />
      ) : !songs.length ? (
        <View style={st.empty}>
          <Text style={st.emptyText}>{MusicLibrary ? 'No songs found on your phone.' : 'Pick songs from your files.'}</Text>
          <Button title="Browse files" onPress={() => browseFiles().then(add).catch(fail)} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(x) => x.id}
          getItemLayout={(_, n) => ({ length: ROW, offset: ROW * n, index: n })}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={15}
          renderItem={({ item }) => {
            const added = inPlaylist.has(item.id);
            const on = added || picked.has(item.id);
            return (
              <Pressable
                onPress={() => !added && toggle(item.id)}
                disabled={added}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: added }}
                accessibilityLabel={added ? `${item.title}, already in playlist` : item.title}
                style={st.song}>
                <View style={[st.box, on && st.boxOn, added && st.boxAdded]}>{on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}</View>
                <View style={st.grow}>
                  <Text style={[st.songTitle, added && { color: colors.muted }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={st.songSub} numberOfLines={1}>{added ? 'In playlist' : [item.artist, time(item.durationMs)].filter(Boolean).join(' · ')}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {picked.size ? (
        <Button
          title={`Add ${picked.size} ${picked.size === 1 ? 'song' : 'songs'}`}
          loading={busy}
          onPress={() => add((songs ?? []).filter((x) => picked.has(x.id)))}
          style={st.footer}
        />
      ) : null}
    </>
  );
}

function Round({ label, onPress, children, big }: { label: string; onPress: () => void; children: React.ReactNode; big?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[st.round, big && st.roundBig]}>
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
  page: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space(4), gap: space(3) },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  h1: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.primary },
  addText: { color: '#fff', fontWeight: '800' },
  notice: { color: colors.gold, fontSize: 13, backgroundColor: 'rgba(255,201,77,0.1)', padding: space(3), borderRadius: radius.md },
  card: { gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  art: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(95,180,255,0.14)' },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(4) },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  roundBig: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, borderWidth: 0 },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  value: { color: colors.text, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  link: { color: '#FF8AC6', fontWeight: '700', fontSize: 13 },
  song: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(2), borderRadius: radius.md },
  songOn: { backgroundColor: colors.primaryDim },
  num: { width: 22, textAlign: 'center', color: colors.muted, fontWeight: '700' },
  songTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  songSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  remove: { padding: space(1) },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxAdded: { backgroundColor: colors.surfaceHigh, borderColor: colors.surfaceHigh },
  search: { flexDirection: 'row', alignItems: 'center', gap: space(2), height: 44, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  empty: { marginTop: space(8), alignItems: 'center', gap: space(4) },
  emptyText: { color: colors.muted, textAlign: 'center' },
  emptyBtn: { marginTop: space(4) },
  footer: { marginTop: space(1) },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 180, height: 30, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: 'rgba(255,61,139,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 },
});
