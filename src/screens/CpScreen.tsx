import { ChevronLeft, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { errorText, getCards, type CpLevel, type CpType, type Relationship, type UserProfile } from '../api';
import { confirmEndCp, CP_LOOK, cpName, daysSince, daysText, ProposeCpSheet, useCpOptions } from '../components/Cp';
import { CpLink } from '../components/CpLink';
import { FramedAvatar } from '../components/Decor';
import { Gradient } from '../components/Gradient';
import { Button, Screen, toast } from '../components/ui';
import { useNav } from '../nav';
import { useCatalog } from '../room/catalog';
import { colors, radius, space } from '../theme';

const LOVE_AVATAR = 76;
const SLOT_AVATAR = 54;

// Everyone's CPs on one screen: the Love CP up top, then best friends and brothers & sisters as slot grids.
// Your own: tap someone to end it. Someone else's: tap to open that person, or send them a request.
export function CpScreen({ userId }: { userId: string }) {
  const nav = useNav();
  const me = nav.me!;
  const o = useCpOptions();
  const catalog = useCatalog();
  const [p, setP] = useState<UserProfile | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);

  useEffect(() => {
    // The card endpoint: same data as the profile, without counting as a visit.
    getCards([userId])
      .then((r) => setP(r.profiles[0] ?? null))
      .catch((e) => (toast(errorText(e)), nav.back()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const isMe = userId === me.userId;
  const frame = (id: string | null | undefined) => (id ? catalog.frames[id]?.svg : undefined);
  const rels = p?.relationships ?? [];
  const love = rels.find((r) => r.type === 'LOVE');
  const pairedWithMe = rels.some((r) => r.user.userId === me.userId);

  async function tap(r: Relationship) {
    if (!isMe) return nav.push({ name: 'user', userId: r.user.userId });
    if (p && (await confirmEndCp(r))) setP({ ...p, relationships: p.relationships.filter((x) => x.pairId !== r.pairId) });
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <View style={st.grow}>
          <Text style={st.h1}>CP</Text>
          {p && !isMe ? <Text style={st.sub}>{p.displayName}</Text> : null}
        </View>
      </View>

      {!p ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: space(10) }} />
      ) : (
        <ScrollView contentContainerStyle={st.body}>
          {/* Love: both pictures joined by the neon link. */}
          <Gradient colors={['#FF4F8B', '#8B5CF6']} style={st.loveCard}>
            <Text style={st.loveTitle}>💍 Love CP</Text>
            <View style={st.loveRow}>
              <Person name={p.displayName} id={p.userId} uri={p.avatarUrl} frame={p.avatarFrame?.svg} size={LOVE_AVATAR} light />
              {love ? (
                <CpLink width={84} height={LOVE_AVATAR} type="LOVE" label={null} />
              ) : (
                <View style={{ width: 84 }} />
              )}
              {love ? (
                <Pressable
                  onPress={() => tap(love)}
                  accessibilityRole="button"
                  accessibilityLabel={`Love CP: ${love.user.displayName}${isMe ? '. Double tap to end' : ''}`}>
                  <Person name={love.user.displayName} id={love.user.userId} uri={love.user.avatarUrl} frame={frame(love.user.frameId)} size={LOVE_AVATAR} light />
                </Pressable>
              ) : (
                <EmptySlot size={LOVE_AVATAR} light />
              )}
            </View>
            {love ? (
              <>
                <Text style={st.loveNote}>Together {daysText(love.since)}</Text>
                <LevelBar level={love.level} light />
              </>
            ) : (
              <Text style={st.loveNote}>{isMe ? 'No Love CP yet. Send a request from someone’s profile.' : 'No Love CP yet'}</Text>
            )}
          </Gradient>

          <Slots title="Best friends" type="BESTIE" max={o?.types.BESTIE.max ?? 4} rels={rels} frame={frame} onTap={tap} isMe={isMe} />
          <Slots title="Brothers & sisters" type="SIBLING" max={o?.types.SIBLING.max ?? 7} rels={rels} frame={frame} onTap={tap} isMe={isMe} />

          {!isMe && !pairedWithMe ? <Button title="Send CP request" onPress={() => setProposeOpen(true)} /> : null}

          {/* How the level grows: the same weights the server uses. */}
          {o ? (
            <View style={st.how}>
              <Text style={st.sectionTitle}>How CP level grows</Text>
              <HowRow emoji="🎁" text="Gifts to each other" points={`${o.points.giftPerCoin} per coin`} />
              <HowRow emoji="💬" text="Messages in your inbox chat" points={`${o.points.dm.each} each · up to ${o.points.dm.dailyCap} a day`} />
              <HowRow emoji="🏠" text="In the same room" points={`${o.points.together.present} a minute`} />
              <HowRow emoji="🎤" text="Both on seats in the same room" points={`${o.points.together.seated} a minute · up to ${o.points.together.dailyCap} a day`} />
              <Text style={st.hint}>Each level needs more points than the one before.</Text>
            </View>
          ) : null}
          {isMe && rels.length ? <Text style={st.hint}>Tap someone to end that CP.</Text> : null}
        </ScrollView>
      )}
      {p && !isMe ? <ProposeCpSheet visible={proposeOpen} onClose={() => setProposeOpen(false)} to={p} /> : null}
    </Screen>
  );
}

function Slots({ title, type, max, rels, frame, onTap, isMe }: {
  title: string;
  type: CpType;
  max: number;
  rels: Relationship[];
  frame: (id: string | null | undefined) => string | undefined;
  onTap: (r: Relationship) => void;
  isMe: boolean;
}) {
  const mine = rels.filter((r) => r.type === type);
  const look = CP_LOOK[type];
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>
        {look.emoji} {title} <Text style={st.count}>{mine.length}/{max}</Text>
      </Text>
      <View style={st.grid}>
        {mine.map((r) => (
          <Pressable
            key={r.pairId}
            onPress={() => onTap(r)}
            accessibilityRole="button"
            accessibilityLabel={`${cpName(r.type, r.label)}: ${r.user.displayName}${isMe ? '. Double tap to end' : ''}`}
            style={st.slot}>
            <View style={[st.ring, { borderColor: look.tint }]}>
              <FramedAvatar id={r.user.userId} name={r.user.displayName} uri={r.user.avatarUrl} size={SLOT_AVATAR} frameSvg={frame(r.user.frameId)} />
            </View>
            <Text style={st.slotName} numberOfLines={1}>{r.user.displayName}</Text>
            <Text style={[st.slotTag, { color: look.tint }]}>
              {type === 'SIBLING' ? `${cpName(type, r.label)} · ` : ''}Lv.{r.level.level}
            </Text>
            <Text style={st.slotDays}>{daysSince(r.since)}d</Text>
          </Pressable>
        ))}
        {Array.from({ length: max - mine.length }, (_, i) => (
          <View key={`e${i}`} style={st.slot} accessibilityElementsHidden importantForAccessibility="no">
            <EmptySlot size={SLOT_AVATAR} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Level badge and a bar showing progress to the next level.
function LevelBar({ level, light }: { level: CpLevel; light?: boolean }) {
  const span = level.next === null ? 1 : level.next - level.current;
  const done = level.next === null ? 1 : (level.points - level.current) / span;
  return (
    <View style={st.levelWrap} accessibilityLabel={`Level ${level.level}${level.next === null ? ', max level' : `, ${level.next - level.points} points to the next level`}`}>
      <View style={st.levelHead}>
        <Text style={[st.levelText, light && st.white]}>Lv.{level.level}</Text>
        <Text style={[st.levelPts, light && st.whiteSoft]}>
          {level.next === null ? 'Max level' : `${level.points.toLocaleString('en-IN')} / ${level.next.toLocaleString('en-IN')}`}
        </Text>
      </View>
      <View style={[st.track, light && st.trackLight]}>
        <View style={[st.fill, { width: `${Math.max(3, Math.min(100, done * 100))}%` }]} />
      </View>
    </View>
  );
}

const HowRow = ({ emoji, text, points }: { emoji: string; text: string; points: string }) => (
  <View style={st.howRow}>
    <Text style={st.howEmoji}>{emoji}</Text>
    <Text style={st.howText}>{text}</Text>
    <Text style={st.howPts}>{points}</Text>
  </View>
);

function Person({ id, name, uri, frame, size, light }: { id: string; name: string | null; uri: string | null; frame?: string; size: number; light?: boolean }) {
  return (
    <View style={st.person}>
      <FramedAvatar id={id} name={name} uri={uri} size={size} frameSvg={frame} />
      <Text style={[st.personName, light && { color: '#fff' }]} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const EmptySlot = ({ size, light }: { size: number; light?: boolean }) => (
  <View style={[st.empty, { width: size, height: size, borderRadius: size / 2, borderColor: light ? 'rgba(255,255,255,0.6)' : colors.border }]}>
    <Plus size={size * 0.3} color={light ? '#fff' : colors.muted} />
  </View>
);

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(4), paddingVertical: space(3) },
  grow: { flex: 1 },
  h1: { color: colors.text, fontSize: 22, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 13 },
  body: { padding: space(4), gap: space(5), paddingBottom: space(10) },
  loveCard: { borderRadius: radius.lg, padding: space(4), gap: space(3), alignItems: 'center', overflow: 'hidden' },
  loveTitle: { color: '#fff', fontSize: 16, fontWeight: '900', alignSelf: 'flex-start' },
  loveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loveNote: { color: '#fff', fontSize: 13, fontWeight: '700', opacity: 0.95 },
  person: { alignItems: 'center', gap: 4, maxWidth: 110 },
  personName: { color: colors.text, fontSize: 13, fontWeight: '700' },
  section: { gap: space(3) },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  count: { color: colors.muted, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  slot: { width: 72, alignItems: 'center', gap: 3 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2 },
  slotName: { color: colors.text, fontSize: 12, fontWeight: '600', maxWidth: 72 },
  slotTag: { fontSize: 11, fontWeight: '800' },
  empty: { borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  slotDays: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  levelWrap: { alignSelf: 'stretch', gap: 4 },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  levelText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  levelPts: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  white: { color: '#fff' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' },
  trackLight: { backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#FFE38A' },
  how: { gap: space(2), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  howEmoji: { fontSize: 18, width: 26 },
  howText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
  howPts: { color: colors.primary, fontSize: 12, fontWeight: '800', textAlign: 'right', maxWidth: '45%' },
});
