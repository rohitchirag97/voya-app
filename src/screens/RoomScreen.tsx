import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { errorText, roomCoverUri, type Seat } from '../api';
import { Armchair, Forward, Lock, LockOpen, Menu, UserPlus, Users } from 'lucide-react-native';
import { Gradient } from '../components/Gradient';
import { Avatar, IconButton, Screen, Sheet, SheetAction, rs as s, toast } from '../components/ui';
import { useNav } from '../nav';
import { ChatList, Composer } from '../room/ChatPanel';
import { BigWinBanner } from '../room/BigWinBanner';
import { SvipEntrance } from '../room/SvipEntrance';
import { GiftAnimation } from '../room/GiftAnimation';
import { GiftBanner, GiftCombo, GiftSheet, type LastGift } from '../room/GiftSheet';
import { PeopleSheet } from '../room/PeopleSheet';
import { PinGate } from '../room/PinGate';
import { LiveStage } from '../room/LiveStage';
import { LudoBoard } from '../room/LudoBoard';
import { EmoteSheet } from '../room/Emotes';
import { confirmDialog } from '../components/Dialog';
import { RoomDrawer } from '../room/RoomDrawer';
import { RoomMenu } from '../room/RoomMenu';
import { MusicPanel, MusicPill } from '../room/MusicPanel';
import { InviteSheet } from '../room/InviteSheet';
import { RoomStatChips, useRoomStats } from '../room/RoomStats';
import { RoomWidgets } from '../room/RoomWidgets';
import { TopGiftersChip } from '../room/TopGifters';
import { GameCards } from '../room/GameSheet';
import { useRoomSession } from '../room/RoomSession';
import { SeatGrid } from '../room/SeatGrid';
import { UserCard } from '../room/UserCard';
import { roomColors as colors, radius, space, tintPairFor } from '../theme';

