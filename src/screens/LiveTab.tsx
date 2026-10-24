import { Lock, Radio, Swords, Users, Video } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { getMyLive, imageUri, listLives, type RoomCard } from '../api';
import { Gradient } from '../components/Gradient';
import { Avatar } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space, tintPairFor } from '../theme';

// Home "Live" tab: Go live (or back to yours) and everyone streaming as a 2-column grid, refreshed every 30s.
export function LiveTab({ width }: { width: number }) {
  const nav = useNav();
  const [lives, setLives] = useState<RoomCard[]>([]);
  const [mine, setMine] = useState<RoomCard | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [l, m] = await Promise.all([listLives(), getMyLive()]);
      setLives(l.rooms);
      setMine(m.room);
    } catch {
      // keep the last list; the next poll retries
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);
  const others = lives.filter((l) => l.roomId !== mine?.roomId);

  return (
    <FlatList
      style={{ width }}
      data={others}
      keyExtractor={(r) => r.roomId}
      numColumns={2}
      columnWrapperStyle={{ gap: space(3) }}
      contentContainerStyle={st.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} colors={[colors.primary]} />}
      ListHeaderComponent={
        <Pressable
          onPress={() => (mine ? nav.openRoom(mine.roomId) : nav.push({ name: 'goLive' }))}
          accessibilityRole="button"
          style={({ pressed }) => [st.go, pressed && { opacity: 0.85 }]}>
          <Gradient colors={['#FF3D5A', '#FF7A45']} style={StyleSheet.absoluteFill} />
          {mine ? <Radio size={17} color="#fff" strokeWidth={2.6} /> : <Video size={17} color="#fff" strokeWidth={2.6} />}
          <Text style={st.goText}>{mine ? 'Back to your live' : 'Go live'}</Text>
        </Pressable>
      }
      ListEmptyComponent={loading ? undefined : <Text style={st.empty}>{mine ? 'Nobody else is live right now.' : 'Nobody is live right now. Be the first!'}</Text>}
      renderItem={({ item }) => <LiveCard live={item} onPress={() => nav.openRoom(item.roomId)} />}
    />
  );
}

function LiveCard({ live: l, onPress }: { live: RoomCard; onPress: () => void }) {
  const { width } = useWindowDimensions();
  const w = (width - space(4) * 2 - space(3)) / 2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${l.host.displayName} is live: ${l.title}, ${l.listenerCount} watching`}
      style={({ pressed }) => [st.card, { width: w, height: w * 1.35 }, pressed && { opacity: 0.9 }]}>
      <Gradient colors={tintPairFor(l.roomId)} style={StyleSheet.absoluteFill} />
      {/* The host's photo fills the card; without one, their initial avatar sits in the middle. */}
      {l.host.avatarUrl ? (
        <Image source={{ uri: imageUri(l.host.avatarUrl) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={st.center}>
          <Avatar id={l.host.userId} name={l.host.displayName} size={72} ring="#FF3D5A" />
        </View>
      )}
      <View style={st.top}>
        <View style={st.liveTag}>
          <Text style={st.tagText}>LIVE</Text>
        </View>
        {l.inPk ? (
          <View style={[st.liveTag, st.pkTag]}>
            <Swords size={10} color="#fff" strokeWidth={2.8} />
            <Text style={st.tagText}>PK</Text>
          </View>
        ) : null}
        <View style={st.viewers}>
          {l.privacy === 'LOCKED' ? <Lock size={10} color="#fff" strokeWidth={2.8} accessibilityLabel="Locked" /> : null}
          <Users size={10} color="#fff" strokeWidth={2.8} />
          <Text style={st.metaText}>{l.listenerCount}</Text>
        </View>
      </View>
      <Gradient vertical colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={st.shade} />
      <View style={st.bottom}>
        <Text style={st.name} numberOfLines={1}>
          {l.host.displayName}
        </Text>
        <Text style={st.metaText} numberOfLines={1}>
          {l.title}
        </Text>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  list: { padding: space(4), paddingBottom: 140, gap: space(3) },
  go: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: space(3), borderRadius: radius.lg, overflow: 'hidden' },
  goText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: space(2) },
  liveTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: '#FF3D5A' },
  pkTag: { backgroundColor: '#8B5CF6' },
  tagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  viewers: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 },
  bottom: { position: 'absolute', left: space(2), right: space(2), bottom: space(2), gap: 2 },
  name: { color: '#fff', fontSize: 15, fontWeight: '900' },
  metaText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: space(10) },
});
