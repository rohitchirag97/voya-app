import { ChevronDown, ChevronRight, Crown, Eraser, EyeOff, Globe, ImagePlus, Lock, LogOut, ShieldCheck, UserPlus, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { pickCropped } from '../screens/ProfileParts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { errorText, roomCoverUri, type RoomPrivacy, type RoomSnapshot } from '../api';
import { Gradient, ROOM_BACKGROUNDS } from '../components/Gradient';
import { Avatar, toast } from '../components/ui';
import { LevelBadge } from '../components/Level';
import { SvipBadge } from '../components/Svip';
import { roomColors as colors, radius, space, tintPairFor } from '../theme';
import type { RoomState } from './useRoom';
import { useNav } from '../nav';

// Right-side room menu: room info, minimize / leave, and (owner/admins) the room's settings, each its own control.
export function RoomDrawer({ visible, onClose, room, snap, meId, onMinimize, onLeave }: {
  visible: boolean;
  onClose: () => void;
  room: RoomState;
  snap: RoomSnapshot;
  meId: string;
  onMinimize: () => void;
  onLeave: () => void;
}) {
  const staff = !!useNav().me?.staffRole;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelW = Math.min(360, Math.round(width * 0.86));
  const x = useRef(new Animated.Value(panelW)).current;
  const [shown, setShown] = useState(visible);

  // Slide in from the right; slide out before the modal goes away.
  useEffect(() => {
    if (visible) {
      setShown(true);
      x.setValue(panelW);
      Animated.timing(x, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (shown) {
      Animated.timing(x, { toValue: panelW, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setShown(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const isOwner = snap.hostUserId === meId;
  const cover = roomCoverUri(snap.coverUrl);
  const nav = useNav();
  const bgPhoto = roomCoverUri(snap.backgroundUrl);
  // A portrait photo for the backdrop: move and zoom it into a phone-shaped (9:16) frame. A preset afterwards replaces it.
  async function pickBackground() {
    const file = await pickCropped(1080, 1920, 'Fit your background');
    if (file) run(() => room.uploadBackground({ ...file, name: 'background.jpg' }), 'Background updated');
  }
  const run = (fn: () => Promise<unknown>, ok?: string) => fn().then(() => ok && toast(ok)).catch((e) => toast(errorText(e)));

  // Everyone can clear their own view; the owner and admins can also clear it for everyone in the room.
  // Everyone can clear their own view; the owner and admins can also clear it for everyone in the room. The choice
  // opens right here in the menu (a dialog would have to draw over this native modal).
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    if (!visible) setClearing(false);
  }, [visible]);
  const clearFor = (who: 'me' | 'all') => {
    setClearing(false);
    onClose();
    if (who === 'me') {
      room.clearChatForMe();
      toast('Chat cleared on your phone');
    } else run(room.clearChatForAll, 'Chat cleared for everyone');
  };

  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={st.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View style={[st.panel, { width: panelW, paddingTop: insets.top + space(3), paddingBottom: insets.bottom + space(2), transform: [{ translateX: x }] }]}>
        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          {/* Room info */}
          <View style={st.head}>
            <View style={st.cover}>
              {cover ? (
                <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Gradient colors={tintPairFor(snap.roomId)} style={[StyleSheet.absoluteFill, st.center]}>
                  <Text style={st.coverText}>{snap.title.slice(0, 1).toUpperCase()}</Text>
                </Gradient>
              )}
            </View>
            <View style={st.grow}>
              <Text style={st.title} numberOfLines={2}>{snap.title}</Text>
              <Text style={st.sub}>ID {snap.roomId.slice(0, 8)} · {snap.participants.length} here</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" hitSlop={10} style={st.close}>
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Whose room this is (shown even when the owner isn't here). Tap for their profile. */}
          {snap.owner ? (
            <Pressable
              onPress={() => {
                onClose();
                nav.push({ name: 'user', userId: snap.owner!.userId }); // the room keeps running as a bubble
              }}
              accessibilityRole="button"
              accessibilityLabel={`Room owner ${snap.owner.displayName}. Open their profile`}
              style={st.owner}>
              <Avatar id={snap.owner.userId} name={snap.owner.displayName} uri={snap.owner.avatarUrl} size={44} />
              <View style={st.grow}>
                <View style={st.ownerTop}>
                  <Crown size={13} color={colors.gold} fill={colors.gold} />
                  <Text style={st.ownerTag}>ROOM OWNER</Text>
                </View>
                <View style={st.ownerNameRow}>
                  <Text style={st.ownerName} numberOfLines={1}>
                    {snap.owner.displayName}
                  </Text>
                  <SvipBadge tier={snap.owner.svip ?? 0} />
                  {snap.owner.level ? <LevelBadge level={snap.owner.level} /> : null}
                </View>
                <Text style={st.ownerSub} numberOfLines={1}>
                  ID {snap.owner.specialId ?? snap.owner.publicId}
                  {snap.createdAt ? ` · Room since ${new Date(snap.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ) : null}

          {/* Minimize / leave (moved here from the header) */}
          <View style={st.actions}>
            <Pressable onPress={onMinimize} accessibilityRole="button" style={st.action}>
              <ChevronDown size={18} color={colors.text} />
              <Text style={st.actionText}>Minimize</Text>
            </Pressable>
            <Pressable onPress={onLeave} accessibilityRole="button" style={[st.action, st.leave]}>
              <LogOut size={17} color="#FF8A95" />
              <Text style={[st.actionText, st.leaveText]}>Leave room</Text>
            </Pressable>
          </View>
          <View style={st.actions}>
            <Pressable onPress={() => setClearing((c) => !c)} accessibilityRole="button" accessibilityState={{ expanded: clearing }} style={[st.action, clearing && st.actionOn]}>
              <Eraser size={17} color={colors.text} />
              <Text style={st.actionText}>Clear chat</Text>
            </Pressable>
          </View>
          {clearing ? (
            <View style={st.clearBox}>
              <Text style={st.clearNote}>
                {room.isMod ? 'Clear it just on your phone, or for everyone in the room.' : 'The messages so far disappear from your phone. Others still see them.'}
              </Text>
              <Pressable onPress={() => clearFor('me')} accessibilityRole="button" style={st.action}>
                <Text style={st.actionText}>Clear for me</Text>
              </Pressable>
              {room.isMod ? (
                <Pressable onPress={() => clearFor('all')} accessibilityRole="button" style={[st.action, st.leave]}>
                  <Text style={[st.actionText, st.leaveText]}>Clear for everyone</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => setClearing(false)} accessibilityRole="button" style={st.cancel}>
                <Text style={st.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}

          {room.isMod ? (
            <>
              <Text style={st.heading}>Room settings</Text>
              <NameSetting key={snap.title} title={snap.title} onSave={(title) => run(() => room.updateSettings({ title }), 'Room name saved')} />
              <CoverSetting cover={cover} onPick={(file) => run(() => room.uploadCover(file), 'Room image updated')} />

              <View style={st.card}>
                <Text style={st.label}>Background</Text>
                <View style={st.swatches}>
                  <Pressable
                    onPress={pickBackground}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: !!bgPhoto }}
                    accessibilityLabel={bgPhoto ? 'Photo background. Change photo' : 'Use your own photo as the background'}
                    style={st.swatchWrap}>
                    <View style={[st.swatch, st.photoSwatch, !!bgPhoto && st.swatchOn]}>
                      {bgPhoto ? <Image source={{ uri: bgPhoto }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <ImagePlus size={20} color={colors.muted} />}
                    </View>
                    <Text style={[st.swatchName, !!bgPhoto && { color: colors.text }]}>{bgPhoto ? 'Change photo' : 'Your photo'}</Text>
                  </Pressable>
                  {ROOM_BACKGROUNDS.map((b) => {
                    const on = !bgPhoto && (snap.background ?? 'night') === b.key; // a photo, when set, wins
                    return (
                      <Pressable
                        key={b.key}
                        onPress={() => !on && run(() => room.updateSettings({ background: b.key }))}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${b.name} background`}
                        style={st.swatchWrap}>
                        <Gradient colors={[b.glows[0], b.base[1], b.glows[1]]} style={[st.swatch, on && st.swatchOn]} />
                        <Text style={[st.swatchName, on && { color: colors.text }]}>{b.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <PrivacySetting
                privacy={snap.privacy}
                onChange={(privacy, password) =>
                  run(
                    () => room.updateSettings({ privacy, ...(password && { password }) }),
                    privacy === 'LOCKED' ? (snap.privacy === 'LOCKED' ? 'Password changed' : 'Room locked') : privacy === 'PRIVATE' ? 'Room is now private' : 'Room is now public',
                  )
                }
              />

              {/* Each switch is its own setting. */}
              <SwitchRow label="Show entry notices" hint={'"Name joined" messages in the chat'} value={snap.showEntry} onChange={(v) => run(() => room.updateSettings({ showEntry: v }))} />
              <SwitchRow label="Gift animations" hint="Full-screen gift effects and gift banners" value={snap.giftAnimations} onChange={(v) => run(() => room.updateSettings({ giftAnimations: v }))} />

              <AdminsSetting snap={snap} isOwner={isOwner} onSet={(userId, admin) => run(() => room.setAdmin(userId, admin), admin ? 'Admin added' : 'Admin removed')} />
            </>
          ) : null}

          {/* VoyaLive staff: pin this room to the top of everyone's room list (up to 4, the official room included). */}
          {staff && snap.kind === 'AUDIO' ? (
            <>
              <Text style={st.heading}>Staff</Text>
              {snap.official ? (
                <View style={st.card}>
                  <Text style={st.label}>Official room</Text>
                  <Text style={st.hint}>Always pinned first in the room list.</Text>
                </View>
              ) : (
                <SwitchRow
                  label="Pin to the top of the room list"
                  hint="Up to 4 pinned rooms, shown above the ranked ones"
                  value={!!snap.pinned}
                  onChange={(v) => run(() => room.setPinned(v), v ? 'Room pinned' : 'Room unpinned')}
                />
              )}
            </>
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function NameSetting({ title, onSave }: { title: string; onSave: (t: string) => void }) {
  const [value, setValue] = useState(title);
  const clean = value.trim();
  const changed = clean.length > 0 && clean !== title;
  return (
    <View style={st.card}>
      <Text style={st.label}>Room name</Text>
      <View style={st.inline}>
        <TextInput value={value} onChangeText={setValue} maxLength={60} placeholder="Room name" placeholderTextColor={colors.muted} style={st.input} accessibilityLabel="Room name" />
        <Pressable onPress={() => onSave(clean)} disabled={!changed} accessibilityRole="button" style={[st.save, !changed && st.saveOff]}>
          <Text style={st.saveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CoverSetting({ cover, onPick }: { cover: string | null; onPick: (file: { uri: string; type: string; name: string }) => void }) {
  // Square room image: move and zoom it into the frame.
  async function pick() {
    const file = await pickCropped(1024, 1024, 'Fit your room image');
    if (file) onPick({ ...file, name: 'cover.jpg' });
  }
  return (
    <View style={st.card}>
      <Text style={st.label}>Room image</Text>
      <View style={st.inline}>
        <View style={st.thumb}>{cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <ImagePlus size={20} color={colors.muted} />}</View>
        <Pressable onPress={pick} accessibilityRole="button" style={st.pick}>
          <ImagePlus size={16} color={colors.text} />
          <Text style={st.pickText}>{cover ? 'Change image' : 'Add image'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Who can join: Public (default), Locked (4-digit password) or Private (hidden; owner and admins only).
const PRIVACY: { key: RoomPrivacy; title: string; hint: string; Icon: typeof Globe }[] = [
  { key: 'PUBLIC', title: 'Public', hint: 'Listed for everyone; anyone can join', Icon: Globe },
  { key: 'LOCKED', title: 'Locked', hint: 'Listed with a lock; joining needs a 4-digit password', Icon: Lock },
  { key: 'PRIVATE', title: 'Private', hint: "Hidden from the list and profiles; only you and your admins can enter", Icon: EyeOff },
];
function PrivacySetting({ privacy, onChange }: { privacy: RoomPrivacy; onChange: (p: RoomPrivacy, password?: string) => void }) {
  const [picked, setPicked] = useState<RoomPrivacy>(privacy);
  const [pin, setPin] = useState('');
  useEffect(() => setPicked(privacy), [privacy]);
  const choose = (p: RoomPrivacy) => {
    setPicked(p);
    setPin('');
    if (p !== 'LOCKED' && p !== privacy) onChange(p); // Locked waits for its password
  };
  return (
    <View style={st.card}>
      <Text style={st.label}>Who can join</Text>
      {PRIVACY.map(({ key, title, hint, Icon }) => {
        const on = picked === key;
        return (
          <Pressable key={key} onPress={() => choose(key)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[st.privacyRow, on && st.privacyOn]}>
            <Icon size={18} color={on ? colors.primary : colors.muted} strokeWidth={2.4} />
            <View style={{ flex: 1 }}>
              <Text style={[st.privacyTitle, on && { color: colors.text }]}>{title}</Text>
              <Text style={st.hint}>{hint}</Text>
            </View>
            <View style={[st.radio, on && st.radioOn]} />
          </Pressable>
        );
      })}
      {picked === 'LOCKED' ? (
        <View style={st.pinRow}>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            placeholder={privacy === 'LOCKED' ? 'New 4-digit password' : '4-digit password'}
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            maxLength={4}
            style={st.pinInput}
            accessibilityLabel="Room password"
          />
          <Pressable
            onPress={() => {
              onChange('LOCKED', pin);
              setPin('');
            }}
            disabled={pin.length !== 4}
            accessibilityRole="button"
            style={[st.pinSave, pin.length !== 4 && { opacity: 0.4 }]}>
            <Text style={st.pinSaveText}>{privacy === 'LOCKED' ? 'Change' : 'Lock room'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SwitchRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={[st.card, st.switchRow]}>
      <View style={st.grow}>
        <Text style={st.switchLabel}>{label}</Text>
        <Text style={st.hint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: 'rgba(255,255,255,0.18)' }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
}

// Admins: everyone sees the list; only the owner adds (from people in the room) or removes.
function AdminsSetting({ snap, isOwner, onSet }: { snap: RoomSnapshot; isOwner: boolean; onSet: (userId: string, admin: boolean) => void }) {
  const [adding, setAdding] = useState(false);
  const byId = new Map(snap.participants.map((p) => [p.userId, p]));
  const candidates = snap.participants.filter((p) => p.userId !== snap.hostUserId && !snap.admins.includes(p.userId));
  return (
    <View style={st.card}>
      <View style={st.inline}>
        <Text style={[st.label, st.grow]}>Admins</Text>
        {isOwner ? (
          <Pressable onPress={() => setAdding((a) => !a)} accessibilityRole="button" style={st.pick}>
            <UserPlus size={15} color={colors.text} />
            <Text style={st.pickText}>{adding ? 'Done' : 'Add'}</Text>
          </Pressable>
        ) : null}
      </View>
      {!snap.admins.length ? <Text style={st.hint}>No admins yet{isOwner ? '. Add someone who is in the room.' : '.'}</Text> : null}
      {snap.admins.map((id) => {
        const p = byId.get(id);
        return (
          <View key={id} style={st.person}>
            <Avatar id={id} name={p?.displayName ?? 'Admin'} size={30} />
            <Text style={[st.personName, st.grow]} numberOfLines={1}>{p?.displayName ?? 'Admin (not here now)'}</Text>
            <ShieldCheck size={14} color={colors.accent} />
            {isOwner ? (
              <Pressable onPress={() => onSet(id, false)} accessibilityRole="button" accessibilityLabel={`Remove ${p?.displayName ?? 'admin'} as admin`} style={st.remove}>
                <Text style={st.removeText}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      {adding ? (
        <View style={st.addList}>
          {!candidates.length ? <Text style={st.hint}>Everyone here is already the owner or an admin.</Text> : null}
          {candidates.map((p) => (
            <Pressable key={p.userId} onPress={() => onSet(p.userId, true)} accessibilityRole="button" accessibilityLabel={`Make ${p.displayName} an admin`} style={st.person}>
              <Avatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={30} />
              <Text style={[st.personName, st.grow]} numberOfLines={1}>{p.displayName}</Text>
              <UserPlus size={15} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: colors.bg, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderLeftWidth: 1, borderColor: colors.border, elevation: 24 },
  body: { paddingHorizontal: space(4), gap: space(3), paddingBottom: space(4) },
  head: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  cover: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border },
  center: { alignItems: 'center', justifyContent: 'center' },
  coverText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  grow: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  actions: { flexDirection: 'row', gap: space(2) },
  actionOn: { borderColor: colors.primary },
  clearBox: { gap: space(2), padding: space(3), borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  clearNote: { color: colors.muted, fontSize: 13 },
  cancel: { alignSelf: 'center', paddingVertical: space(1), paddingHorizontal: space(3) },
  cancelText: { color: colors.muted, fontWeight: '700' },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  leave: { backgroundColor: 'rgba(255,77,94,0.12)', borderColor: 'rgba(255,77,94,0.3)' },
  actionText: { color: colors.text, fontWeight: '700' },
  leaveText: { color: '#FF8A95' },
  heading: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: space(2) },
  card: { padding: space(3), borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: space(2) },
  label: { color: colors.text, fontWeight: '700' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(2), borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent' },
  privacyOn: { borderColor: colors.primary, backgroundColor: 'rgba(255,61,139,0.1)' },
  privacyTitle: { color: colors.muted, fontWeight: '800', fontSize: 14 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  radioOn: { borderColor: colors.primary, borderWidth: 6 },
  pinRow: { flexDirection: 'row', gap: space(2), alignItems: 'center' },
  pinInput: { flex: 1, height: 44, paddingHorizontal: space(3), borderRadius: radius.sm, color: colors.text, fontSize: 18, letterSpacing: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border },
  pinSave: { height: 44, paddingHorizontal: space(4), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pinSaveText: { color: '#fff', fontWeight: '900' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  input: { flex: 1, height: 42, borderRadius: radius.sm, paddingHorizontal: space(3), color: colors.text, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  save: { height: 42, paddingHorizontal: space(4), borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  saveOff: { opacity: 0.4 },
  saveText: { color: '#fff', fontWeight: '800' },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  pickText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  swatchWrap: { alignItems: 'center', gap: 4, width: '30%' },
  swatch: { width: '100%', aspectRatio: 1.4, borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  photoSwatch: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(3), borderRadius: radius.md, backgroundColor: 'rgba(255,201,77,0.08)', borderWidth: 1, borderColor: 'rgba(255,201,77,0.3)' },
  ownerTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownerTag: { color: colors.gold, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ownerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  ownerName: { flexShrink: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  ownerSub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  swatchName: { color: colors.muted, fontSize: 11.5, fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center' },
  switchLabel: { color: colors.text, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingVertical: 4 },
  personName: { color: colors.text, fontWeight: '600' },
  remove: { paddingHorizontal: space(2), paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,77,94,0.14)' },
  removeText: { color: '#FF8A95', fontSize: 12, fontWeight: '800' },
  addList: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space(2), gap: 2 },
});