// A view onto the active room session (see RoomSession); leaving this screen only minimizes the room.
export function RoomScreen() {
  const nav = useNav();
  const me = nav.me!;
  const room = useRoomSession();
  const [seatMenu, setSeatMenu] = useState<Seat | null>(null);
  const [giftTo, setGiftTo] = useState<string | undefined>();
  const [giftOpen, setGiftOpen] = useState(false);
  const [lastGift, setLastGift] = useState<LastGift | null>(null); // drives the "send again" combo button
  const [menuOpen, setMenuOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [emotesOpen, setEmotesOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Gift animations off: drop queued gifts instead of letting them pile up unseen.
  const giftsOff = room?.snap?.giftAnimations === false && room.gifts.length > 0;
  useEffect(() => {
    if (giftsOff) room?.shiftGift();
  }, [giftsOff, room?.gifts, room]);
  const [inviting, setInviting] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [cardUser, setCardUser] = useState<string | null>(null);
  const [tag, setTag] = useState<{ userId: string; handle: string; n: number } | null>(null);
  const stats = useRoomStats(room?.snap?.roomId);
  const closeMenu = () => {
    setSeatMenu(null);
    setInviting(false);
  };

  const run = (fn: () => Promise<unknown>) => fn().catch((e) => toast(e instanceof Error && !('code' in e) ? e.message : errorText(e)));

  const leave = () => room?.leave().then(nav.closeRoom);
  const openProfile = (userId: string) => {
    setCardUser(null);
    nav.push({ name: 'user', userId }); // the room keeps running as a bubble
  };

  if (!room) return null;
  const { snap, mySeat } = room;

  function onSeat(seat: Seat) {
    if (!room) return;
    if (seat.occupant) return setCardUser(seat.occupant.userId); // all person actions live on the profile card
    if (room.isMod) return setSeatMenu(seat); // owner/admins: sit, invite, lock/unlock on empty seats
    if (seat.seatIndex === 0) return toast('Only the owner or an admin can sit here.');
    if (seat.locked) return toast('This seat is locked. The owner or an admin can invite you to it.');
    run(() => room.claimSeat(seat.seatIndex)); // moves you if you're already seated
  }

  if (!snap && room.needsPassword) {
    return (
      <Screen backdrop>
        <PinGate wrong={room.needsPassword === 'WRONG_PASSWORD'} onSubmit={room.submitPassword} onCancel={nav.closeRoom} />
      </Screen>
    );
  }
  if (!snap) {
    return (
      <Screen style={st.center} backdrop>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={s.muted}>Joining room…</Text>
      </Screen>
    );
  }

  const reconnecting = !room.socketUp || room.media === 'reconnecting' || room.media === 'connecting';
  const menuSeat = seatMenu && snap.seats.find((x) => x.seatIndex === seatMenu.seatIndex);
  const menuUser = menuSeat?.occupant;
  const seated = new Set(snap.seats.map((x) => x.occupant?.userId));
  const listeners = snap.participants.filter((p) => !seated.has(p.userId));

  const cover = roomCoverUri(snap.coverUrl);
  const live = snap.kind === 'LIVE';
  // Live: the host ends the stream for everyone (after confirming); anyone else just leaves.
  const endOrLeave = async () => {
    if (snap.hostUserId !== me.userId) return leave();
    if (await confirmDialog({ title: 'End your live?', message: 'Everyone watching will be sent out.', confirmText: 'End live', danger: true })) run(() => room.endLive().then(nav.closeRoom));
  };

  return (
    <Screen backdrop={!live} backdropTheme={snap.background} backdropImage={roomCoverUri(snap.backgroundUrl)} top={!live} bottom={!live} style={live ? st.liveScreen : undefined}>
      {live ? <StatusBar barStyle="light-content" /> : null}
      {live ? (
        <LiveStage
          room={room}
          snap={snap}
          meId={me.userId}
          onUserPress={setCardUser}
          onGift={(id) => {
            setGiftTo(id);
            setGiftOpen(true);
          }}
          onMore={() => setMenuOpen(true)}
          onGames={() => setGamesOpen(true)}
          onMessages={() => nav.push({ name: 'home', tab: 'messages' })}
          onEmotes={() => setEmotesOpen(true)}
          onMusic={() => setMusicOpen(true)}
          onShare={() => setInviteOpen(true)}
          onOpenGame={nav.openGame}
          onClose={endOrLeave}
          tag={tag}
        />
      ) : (
      <>
      <View style={st.header}>
        {/* Room identity: cover, title, short ID */}
        {cover ? (
          <Image source={{ uri: cover }} style={st.cover} resizeMode="cover" />
        ) : (
          <Gradient colors={tintPairFor(snap.roomId)} style={st.cover}>
            <Text style={st.coverText}>{snap.title.slice(0, 1).toUpperCase()}</Text>
          </Gradient>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.title} numberOfLines={1}>
            {snap.title}
          </Text>
          <Text style={st.sub} numberOfLines={1}>
            ID {snap.roomId.slice(0, 8)} · {snap.category ?? 'Party'}
          </Text>
        </View>
        <IconButton label="Invite friends" onPress={() => setInviteOpen(true)} size={36}>
          <Forward size={18} color={colors.text} />
        </IconButton>
        <IconButton label="Room menu" onPress={() => setDrawerOpen(true)} size={36}>
          <Menu size={20} color={colors.text} />
        </IconButton>
      </View>

      {/* Who's here: avatar stack + count, opens People */}
      <View style={st.metaRow}>
        <Pressable onPress={() => setPeopleOpen(true)} accessibilityRole="button" accessibilityLabel={`${snap.participants.length} people in this room`} style={st.online}>
          <View style={st.stack}>
            {snap.participants.slice(0, 3).map((p, i) => (
              <View key={p.userId} style={{ marginLeft: i ? -8 : 0, borderRadius: 12, borderWidth: 1.5, borderColor: colors.bg }}>
                <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={20} />
              </View>
            ))}
          </View>
          <Users size={13} color={colors.text} />
          <Text style={st.onlineText}>{snap.participants.length}</Text>
        </Pressable>
        <TopGiftersChip roomId={snap.roomId} onUserPress={setCardUser} />
        <RoomStatChips stats={stats} />
      </View>

      {reconnecting ? (
        <View style={st.banner} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={st.bannerText}>{room.media === 'connecting' ? 'Connecting audio…' : 'Reconnecting…'}</Text>
        </View>
      ) : null}

      <View style={st.stage}>
        <SeatGrid
          rowLayout={snap.rowLayout}
          seats={snap.seats}
          meId={me.userId}
          hostUserId={snap.hostUserId}
          admins={snap.admins}
          levels={room.levels}
          pendingSeat={room.pendingSeat}
          charisma={snap.charisma?.totals ?? null}
          oneRow={snap.ludo}
          emotes={room.emotes}
          cpOf={(a, b) =>
            room.profiles[a]?.relationships?.find((r) => r.user.userId === b) ?? room.profiles[b]?.relationships?.find((r) => r.user.userId === a)
          }
          onPress={onSeat}
        />
        {snap.ludo ? <LudoBoard roomId={snap.roomId} /> : null}
        {snap.giftAnimations ? <GiftBanner event={room.gifts[0]} onDone={room.shiftGift} /> : null}
      </View>

      {/* Self mute lives in the chat bar; leaving the seat is on your own profile card. */}
      {mySeat?.modMuted ? (
        <View style={st.modNote} accessibilityLiveRegion="polite">
          <Lock size={14} color="#FF8A95" />
          <Text style={st.modNoteText}>
            An admin muted you. Your mic stays off until they unmute you
            {mySeat.micMuted ? ', and then until you unmute yourself.' : '.'}
          </Text>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ChatList
            messages={room.messages}
            participants={snap.participants}
            meId={me.userId}
            onEndReached={room.loadOlder}
            onUserPress={setCardUser}
            onOpenGame={nav.openGame}
            onEmote={() => setEmotesOpen(true)}
            unseenMentions={room.unseenMentions}
            onMentionsSeen={room.markMentionsSeen}
            roles={{ hostUserId: snap.hostUserId, admins: snap.admins }}
          />
          <View style={st.musicPill}>
            <MusicPill onPress={() => setMusicOpen(true)} />
          </View>
          <RoomWidgets
            pk={snap.pk}
            onUserPress={setCardUser}
            onGift={(id) => {
              setGiftTo(id);
              setGiftOpen(true);
            }}
          />
        </View>
        <Composer
          participants={snap.participants}
          meId={me.userId}
          onSend={room.sendChat}
          onGift={() => {
            setGiftTo(undefined);
            setGiftOpen(true);
          }}
          onMore={() => setMenuOpen(true)}
          onGames={() => setGamesOpen(true)}
          onMessages={() => nav.push({ name: 'home', tab: 'messages' })} // the room keeps running as a bubble
          onEmotes={() => setEmotesOpen(true)}
          micMuted={mySeat ? mySeat.micMuted : null}
          onToggleMic={() => mySeat && run(() => room.setMuted(me.userId, !mySeat.micMuted))}
          tag={tag}
        />
      </View>
      </>
      )}

      <Sheet
        visible={room.isMod && !!menuSeat && !menuUser}
        onClose={closeMenu}
        title={inviting ? `Invite to seat ${(menuSeat?.seatIndex ?? 0) + 1}` : menuSeat?.seatIndex === 0 ? 'Owner seat' : `Seat ${(menuSeat?.seatIndex ?? 0) + 1}`}>
        {/* Locked seats: nobody sits without unlocking first or an invite. */}
        {menuSeat && !inviting && !menuSeat.locked ? (
          <View>
            <SheetAction
              label={mySeat ? 'Move here' : 'Sit here'}
              icon={<Armchair size={20} color={colors.text} />}
              onPress={() => {
                closeMenu();
                run(() => room.claimSeat(menuSeat.seatIndex));
              }}
            />
          </View>
        ) : null}
        {menuSeat && !inviting && menuSeat.seatIndex > 0 ? (
          <View>
            <SheetAction label="Invite a listener" icon={<UserPlus size={20} color={colors.text} />} onPress={() => setInviting(true)} />
            <SheetAction
              label={menuSeat.locked ? 'Unlock seat' : 'Lock seat'}
              icon={menuSeat.locked ? <LockOpen size={20} color={colors.text} /> : <Lock size={20} color={colors.text} />}
              onPress={() => {
                closeMenu();
                run(() => room.setLocked(menuSeat.seatIndex, !menuSeat.locked));
              }}
            />
          </View>
        ) : null}
        {menuSeat && inviting ? (
          listeners.length ? (
            <View>
              {listeners.map((p) => (
                <SheetAction
                  key={p.userId}
                  label={p.displayName ?? 'Listener'}
                  onPress={() => {
                    closeMenu();
                    run(() => room.inviteToSeat(menuSeat.seatIndex, p.userId).then(() => toast(`Invite sent to ${p.displayName}`)));
                  }}
                />
              ))}
            </View>
          ) : (
            <Text style={s.muted}>No listeners right now. Everyone in the room is already on stage.</Text>
          )
        ) : null}
      </Sheet>

      <PeopleSheet
        visible={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        room={room}
        meId={me.userId}
        onSelect={(id) => {
          setPeopleOpen(false);
          setCardUser(id);
        }}
      />

      {/* Full-screen animation for gifts with SVG artwork; plays alongside the banner. */}
      {snap.giftAnimations ? <GiftAnimation event={room.gifts[0]} /> : null}

      <RoomDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        room={room}
        snap={snap}
        meId={me.userId}
        onMinimize={() => {
          setDrawerOpen(false);
          nav.back();
        }}
        onLeave={() => {
          setDrawerOpen(false);
          leave();
        }}
      />

      {/* Big wins (10,000+) from any game, anywhere; tap opens that game. */}
      <BigWinBanner win={room.bigWins[0]} onDone={room.shiftBigWin} onOpen={nav.openGame} />
      <SvipEntrance entry={room.entrances[0]} onDone={room.shiftEntrance} />

      <UserCard
        userId={cardUser}
        onClose={() => setCardUser(null)}
        onOpenProfile={openProfile}
        onGift={(id) => {
          setCardUser(null);
          setGiftTo(id);
          setGiftOpen(true);
        }}
        onTag={(userId, handle) => setTag((t) => ({ userId, handle, n: (t?.n ?? 0) + 1 }))}
      />

      <EmoteSheet
        visible={emotesOpen}
        onClose={() => setEmotesOpen(false)}
        onPick={(e) => {
          setEmotesOpen(false);
          run(() => room.sendEmote(e));
        }}
      />
      <GiftSheet
        visible={giftOpen}
        onClose={() => setGiftOpen(false)}
        seats={snap.seats}
        meId={me.userId}
        initialRecipient={giftTo}
        send={room.sendGift}
        onSent={setLastGift}
        onRecharge={() => nav.push({ name: 'recharge' })} // the room keeps running as a bubble
      />
      {lastGift && !giftOpen ? (
        <GiftCombo last={lastGift} send={room.sendGift} onDone={() => setLastGift(null)} onRecharge={() => nav.push({ name: 'recharge' })} />
      ) : null}

      {/* More: games for everyone; seat layout for the owner and admins (moved here from the header). */}
      <RoomMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPickGame={(g) => {
          setMenuOpen(false);
          nav.openGame(g); // the game lives at the app root, so it outlives this room
        }}
        onMusic={() => {
          setMenuOpen(false);
          setMusicOpen(true);
        }}
        seats={
          room.isMod && !live // live streams keep their 4 seats
            ? {
                count: snap.seatCount,
                onChange: (n) => {
                  setMenuOpen(false);
                  if (n !== snap.seatCount) run(() => room.setSeatCount(n));
                },
              }
            : null
        }
        charisma={room.isMod && !live ? { state: snap.charisma, onToggle: (on) => run(() => room.setCharisma(on)) } : null}
        ludo={
          room.isMod && !live
            ? {
                on: !!snap.ludo,
                onToggle: (on) => {
                  setMenuOpen(false);
                  run(() => room.setLudo(on));
                },
              }
            : null
        }
        pk={
          room.isMod && !live // live streams battle other streams instead (the swords button)
            ? {
                seats: snap.seats,
                state: snap.pk,
                onStart: (a, b, minutes) => {
                  setMenuOpen(false);
                  run(() => room.startPk(a, b, minutes));
                },
                onStop: () => run(() => room.stopPk()),
              }
            : null
        }
      />

      <InviteSheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomId={snap.roomId}
        title={snap.title}
        inRoom={new Set(snap.participants.map((p) => p.userId))}
      />
      <MusicPanel visible={musicOpen} onClose={() => setMusicOpen(false)} seated={!!mySeat} />

      <Sheet visible={gamesOpen} onClose={() => setGamesOpen(false)} title="Games">
        <GameCards
          onPick={(g) => {
            setGamesOpen(false);
            nav.openGame(g);
          }}
        />
      </Sheet>
    </Screen>
  );
}

const st = StyleSheet.create({
  musicPill: { position: 'absolute', top: space(1), right: space(2) },
  center: { alignItems: 'center', justifyContent: 'center', gap: space(3) },
  liveScreen: { backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingTop: space(2) },
  cover: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.glassBorder },
  coverText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2), paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(2) },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  stack: { flexDirection: 'row' },
  onlineText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  note: { paddingVertical: space(3) },
  modNote: { flexDirection: 'row', alignItems: 'center', gap: space(2), marginHorizontal: space(4), marginTop: space(1), padding: space(2), borderRadius: radius.sm, backgroundColor: 'rgba(255,77,94,0.12)' },
  modNoteText: { flex: 1, color: '#FF8A95', fontSize: 12, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
    backgroundColor: colors.shade,
    paddingVertical: space(2),
  },
  bannerText: { color: colors.text, fontWeight: '600' },
  // Seats float on the backdrop; no boxed card.
  stage: { paddingVertical: space(2) },
});
