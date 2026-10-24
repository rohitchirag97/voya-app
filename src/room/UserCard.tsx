import { ArmchairIcon, ArrowDownToLine, AtSign, Ban, Gift, MessageCircle, Mic, MicOff, Settings, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorText, followLabel, getProfile, isFriend, setFollowing, type UserProfile } from '../api';
import { DecorBanner, FRAME_SCALE, FramedAvatar } from '../components/Decor';
import { FollowIcon, RoleTag, roleOf } from '../components/Icons';
import { BadgeRow } from '../components/Badges';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { UserIds } from '../components/UserIds';
import { LevelBadge } from '../components/Level';
import { Button, SHEET_BG_HEIGHT, SHEET_HERO, Sheet, rs as s, toast } from '../components/ui';
import { useNav } from '../nav';
import { roomColors as colors, radius, space } from '../theme';
import { useRoomSession } from './RoomSession';

type Props = {
  userId: string | null;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onGift: (userId: string) => void;
  onTag: (userId: string, handle: string) => void;
};

// Icon-only buttons; `label` is read by screen readers and shown on long-press.
type Action = { icon: React.ReactNode; label: string; onPress: () => void; danger?: boolean };

// The one place to act on a person in the room: tap a name in chat, a seat, or a row in People.
// Tapping the picture opens the full profile (the room minimizes).
export function UserCard({ userId, onClose, onOpenProfile, onGift, onTag }: Props) {
  const room = useRoomSession();
  const nav = useNav();
  const me = nav.me!;
  const [p, setP] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);

  const cached = userId ? room?.profiles[userId] : undefined;
  useEffect(() => {
    // Show the room's prefetched card at once; the fetch refreshes it (and counts the visit).
    setP(cached ?? null);
    setGearOpen(false);
    if (userId)
      getProfile(userId)
        .then((fresh) => {
          setP(fresh);
          room?.cacheProfile(fresh);
        })
        .catch((e) => {
          if (cached) return;
          toast(errorText(e));
          onClose();
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const snap = room?.snap;
  const seat = snap?.seats.find((x) => !!userId && x.occupant?.userId === userId);
  const isMe = userId === me.userId;
  const isAdmin = !!userId && !!snap?.admins.includes(userId);
  const canMod = !!userId && !!room?.canModerate(userId);
  const role = snap ? roleOf(userId, { hostUserId: snap.hostUserId, admins: snap.admins, seated: !!seat }) : null;
  // The raised picture's ring shows the role at a glance.
  const ringColor = userId === snap?.hostUserId ? colors.gold : isAdmin ? colors.accent : colors.primary;

  // Close the card, run the action, toast any error.
  const act = (fn: () => Promise<unknown>, done?: string) => {
    onClose();
    fn()
      .then(() => done && toast(done))
      .catch((e) => toast(e instanceof Error && !('code' in e) ? e.message : errorText(e)));
  };

  async function toggleFollow() {
    if (!p) return;
    setBusy(true);
    try {
      await setFollowing(p.userId, !p.isFollowing);
      const next = { ...p, isFollowing: !p.isFollowing, followers: p.followers + (p.isFollowing ? -1 : 1) };
      setP(next);
      room?.cacheProfile(next);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const actions: Action[] = [];
  if (room && userId) {
    if (!isMe && p?.displayName) {
      const handle = p.displayName;
      actions.push({ icon: <AtSign size={21} color={colors.text} />, label: `Tag ${handle} in chat`, onPress: () => (onClose(), onTag(userId, handle)) });
    }
    if (seat) actions.push({ icon: <Gift size={21} color={colors.primary} />, label: isMe ? 'Gift yourself' : 'Send gift', onPress: () => onGift(userId) });
    if (isMe && seat) {
      actions.push({
        icon: seat.micMuted ? <Mic size={21} color={colors.success} /> : <MicOff size={21} color={colors.text} />,
        label: seat.micMuted ? 'Unmute' : 'Mute',
        onPress: () => act(() => room.setMuted(me.userId, !seat.micMuted)),
      });
      actions.push({ icon: <ArrowDownToLine size={21} color={colors.text} />, label: 'Leave seat', onPress: () => act(room.releaseSeat) });
    }
    if (canMod && seat) {
      actions.push({
        icon: seat.modMuted ? <Mic size={21} color={colors.success} /> : <MicOff size={21} color={colors.danger} />,
        label: seat.modMuted ? 'Unmute (lift admin mute)' : 'Mute (they can’t unmute)',
        onPress: () => act(() => room.setMuted(userId, !seat.modMuted), seat.modMuted ? 'Admin mute lifted' : 'Muted. They can’t unmute themselves.'),
      });
      actions.push({ icon: <ArrowDownToLine size={21} color={colors.text} />, label: 'Remove from seat', onPress: () => act(() => room.removeFromSeat(userId)) });
    }
    if (canMod && !seat) {
      const free = snap?.seats.find((x) => x.seatIndex > 0 && !x.occupant);
      actions.push({
        icon: <ArmchairIcon size={21} color={colors.text} />,
        label: 'Invite to seat',
        onPress: () => (free ? act(() => room.inviteToSeat(free.seatIndex, userId), 'Invite sent') : toast('No free seats right now.')),
      });
    }
    if (canMod) actions.push({ icon: <Ban size={21} color={colors.danger} />, label: 'Remove from room', danger: true, onPress: () => act(() => room.remove(userId)) });
  }
  const showGear = !!room?.isHost && !isMe;

  return (
    <Sheet
      visible={!!userId}
      onClose={onClose}
      background={p?.cardDecor ? <DecorBanner svg={p.cardDecor.svg} height={SHEET_BG_HEIGHT} /> : null}
      hero={
        p ? (
          <Pressable
            onPress={() => onOpenProfile(p.userId)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${p.displayName}'s profile`}
            accessibilityHint="The room keeps playing in a small bubble"
            // A frame is drawn bigger than the picture; pull it up so the picture stays centred on the edge.
            style={p.avatarFrame ? { marginTop: -((SHEET_HERO - 12) * FRAME_SCALE - SHEET_HERO) / 2 } : [st.heroRing, { borderColor: ringColor }]}>
            <FramedAvatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={SHEET_HERO - 12} frameSvg={p.avatarFrame?.svg} />
          </Pressable>
        ) : null
      }>
      {!p ? (
        <ActivityIndicator color={colors.primary} style={{ paddingVertical: space(8) }} />
      ) : (
        <View style={st.body}>
          <View style={st.nameRow}>
            <Text style={st.name} onPress={() => onOpenProfile(p.userId)} accessibilityRole="link">
              {p.displayName}
            </Text>
            <OfficialMark role={p.staffRole} size={20} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {p.level ? <LevelBadge level={p.level.level} size="md" /> : null}
            <SvipBadge tier={p.svip} size="md" />
            {role ? <RoleTag role={role} /> : null}
          </View>
          <UserIds publicId={p.publicId} specialId={p.specialId} />
          {p.bio ? <Text style={[s.muted, { textAlign: 'center' }]}>{p.bio}</Text> : null}
          <BadgeRow badges={p.badges ?? []} />
          {p.week ? (
            <View style={st.weekWrap} accessibilityLabel={`This week: ${p.week.contribution} contribution, ${p.week.charisma} charisma`}>
              <View style={st.weekRow}>
                <View style={st.weekTile}>
                  <Gift size={16} color={colors.gold} strokeWidth={2.4} />
                  <View>
                    <Text style={st.weekNum}>{p.week.contribution.toLocaleString('en-IN')}</Text>
                    <Text style={st.weekLabel}>Contribution</Text>
                  </View>
                </View>
                <View style={st.weekTile}>
                  <Sparkles size={16} color="#FF6FA8" strokeWidth={2.4} />
                  <View>
                    <Text style={st.weekNum}>{p.week.charisma.toLocaleString('en-IN')}</Text>
                    <Text style={st.weekLabel}>Charisma</Text>
                  </View>
                </View>
              </View>
              <Text style={st.weekNote}>This week · resets Monday</Text>
            </View>
          ) : null}
          <View style={st.stats}>
            <Text style={s.muted}>
              <Text style={st.num}>{p.followers}</Text> {p.followers === 1 ? "follower" : "followers"}
            </Text>
            <Text style={s.muted}>
              <Text style={st.num}>{p.following}</Text> following
            </Text>
          </View>
          {!p.isMe ? (
            <View style={st.followRow}>
              <Button title={followLabel(p)} icon={<FollowIcon p={p} />} variant={p.isFollowing ? 'ghost' : 'primary'} onPress={toggleFollow} loading={busy} style={{ flex: 1 }} />
              {isFriend(p) ? (
                <Button
                  title="Message"
                  icon={<MessageCircle size={18} color="#fff" strokeWidth={2.4} />}
                  onPress={() => {
                    onClose();
                    nav.push({ name: 'dm', userId: p.userId, displayName: p.displayName, staffRole: p.staffRole }); // room keeps running as a bubble
                  }}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          ) : null}
          {actions.length ? (
            <View style={st.icons}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.onPress}
                  onLongPress={() => toast(a.label)}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  hitSlop={4}
                  style={({ pressed }) => [st.icon, a.danger && st.iconDanger, pressed && { opacity: 0.7 }]}>
                  {a.icon}
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {/* Owner-only role settings live behind the gear, top-left. */}
      {p && showGear && userId ? (
        <View style={st.gearWrap}>
          <Pressable onPress={() => setGearOpen((o) => !o)} accessibilityRole="button" accessibilityLabel="Role settings" hitSlop={10} style={st.gear}>
            <Settings size={20} color={colors.text} />
          </Pressable>
          {gearOpen ? (
            <View style={st.menu}>
              <Pressable
                onPress={() =>
                  act(() => room!.setAdmin(userId, !isAdmin), isAdmin ? `${p.displayName} is no longer an admin` : `${p.displayName} is now an admin`)
                }
                accessibilityRole="button"
                style={st.menuItem}>
                {isAdmin ? <ShieldOff size={18} color={colors.danger} /> : <ShieldCheck size={18} color={colors.accent} />}
                <Text style={st.menuText}>{isAdmin ? 'Remove admin' : 'Make admin'}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  body: { alignItems: 'center', gap: space(2), paddingTop: space(2) },
  // Ring = card colour outside, role colour inside, so the picture looks cut into the card's edge.
  heroRing: {
    width: SHEET_HERO,
    height: SHEET_HERO,
    borderRadius: SHEET_HERO / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    backgroundColor: colors.surface,
    elevation: 8,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800' },
  badge: { color: colors.muted, fontSize: 12, backgroundColor: colors.surfaceHigh, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  weekWrap: { alignSelf: 'stretch', gap: 4, alignItems: 'center' },
  weekRow: { flexDirection: 'row', gap: space(2), alignSelf: 'stretch' },
  weekTile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(2), paddingHorizontal: space(3), borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  weekNum: { color: colors.text, fontSize: 16, fontWeight: '900' },
  weekLabel: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  weekNote: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: space(6), marginVertical: space(1) },
  num: { color: colors.text, fontWeight: '800' },
  followRow: { flexDirection: 'row', gap: space(2), alignSelf: 'stretch', marginTop: space(1) },
  icons: { flexDirection: 'row', gap: space(3), justifyContent: 'center', marginTop: space(3) },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconDanger: { borderColor: colors.danger, backgroundColor: colors.danger + '22' },
  iconText: { fontSize: 22, color: colors.text, fontWeight: '800' },
  gearWrap: { position: 'absolute', top: space(4), left: space(4), zIndex: 2 },
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  menu: {
    marginTop: space(2),
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 8,
    minWidth: 180,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: space(3), paddingHorizontal: space(4) },
  menuText: { color: colors.text, fontWeight: '600' },
});
