import { Camera, CameraOff, Clock, Forward, Mic, RefreshCcw, Sparkles, Swords, UserMinus, UserPlus, Users, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorText, LIVE_PK_MINUTES, listLives, type LivePk, type RoomCard, type RoomSnapshot } from '../api';
import { confirmDialog, showDialog } from '../components/Dialog';
import { Gradient, RoomBackdrop } from '../components/Gradient';
import { Avatar, Sheet, toast } from '../components/ui';
import { zego, type Beauty } from '../services/ZegoAudioRoomService';
import { roomColors as colors, gradients, radius, space } from '../theme';
import { ChatList, Composer } from './ChatPanel';
import type { GameKey } from './GameSheet';
import type { RoomState } from './useRoom';
import { VideoTile } from './VideoTile';
import { MusicPill } from './MusicPanel';

const RED = '#FF4D6D';
const BLUE = '#3B82F6';
const short = (n: number) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(n));

// The live stream screen: host video (split screen during a PK), co-host tiles, chat and controls on top.
export function LiveStage({ room, snap, meId, onUserPress, onGift, onMore, onGames, onMessages, onEmotes, onMusic, onShare, onOpenGame, onClose, tag }: {
  room: RoomState;
  snap: RoomSnapshot;
  meId: string;
  onUserPress: (userId: string) => void;
  onGift: (userId?: string) => void;
  onMore: () => void;
  onGames: () => void;
  onMessages: () => void;
  onEmotes: () => void;
  onMusic: () => void;
  onShare: () => void; // invite friends
  onOpenGame: (g: GameKey) => void;
  onClose: () => void; // leave (viewers / co-hosts) or end (host)
  tag: { userId: string; handle: string; n: number } | null;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isHost = snap.hostUserId === meId;
  const hostSeat = snap.seats[0];
  const host = hostSeat?.occupant;
  const coHosts = snap.seats.slice(1).filter((s) => s.occupant);
  const videoCoHosts = coHosts.filter((s) => !s.cameraOff);
  const audioCoHosts = coHosts.filter((s) => s.cameraOff);
  const mySeat = room.mySeat;
  const pk = room.livePk;
  const [coHostOpen, setCoHostOpen] = useState(false);
  const [pkOpen, setPkOpen] = useState(false);
  const [beautyOpen, setBeautyOpen] = useState(false);
  const run = (fn: () => Promise<unknown>, ok?: string) =>
    fn()
      .then(() => ok && toast(ok))
      .catch((e) => toast(errorText(e)));

  // Incoming PK invite (host only): accept or decline.
  useEffect(() => {
    const inv = room.pkInvite;
    if (!inv) return;
    room.clearPkInvite();
    showDialog({
      title: 'PK challenge!',
      message: `${inv.from.host.displayName} (${inv.from.title}) wants a ${inv.minutes}-minute PK battle with you.`,
      Icon: Swords,
      tone: 'gold',
      actions: [
        { label: 'Accept', value: 'yes', kind: 'primary' },
        { label: 'Decline', value: 'no', kind: 'cancel' },
      ],
    }).then((v) => (v === 'yes' ? run(() => room.acceptPk(inv.pkId)) : run(() => room.declinePk(inv.pkId))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.pkInvite]);

  // During a PK each side shows its own host; this room is always on the left.
  const mine = pk ? (pk.a.roomId === snap.roomId ? pk.a : pk.b) : null;
  const theirs = pk ? (pk.a.roomId === snap.roomId ? pk.b : pk.a) : null;
  const splitH = Math.round((width / 2) * 1.5);

  return (
    <View style={st.fill}>
      {/* The stream's backdrop (Room settings → Background) shows around the split during co-hosting and PKs. */}
      <RoomBackdrop theme={snap.background} />
      {/* ---------- video ---------- */}
      {pk && mine && theirs ? (
        <View style={[st.split, { top: insets.top + 64, height: splitH }]}>
          <View style={st.half}>
            <SeatVideo seat={hostSeat} meId={meId} avatar={72} />
            <Text style={[st.halfName, { left: space(2) }]} numberOfLines={1}>
              {mine.host.displayName}
            </Text>
          </View>
          <View style={st.half}>
            <VideoTile streamId={theirs.streamId} otherRoom style={StyleSheet.absoluteFill} />
            <Text style={[st.halfName, { right: space(2) }]} numberOfLines={1}>
              {theirs.host.displayName}
            </Text>
          </View>
          <PkBar pk={pk} mineRoomId={snap.roomId} isHost={isHost} onEnd={() => run(() => room.cancelPk(pk.pkId))} />
        </View>
      ) : host && videoCoHosts.length ? (
        // Video co-hosts: split like a PK. 1 → side by side; 2 → host left, two stacked right; 3 → 2×2.
        <View style={[st.split, { top: insets.top + 64, height: splitH }]}>
          <View style={[st.half, videoCoHosts.length === 3 && st.column]}>
            {videoCoHosts.length === 3 ? (
              <>
                <GridCell seat={hostSeat} meId={meId} onPress={onUserPress} />
                <GridCell seat={videoCoHosts[2]} meId={meId} onPress={onUserPress} />
              </>
            ) : (
              <GridCell seat={hostSeat} meId={meId} onPress={onUserPress} />
            )}
          </View>
          <View style={[st.half, st.column]}>
            {videoCoHosts.slice(0, 2).map((s) => (
              <GridCell key={s.seatIndex} seat={s} meId={meId} onPress={onUserPress} />
            ))}
          </View>
          {/* Says "co-hosting" so nobody takes the split for a PK (a PK has swords, a timer and a score bar). */}
          <View style={st.coHostBanner} pointerEvents="none" accessibilityLabel="Co-hosting live together">
            <Users size={13} color="#fff" strokeWidth={2.6} />
            <Text style={st.coHostBannerText}>Co-hosting</Text>
          </View>
        </View>
      ) : host ? (
        <SeatVideo seat={hostSeat} meId={meId} avatar={128} />
      ) : (
        <View style={st.waiting}>
          <ActivityIndicator color="#fff" />
          <Text style={st.waitingText}>The host stepped away…</Text>
        </View>
      )}
      {/* Readability shade over the video; touches pass through to the tiles. */}
      <View style={st.shade} pointerEvents="none">
        <Gradient vertical colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={st.shade} />
      </View>

      {/* ---------- audio-only co-hosts: avatars (under the split, or down the right side); hidden during a PK ---------- */}
      {!pk && audioCoHosts.length ? (
        <View style={[videoCoHosts.length ? st.audioRow : st.coHosts, { top: insets.top + (videoCoHosts.length ? 64 + splitH + space(3) : 72) }]}>
          {audioCoHosts.map((s) => (
            <Pressable key={s.seatIndex} onPress={() => onUserPress(s.occupant!.userId)} accessibilityRole="button" accessibilityLabel={`Co-host ${s.occupant!.displayName}, audio only`} style={st.audioCoHost}>
              <Avatar id={s.occupant!.userId} name={s.occupant!.displayName} uri={s.occupant!.avatarUrl} size={52} ring="rgba(255,255,255,0.6)" />
              <View style={st.audioMini}>
                <Mic size={10} color="#fff" strokeWidth={2.8} />
              </View>
              <Text style={st.audioName} numberOfLines={1}>
                {s.occupant!.displayName}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* ---------- top bar ---------- */}
      <View style={[st.top, { paddingTop: insets.top + space(2) }]}>
        {host ? (
          <Pressable onPress={() => onUserPress(host.userId)} accessibilityRole="button" style={st.hostChip}>
            <Avatar id={host.userId} name={host.displayName} uri={host.avatarUrl} size={34} />
            <View style={{ flexShrink: 1 }}>
              <Text style={st.hostName} numberOfLines={1}>
                {host.displayName}
              </Text>
              <Text style={st.hostSub} numberOfLines={1}>
                {snap.title}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={st.topRight}>
          <View style={st.viewers}>
            <Users size={13} color="#fff" strokeWidth={2.6} />
            <Text style={st.viewersText}>{snap.participants.length}</Text>
          </View>
          <View style={st.liveTag}>
            <Text style={st.liveTagText}>LIVE</Text>
          </View>
          <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Invite friends" hitSlop={8} style={st.close}>
            <Forward size={17} color="#fff" strokeWidth={2.4} />
          </Pressable>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={isHost ? 'End live' : 'Leave live'} hitSlop={8} style={st.close}>
            <X size={20} color="#fff" strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>

      {/* ---------- camera / host controls (right side, above chat) ---------- */}
      {mySeat ? (
        // During a split (PK or video co-hosts) the buttons start under it, clear of the score bar and tiles.
        <View style={[st.controls, pk || videoCoHosts.length ? { top: insets.top + 64 + splitH + space(6) } : { bottom: 300 + insets.bottom }]}>
          <Ctrl label="Flip camera" onPress={() => zego.flipCamera()}>
            <RefreshCcw size={20} color="#fff" strokeWidth={2.4} />
          </Ctrl>
          <Ctrl label="Beauty" onPress={() => setBeautyOpen(true)}>
            <Sparkles size={20} color="#FFD3E6" strokeWidth={2.4} />
          </Ctrl>
          <Ctrl
            label={mySeat.cameraOff ? 'Turn camera on' : 'Turn camera off (audio only)'}
            onPress={() => run(() => room.setCameraOff(!mySeat.cameraOff))}>
            {mySeat.cameraOff ? <CameraOff size={20} color="#FF8A95" strokeWidth={2.4} /> : <Camera size={20} color="#fff" strokeWidth={2.4} />}
          </Ctrl>
          {isHost ? (
            <>
              <Ctrl label="Invite a co-host" onPress={() => setCoHostOpen(true)}>
                <UserPlus size={20} color="#fff" strokeWidth={2.4} />
              </Ctrl>
              {pk ? null : (
                <Ctrl label="PK battle" onPress={() => setPkOpen(true)} tone="gold">
                  <Swords size={20} color="#fff" strokeWidth={2.4} />
                </Ctrl>
              )}
            </>
          ) : (
            <Ctrl label="Leave co-hosting" onPress={() => run(() => room.releaseSeat(), 'You left co-hosting')}>
              <UserMinus size={20} color="#fff" strokeWidth={2.4} />
            </Ctrl>
          )}
        </View>
      ) : null}

      {/* ---------- chat + composer ---------- */}
      <View style={[st.chat, { paddingBottom: insets.bottom }]}>
        <View style={st.musicPill}>
          <MusicPill onPress={onMusic} />
        </View>
        <View style={st.chatList}>
          <ChatList
            messages={room.messages}
            participants={snap.participants}
            meId={meId}
            onEndReached={room.loadOlder}
            onUserPress={onUserPress}
            onOpenGame={onOpenGame}
            onEmote={onEmotes}
            unseenMentions={room.unseenMentions}
            onMentionsSeen={room.markMentionsSeen}
            roles={{ hostUserId: snap.hostUserId, admins: snap.admins }}
          />
        </View>
        <Composer
          participants={snap.participants}
          meId={meId}
          onSend={room.sendChat}
          onGift={() => onGift(undefined)}
          onMore={onMore}
          onGames={onGames}
          onMessages={onMessages}
          onEmotes={onEmotes}
          micMuted={mySeat ? mySeat.micMuted : null}
          onToggleMic={() => mySeat && run(() => room.setMuted(meId, !mySeat.micMuted))}
          tag={tag}
          minimal={isHost} // the person going live only needs chat and their mic
        />
      </View>

      <BeautySheet visible={beautyOpen} onClose={() => setBeautyOpen(false)} />
      {isHost ? <CoHostSheet visible={coHostOpen} onClose={() => setCoHostOpen(false)} room={room} snap={snap} pkOn={!!pk} /> : null}
      {isHost ? (
        <PkPickSheet
          visible={pkOpen}
          onClose={() => setPkOpen(false)}
          myRoomId={snap.roomId}
          onInvite={(roomId, minutes) => {
            setPkOpen(false);
            run(() => room.invitePk(roomId, minutes), 'PK invite sent. Waiting for them to accept…');
          }}
        />
      ) : null}
    </View>
  );
}

// One cell of the host + co-hosts split: their video with the name on it; tap for their profile card.
function GridCell({ seat, meId, onPress }: { seat: RoomSnapshot['seats'][number]; meId: string; onPress: (userId: string) => void }) {
  const o = seat.occupant!;
  return (
    <Pressable onPress={() => onPress(o.userId)} accessibilityRole="button" accessibilityLabel={o.displayName ?? 'Co-host'} style={st.cell}>
      <SeatVideo seat={seat} meId={meId} avatar={64} />
      <View style={st.cellFoot}>
        <View style={[st.roleTag, seat.seatIndex === 0 ? st.roleHost : st.roleCo]}>
          <Text style={[st.roleText, seat.seatIndex === 0 && { color: '#2a1d05' }]}>{seat.seatIndex === 0 ? 'HOST' : 'CO-HOST'}</Text>
        </View>
        <Text style={st.cellName} numberOfLines={1}>
          {o.displayName}
        </Text>
      </View>
    </Pressable>
  );
}

// A seat's picture: its video, or (camera off / audio only) the person's avatar with a mic badge.
function SeatVideo({ seat, meId, avatar }: { seat: RoomSnapshot['seats'][number]; meId: string; avatar: number }) {
  const o = seat.occupant;
  if (!o) return null;
  if (seat.cameraOff)
    return (
      <View style={st.audioOnly} accessibilityLabel={`${o.displayName}, audio only`}>
        <Gradient colors={['#2B1B54', '#0E0A1F']} style={StyleSheet.absoluteFill} />
        <Avatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={avatar} ring="rgba(255,255,255,0.5)" />
        <View style={st.audioBadge}>
          <Mic size={Math.max(12, avatar / 6)} color="#fff" strokeWidth={2.6} />
        </View>
      </View>
    );
  return o.userId === meId ? <VideoTile local style={StyleSheet.absoluteFill} /> : <VideoTile streamId={seat.streamId} style={StyleSheet.absoluteFill} />;
}

function Ctrl({ label, onPress, tone, children }: { label: string; onPress: () => void; tone?: 'gold'; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [st.ctrl, tone === 'gold' && st.ctrlGold, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  );
}

// mm:ss left, ticking.
function useCountdown(endsAt: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
}

// Red (this room) vs blue (opponent) score bar with the timer; hosts can end it early.
function PkBar({ pk, mineRoomId, isHost, onEnd }: { pk: LivePk; mineRoomId: string; isHost: boolean; onEnd: () => void }) {
  const timer = useCountdown(pk.endsAt);
  const mine = pk.a.roomId === mineRoomId ? pk.a : pk.b;
  const theirs = pk.a.roomId === mineRoomId ? pk.b : pk.a;
  const total = mine.score + theirs.score;
  const share = total ? mine.score / total : 0.5;
  return (
    <View style={st.pkBarWrap} accessibilityLabel={`PK: ${mine.score} to ${theirs.score}, ${timer} left`}>
      <View style={st.pkBar}>
        <View style={[st.pkSide, { flex: Math.max(0.08, share), backgroundColor: RED }]}>
          <Text style={st.pkScore}>{short(mine.score)}</Text>
        </View>
        <View style={[st.pkSide, st.pkRight, { flex: Math.max(0.08, 1 - share), backgroundColor: BLUE }]}>
          <Text style={st.pkScore}>{short(theirs.score)}</Text>
        </View>
      </View>
      <View style={st.pkCenter}>
        <Swords size={14} color="#FFD86B" strokeWidth={2.6} />
        <Clock size={11} color="#fff" strokeWidth={2.6} />
        <Text style={st.pkTimer}>{timer}</Text>
        {isHost ? (
          <Pressable
            onPress={() => confirmDialog({ title: 'End the PK now?', message: 'Nobody wins if you end it early.', confirmText: 'End PK', danger: true }).then((ok) => ok && onEnd())}
            accessibilityRole="button"
            hitSlop={8}>
            <Text style={st.pkEnd}>End</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Your camera's beauty: on/off and four intensities. Applies live, and carries over to your next stream.
const LEVELS = [0, 25, 50, 75, 100];
const BEAUTY_ROWS: { key: Exclude<keyof Beauty, 'on'>; label: string }[] = [
  { key: 'smooth', label: 'Smooth skin' },
  { key: 'whiten', label: 'Brighten' },
  { key: 'rosy', label: 'Rosy' },
  { key: 'sharpen', label: 'Sharpen' },
];
function BeautySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [b, setB] = useState<Beauty>(zego.beauty);
  useEffect(() => {
    if (visible) setB(zego.beauty);
  }, [visible]);
  const update = (next: Beauty) => {
    setB(next);
    zego.setBeauty(next);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Beauty">
      <View style={st.beautyTop}>
        <Text style={st.beautyLabel}>Beauty filter</Text>
        <Switch value={b.on} onValueChange={(on) => update({ ...b, on })} trackColor={{ true: colors.primary }} accessibilityLabel="Beauty filter" />
      </View>
      {BEAUTY_ROWS.map(({ key, label }) => (
        <View key={key} style={[st.beautyRow, !b.on && { opacity: 0.4 }]}>
          <Text style={st.beautyRowLabel}>{label}</Text>
          <View style={st.levels} accessibilityRole="radiogroup" accessibilityLabel={label}>
            {LEVELS.map((v) => (
              <Pressable
                key={v}
                disabled={!b.on}
                onPress={() => update({ ...b, [key]: v })}
                accessibilityRole="radio"
                accessibilityState={{ selected: b[key] === v }}
                accessibilityLabel={`${label} ${v}`}
                style={[st.level, b[key] >= v && v > 0 && st.levelFill, b[key] === v && st.levelOn]}
              />
            ))}
          </View>
        </View>
      ))}
      <Pressable onPress={() => update({ on: true, smooth: 50, whiten: 50, rosy: 25, sharpen: 25 })} accessibilityRole="button" style={st.beautyReset}>
        <Text style={st.beautyResetText}>Reset</Text>
      </Pressable>
    </Sheet>
  );
}

// Host: invite someone watching onto a free co-host seat (they get the usual "Join the stage?" prompt).
function CoHostSheet({ visible, onClose, room, snap, pkOn }: { visible: boolean; onClose: () => void; room: RoomState; snap: RoomSnapshot; pkOn: boolean }) {
  const seated = new Set(snap.seats.map((s) => s.occupant?.userId));
  const viewers = snap.participants.filter((p) => !seated.has(p.userId));
  const free = snap.seats.slice(1).find((s) => !s.occupant && !s.locked);
  return (
    <Sheet visible={visible} onClose={onClose} title="Invite a co-host">
      {pkOn ? (
        <Text style={st.sheetNote}>Co-hosting is paused during a PK battle.</Text>
      ) : !free ? (
        <Text style={st.sheetNote}>All 3 co-host spots are taken.</Text>
      ) : !viewers.length ? (
        <Text style={st.sheetNote}>Nobody else is watching yet.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space(2) }}>
          {viewers.map((p) => (
            <View key={p.userId} style={st.pickRow}>
              <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={40} />
              <Text style={st.pickName} numberOfLines={1}>
                {p.displayName}
              </Text>
              <Pressable
                onPress={() =>
                  room
                    .inviteToSeat(free.seatIndex, p.userId)
                    .then(() => toast(`Invite sent to ${p.displayName}`))
                    .catch((e) => toast(errorText(e)))
                    .finally(onClose)
                }
                accessibilityRole="button"
                style={st.pickBtn}>
                <Text style={st.pickBtnText}>Invite</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

// Host: pick another live stream and a length to challenge to a PK.
function PkPickSheet({ visible, onClose, myRoomId, onInvite }: { visible: boolean; onClose: () => void; myRoomId: string; onInvite: (roomId: string, minutes: number) => void }) {
  const [lives, setLives] = useState<RoomCard[] | null>(null);
  const [minutes, setMinutes] = useState<number>(5);
  useEffect(() => {
    if (!visible) return;
    setLives(null);
    listLives()
      .then((r) => setLives(r.rooms.filter((x) => x.roomId !== myRoomId)))
      .catch((e) => {
        toast(errorText(e));
        setLives([]);
      });
  }, [visible, myRoomId]);
  return (
    <Sheet visible={visible} onClose={onClose} title="PK battle">
      <View style={st.minutes}>
        {LIVE_PK_MINUTES.map((m) => (
          <Pressable key={m} onPress={() => setMinutes(m)} accessibilityRole="radio" accessibilityState={{ selected: minutes === m }} style={[st.minute, minutes === m && st.minuteOn]}>
            <Text style={[st.minuteText, minutes === m && { color: '#fff' }]}>{m} min</Text>
          </Pressable>
        ))}
      </View>
      {!lives ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: space(6) }} />
      ) : !lives.length ? (
        <Text style={st.sheetNote}>No one else is live right now.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: space(2) }}>
          {/* Everyone live; streams already in (or invited to) a PK are greyed out and can't be challenged. */}
          {lives.map((l) => (
            <View key={l.roomId} style={[st.pickRow, l.inPk && { opacity: 0.45 }]}>
              <Avatar id={l.host.userId} name={l.host.displayName} uri={l.host.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={st.pickName} numberOfLines={1}>
                  {l.host.displayName}
                </Text>
                <Text style={st.pickSub} numberOfLines={1}>
                  {l.title} · {l.listenerCount} watching
                </Text>
              </View>
              {l.inPk ? (
                <View style={st.inPkTag} accessibilityLabel="Already in a PK">
                  <Swords size={12} color={colors.muted} strokeWidth={2.6} />
                  <Text style={st.inPkText}>Already in PK</Text>
                </View>
              ) : (
                <Pressable onPress={() => onInvite(l.roomId, minutes)} accessibilityRole="button" style={st.pickBtn}>
                  <Gradient colors={gradients.gold} style={StyleSheet.absoluteFill} />
                  <Text style={[st.pickBtnText, { color: '#2a1d05' }]}>Challenge</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

const st = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000' },
  waiting: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: space(2) },
  waitingText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  split: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  half: { flex: 1, overflow: 'hidden', backgroundColor: '#111' },
  halfName: { position: 'absolute', top: space(2), maxWidth: '80%', color: '#fff', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  pkBarWrap: { position: 'absolute', left: 0, right: 0, bottom: -26, alignItems: 'center' },
  pkBar: { flexDirection: 'row', alignSelf: 'stretch', height: 22, overflow: 'hidden' },
  pkSide: { justifyContent: 'center', paddingHorizontal: space(2) },
  pkRight: { alignItems: 'flex-end' },
  pkScore: { color: '#fff', fontSize: 12, fontWeight: '900' },
  pkCenter: { position: 'absolute', top: -14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(20,10,40,0.85)', borderWidth: 1, borderColor: '#FFD86B' },
  pkTimer: { color: '#fff', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pkEnd: { color: '#FF8A95', fontSize: 12, fontWeight: '900', marginLeft: 4 },
  audioOnly: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  audioBadge: { marginTop: -14, padding: 5, borderRadius: 999, backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
  coHosts: { position: 'absolute', right: space(2), gap: space(2) },
  column: { flexDirection: 'column' },
  cell: { flex: 1, overflow: 'hidden', backgroundColor: '#111', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.6)' },
  cellFoot: { position: 'absolute', left: space(2), right: space(2), bottom: space(2), flexDirection: 'row', alignItems: 'center', gap: 5 },
  cellName: { flexShrink: 1, color: '#fff', fontSize: 12, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  roleTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  roleHost: { backgroundColor: '#FFD86B' },
  roleCo: { backgroundColor: colors.primary },
  roleText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  coHostBanner: { position: 'absolute', top: space(2), alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space(3), paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,61,139,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  coHostBannerText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  audioRow: { position: 'absolute', left: space(3), right: space(3), flexDirection: 'row', gap: space(3) },
  audioCoHost: { alignItems: 'center', width: 64, gap: 2 },
  audioMini: { position: 'absolute', top: 38, right: 6, padding: 3, borderRadius: 999, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: '#fff' },
  audioName: { color: '#fff', fontSize: 11, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space(3), gap: space(2) },
  hostChip: { flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1, paddingLeft: 3, paddingRight: space(3), paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  hostName: { color: '#fff', fontSize: 14, fontWeight: '900' },
  hostSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '600' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  viewers: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(2), paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  viewersText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  liveTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: '#FF3D5A' },
  liveTagText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  controls: { position: 'absolute', right: space(3), gap: space(3) },
  ctrl: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  ctrlGold: { backgroundColor: 'rgba(232,146,12,0.85)', borderColor: '#FFD86B' },
  chat: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  chatList: { height: 260, paddingRight: 64 },
  musicPill: { alignSelf: 'flex-start', marginLeft: space(3), marginBottom: space(1) },
  sheetNote: { color: colors.muted, textAlign: 'center', marginVertical: space(6) },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(2), borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.05)' },
  pickName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  pickSub: { color: colors.muted, fontSize: 12 },
  pickBtn: { paddingHorizontal: space(4), paddingVertical: space(2), borderRadius: radius.pill, overflow: 'hidden', backgroundColor: colors.primary },
  pickBtnText: { color: '#fff', fontWeight: '900' },
  minutes: { flexDirection: 'row', gap: space(2), marginBottom: space(3) },
  minute: { paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)' },
  minuteOn: { backgroundColor: colors.primary },
  minuteText: { color: colors.muted, fontWeight: '800', fontSize: 13 },
  inPkTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.08)' },
  inPkText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  beautyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(2) },
  beautyLabel: { color: colors.text, fontSize: 16, fontWeight: '800' },
  beautyRow: { gap: space(2), marginBottom: space(3) },
  beautyRowLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  levels: { flexDirection: 'row', gap: space(2) },
  level: { flex: 1, height: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)' },
  levelFill: { backgroundColor: 'rgba(255,61,139,0.55)' },
  levelOn: { backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
  beautyReset: { alignSelf: 'center', paddingHorizontal: space(5), paddingVertical: space(2) },
  beautyResetText: { color: colors.muted, fontWeight: '800' },
});
