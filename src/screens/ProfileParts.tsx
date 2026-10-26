import { Cake, Camera, ChevronRight, Gem, ImagePlus, MapPin, Palette, Pin, Sparkles, Trash2, Users, Wallet, X, Zap } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CropPicker from 'react-native-image-crop-picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { SvgXml } from 'react-native-svg';
import { addCover, api, errorText, imageUri, removeAvatar, setCovers, uploadAvatar, type UserProfile } from '../api';
import { expiryText, showBadgeDetails, type Badge } from '../components/Badges';
import { confirmDialog } from '../components/Dialog';
import { Gradient } from '../components/Gradient';
import { Sheet, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, gradients, radius, space } from '../theme';

export const MAX_PINNED = 9;

// ---------- age & zodiac (from an ISO birthday, YYYY-MM-DD) ----------
export function ageOf(birthday: string, today = new Date()) {
  const [y, m, d] = birthday.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}
// Each sign starts on the given day of its month (Capricorn wraps the year).
const SIGNS: [string, number, number][] = [
  ['Capricorn', 1, 1], ['Aquarius', 1, 20], ['Pisces', 2, 19], ['Aries', 3, 21], ['Taurus', 4, 20], ['Gemini', 5, 21],
  ['Cancer', 6, 21], ['Leo', 7, 23], ['Virgo', 8, 23], ['Libra', 9, 23], ['Scorpio', 10, 23], ['Sagittarius', 11, 22], ['Capricorn', 12, 22],
];
export function zodiacOf(birthday: string) {
  const [, m, d] = birthday.split('-').map(Number);
  return SIGNS.filter(([, sm, sd]) => m > sm || (m === sm && d >= sd)).at(-1)![0];
}
// Self-check, run once in development.
if (__DEV__ && !(zodiacOf('2001-08-29') === 'Virgo' && zodiacOf('2000-01-05') === 'Capricorn' && zodiacOf('2000-12-25') === 'Capricorn' && zodiacOf('2000-03-21') === 'Aries' && ageOf('2001-08-29', new Date(2026, 7, 28)) === 24 && ageOf('2001-08-29', new Date(2026, 7, 29)) === 25)) throw new Error('zodiacOf/ageOf self-check failed');

// Small round pill: ♂ 24 / ♀ 22 (whichever of gender and age is set).
export function GenderAge({ gender, birthday }: { gender: UserProfile['gender']; birthday: string | null }) {
  if (!gender && !birthday) return null;
  const tone = gender === 'FEMALE' ? '#FF5FA2' : gender === 'MALE' ? '#4C8DFF' : '#9B7BFF';
  const sign = gender === 'FEMALE' ? '♀' : gender === 'MALE' ? '♂' : gender === 'OTHER' ? '⚧' : '';
  const age = birthday ? ageOf(birthday) : null;
  return (
    <View style={[st.gender, { backgroundColor: tone }]} accessibilityLabel={[gender?.toLowerCase(), age && `${age} years old`].filter(Boolean).join(', ')}>
      <Text style={st.genderText}>
        {sign}
        {sign && age ? ' ' : ''}
        {age ?? ''}
      </Text>
    </View>
  );
}

// ---------- badge shelf: pinned badges glowing on a glass strip inside the identity card ----------
export function BadgeShelf({ profile, onEdit }: { profile: UserProfile; onEdit: () => void }) {
  const pinned = profile.pinnedBadges.map((id) => profile.badges.find((b) => b.id === id)).filter((b): b is Badge => !!b);
  if (!pinned.length) {
    if (!profile.isMe || !profile.badges.length) return null;
    return (
      <Pressable onPress={onEdit} accessibilityRole="button" style={st.pinPrompt}>
        <Pin size={13} color="#fff" strokeWidth={2.6} />
        <Text style={st.pinPromptText}>Pin badges to show them here</Text>
      </Pressable>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.shelf} contentContainerStyle={st.shelfRow}>
      {pinned.map((b) => (
        <Pressable key={b.id} onPress={() => showBadgeDetails(b)} accessibilityRole="button" accessibilityLabel={`${b.name} badge`} style={st.glow}>
          <SvgXml xml={b.svg} width={30} height={30} />
        </Pressable>
      ))}
      {profile.isMe ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="Change pinned badges" style={[st.glow, st.glowAdd]}>
          <Pin size={14} color="#fff" strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

// ---------- Badges section: every badge as a glowing medal; on your own profile, tap to pin / unpin ----------
export function BadgesSection({ profile, onChange }: { profile: UserProfile; onChange: (pinned: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  if (!profile.badges.length) return <Text style={st.empty}>{profile.isMe ? 'No badges yet. Badges you earn show up here.' : 'No badges yet.'}</Text>;
  async function togglePin(b: Badge) {
    if (busy) return;
    const on = profile.pinnedBadges.includes(b.id);
    if (!on && profile.pinnedBadges.length >= MAX_PINNED) return toast(`You can pin up to ${MAX_PINNED} badges`);
    const next = on ? profile.pinnedBadges.filter((x) => x !== b.id) : [...profile.pinnedBadges, b.id];
    setBusy(true);
    try {
      onChange((await api<{ pinnedBadges: string[] }>('PUT', '/me/pinned-badges', { badgeIds: next })).pinnedBadges);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={st.section}>
      {profile.isMe ? (
        <Text style={st.hint}>
          Tap to pin to your card · {profile.pinnedBadges.length}/{MAX_PINNED} pinned · hold for details
        </Text>
      ) : null}
      <View style={st.medals}>
        {profile.badges.map((b) => {
          const pinned = profile.pinnedBadges.includes(b.id);
          return (
            <Pressable
              key={b.id}
              onPress={() => (profile.isMe ? togglePin(b) : showBadgeDetails(b))}
              onLongPress={() => showBadgeDetails(b)}
              accessibilityRole="button"
              accessibilityLabel={`${b.name}. ${expiryText(b.expiresAt)}${profile.isMe ? (pinned ? '. Pinned, tap to unpin' : '. Tap to pin') : ''}`}
              style={({ pressed }) => [st.medal, pressed && { transform: [{ scale: 0.96 }] }]}>
              <View style={[st.medalRing, pinned && st.medalPinned]}>
                <SvgXml xml={b.svg} width={46} height={46} />
                {pinned ? (
                  <View style={st.pinDot}>
                    <Pin size={10} color="#fff" fill="#fff" />
                  </View>
                ) : null}
              </View>
              <Text style={st.medalName} numberOfLines={1}>
                {b.name}
              </Text>
              <Text style={st.medalExp} numberOfLines={1}>
                {expiryText(b.expiresAt).replace('Expires in ', '')}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---------- Profile section: bio, details as icon chips, interests as gradient chips ----------
export function DetailsSection({ profile }: { profile: UserProfile }) {
  const nav = useNav();
  const details = [
    profile.birthday ? { Icon: Cake, text: `${ageOf(profile.birthday)} · ${zodiacOf(profile.birthday)}` } : null,
    profile.hometown ? { Icon: MapPin, text: profile.hometown } : null,
  ].filter((x): x is { Icon: typeof Cake; text: string } => !!x);
  const missing = !profile.bio || !profile.birthday || !profile.hometown || !profile.interests.length;
  return (
    <View style={st.section}>
      <View style={st.panel}>
        <Text style={profile.bio ? st.bio : st.bioEmpty}>{profile.bio || (profile.isMe ? 'Write a line about yourself.' : 'No bio yet.')}</Text>
        {details.length ? (
          <View style={st.chips}>
            {details.map(({ Icon, text }) => (
              <View key={text} style={st.detail}>
                <Icon size={14} color={colors.accent} strokeWidth={2.4} />
                <Text style={st.detailText}>{text}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {profile.interests.length ? (
        <View style={st.panel}>
          <Text style={st.panelTitle}>Into</Text>
          <View style={st.chips}>
            {profile.interests.map((t, i) => (
              <Gradient key={t} colors={CHIP_GRADIENTS[i % CHIP_GRADIENTS.length]} style={st.interest}>
                <Text style={st.interestText}>{t}</Text>
              </Gradient>
            ))}
          </View>
        </View>
      ) : null}
      {profile.isMe && missing ? (
        <Pressable onPress={() => nav.push({ name: 'profile' })} accessibilityRole="button" style={st.complete}>
          <Sparkles size={16} color={colors.primary} strokeWidth={2.4} />
          <Text style={st.completeText}>Complete your profile: birthday, hometown and interests</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const CHIP_GRADIENTS = [gradients.primary, gradients.violet, ['#22D3EE', '#3B82F6'], ['#FFB347', '#FF5F6D'], ['#34D399', '#059669']];

// ---------- own profile: round quick actions under the card ----------
export function QuickActions({ svip, styleOn, onStyle }: { svip: number; styleOn: boolean; onStyle: () => void }) {
  const nav = useNav();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    api<{ balance: number }>('GET', '/wallet')
      .then((w) => setBalance(w.balance))
      .catch(() => {});
  }, []);
  const items = [
    { label: balance === null ? 'Wallet' : balance.toLocaleString('en-IN'), sub: 'coins', Icon: Wallet, grad: gradients.gold, onPress: () => nav.push({ name: 'recharge' }) },
    { label: svip ? `SVIP${svip}` : 'SVIP', sub: svip ? 'perks' : 'unlock', Icon: Gem, grad: gradients.violet, onPress: () => nav.push({ name: 'svip' }) },
    { label: 'Recharge', sub: 'get coins', Icon: Zap, grad: gradients.primary, onPress: () => nav.push({ name: 'recharge' }) },
    { label: 'Style', sub: 'frames', Icon: Palette, grad: ['#22D3EE', '#3B82F6'], onPress: onStyle, on: styleOn },
  ];
  return (
    <View style={st.actions}>
      {items.map(({ label, sub, Icon, grad, onPress, on }) => (
        <Pressable key={sub} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${sub}`} style={({ pressed }) => [st.action, pressed && { transform: [{ scale: 0.95 }] }]}>
          <Gradient colors={grad} style={[st.actionIcon, on && st.actionOn]}>
            <Icon size={22} color="#fff" strokeWidth={2.3} />
          </Gradient>
          <Text style={st.actionLabel} numberOfLines={1}>
            {label}
          </Text>
          <Text style={st.actionSub}>{sub}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  gender: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  genderText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  shelf: { alignSelf: 'stretch', flexGrow: 0 },
  shelfRow: { gap: space(2), paddingHorizontal: space(4), paddingVertical: space(1) },
  glow: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#fff',
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  glowAdd: { borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.1)' },
  pinPrompt: { alignSelf: 'flex-start', marginHorizontal: space(4), flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  pinPromptText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginVertical: space(6) },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  section: { gap: space(3) },
  medals: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space(4) },
  medal: { width: 92, alignItems: 'center', gap: 4 },
  medalRing: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  medalPinned: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, elevation: 4 },
  pinDot: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.bg },
  medalName: { color: colors.text, fontSize: 12, fontWeight: '800' },
  medalExp: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  panel: { padding: space(4), gap: space(3), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  panelTitle: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  bio: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bioEmpty: { color: colors.muted, fontSize: 15, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh },
  detailText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  interest: { paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill },
  interestText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  complete: { flexDirection: 'row', alignItems: 'center', gap: space(2), padding: space(3), borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary + '88', backgroundColor: colors.primaryDim },
  completeText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space(2) },
  action: { width: 76, alignItems: 'center', gap: 3 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionOn: { borderWidth: 3, borderColor: colors.text },
  actionLabel: { color: colors.text, fontSize: 13, fontWeight: '800' },
  actionSub: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  coverDots: { position: 'absolute', top: 6, alignSelf: 'center', flexDirection: 'row', gap: 4 },
  coverDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  coverDotOn: { width: 16, backgroundColor: '#fff' },
  covers: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3), marginTop: space(3) },
  coverTile: { width: '30%', aspectRatio: 0.8, flexGrow: 1, maxWidth: '32%', borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  coverAdd: { alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary + '88', backgroundColor: colors.primaryDim },
  coverAddText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  coverRemove: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  mainTag: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primary },
  mainTagText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  inRoom: { flexDirection: 'row', alignItems: 'center', gap: space(2), maxWidth: '100%', paddingLeft: space(3), paddingRight: 4, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  liveDotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3D5A' },
  liveRing: { position: 'absolute', width: 9, height: 9, borderRadius: 5, backgroundColor: '#FF3D5A' },
  inRoomLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  inRoomTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  listeners: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  listenersText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: space(3), paddingRight: space(2), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  joinText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  viewerImage: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', right: space(4), width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  viewerActions: { position: 'absolute', left: space(6), right: space(6), flexDirection: 'row', gap: space(3) },
  viewerBtn: { flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  viewerPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  viewerBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

// ---------- photos: profile picture and cover slideshow ----------
// `original`: send the file untouched (no resize), so an animated GIF stays animated.
export async function pickPhoto(maxSide: number, original = false) {
  const r = await launchImageLibrary(
    original ? { mediaType: 'photo', selectionLimit: 1 } : { mediaType: 'photo', selectionLimit: 1, maxWidth: maxSide, maxHeight: maxSide, quality: 0.8 },
  );
  if (r.errorMessage) {
    toast(r.errorMessage);
    return null;
  }
  const a = r.assets?.[0];
  // Same limit as the server, checked here so a big GIF isn't uploaded just to be refused.
  if (a?.type === 'image/gif' && (a.fileSize ?? 0) > 2 * 1024 * 1024) {
    toast('GIF is too large (max 2 MB)');
    return null;
  }
  return a?.uri ? { uri: a.uri, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' } : null;
}

// Pick a profile picture, then move and zoom it inside a circle (native cropper). Resolves null when cancelled.
// `gif`: SVIP3+ may use an animated GIF, kept untouched (cropping would freeze it; the server checks the tier too).
export async function pickAvatar(gif = false) {
  try {
    const picked = await CropPicker.openPicker({ mediaType: 'photo' });
    if (gif && picked.mime === 'image/gif') {
      if ((picked.size ?? 0) > 2 * 1024 * 1024) return toast('GIF is too large (max 2 MB)'), null;
      return { uri: picked.path, type: 'image/gif', name: 'avatar.gif' };
    }
    const c = await CropPicker.openCropper({
      path: picked.path,
      mediaType: 'photo',
      width: 800,
      height: 800,
      cropperCircleOverlay: true,
      cropperToolbarTitle: 'Move and scale',
      cropperActiveWidgetColor: colors.primary,
      compressImageQuality: 0.85,
      forceJpg: true,
    });
    return { uri: c.path, type: 'image/jpeg', name: 'avatar.jpg' };
  } catch (e) {
    if ((e as { code?: string })?.code !== 'E_PICKER_CANCELLED') toast(errorText(e));
    return null;
  }
}

// Pick and crop a photo, then make it your profile picture. Resolves with the new URL, or undefined if cancelled / failed.
export async function chooseAvatar(gif = false) {
  const file = await pickAvatar(gif);
  if (!file) return undefined;
  try {
    return (await uploadAvatar(file)).avatarUrl;
  } catch (e) {
    toast(errorText(e));
    return undefined;
  }
}

// Full-screen look at a profile picture. On your own profile it also offers Change and Remove.
export function PhotoViewer({ uri, name, visible, onClose, onChange, gifOk = false }: {
  gifOk?: boolean; // SVIP3+: GIFs allowed
  uri: string | null;
  name: string | null;
  visible: boolean;
  onClose: () => void;
  onChange?: (avatarUrl: string | null) => void; // own profile only
}) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  async function change() {
    setBusy(true);
    const url = await chooseAvatar(gifOk);
    setBusy(false);
    if (url) onChange?.(url);
  }
  async function remove() {
    const ok = await confirmDialog({ title: 'Remove profile picture?', confirmText: 'Remove', danger: true, Icon: Trash2 });
    if (!ok) return;
    setBusy(true);
    try {
      onChange?.((await removeAvatar()).avatarUrl);
      onClose();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={st.viewer}>
        {/* Tap anywhere on the photo area to close. */}
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} accessibilityLabel="Close photo" accessibilityRole="button">
          {uri ? <Image source={{ uri: imageUri(uri) }} style={st.viewerImage} resizeMode="contain" accessibilityLabel={`${name ?? 'Profile'} photo`} /> : null}
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={[st.viewerClose, { top: insets.top + space(3) }]}>
          <X size={24} color="#fff" strokeWidth={2.6} />
        </Pressable>
        {onChange ? (
          <View style={[st.viewerActions, { bottom: insets.bottom + space(6) }]}>
            <Pressable onPress={change} disabled={busy} accessibilityRole="button" style={[st.viewerBtn, st.viewerPrimary]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Camera size={18} color="#fff" strokeWidth={2.4} />}
              <Text style={st.viewerBtnText}>Change photo</Text>
            </Pressable>
            <Pressable onPress={remove} disabled={busy} accessibilityRole="button" style={st.viewerBtn}>
              <Trash2 size={18} color="#fff" strokeWidth={2.4} />
              <Text style={st.viewerBtnText}>Remove</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// Cover photos fill the cover and crossfade every few seconds; dots show which one is up.
export function CoverSlideshow({ urls, height }: { urls: string[]; height: number }) {
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    setI(0);
    if (urls.length < 2) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        setI((x) => (x + 1) % urls.length);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, 4000);
    return () => clearInterval(t);
  }, [urls, fade]);
  const url = urls[Math.min(i, urls.length - 1)];
  if (!url) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.Image source={{ uri: imageUri(url) }} style={{ width: '100%', height, opacity: fade }} resizeMode="cover" />
      {urls.length > 1 ? (
        <View style={st.coverDots}>
          {urls.map((u, k) => (
            <View key={u} style={[st.coverDot, k === i && st.coverDotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// Own profile: add (up to the max), remove, or make one the main cover.
export function CoverSheet({ visible, onClose, profile, max, onChange }: {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile;
  max: number;
  onChange: (coverUrls: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const urls = profile.coverUrls;
  const run = async (fn: () => Promise<{ coverUrls: string[] }>) => {
    if (busy) return;
    setBusy(true);
    try {
      onChange((await fn()).coverUrls);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    const file = await pickPhoto(1440);
    if (file) run(() => addCover(file));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Cover photos">
      <Text style={st.hint}>Up to {max} photos, shown as a slideshow on your profile. Tap one to make it the first.</Text>
      <View style={st.covers}>
        {urls.map((u, k) => (
          <Pressable
            key={u}
            onPress={() => k && run(() => setCovers([u, ...urls.filter((x) => x !== u)]))}
            accessibilityRole="button"
            accessibilityLabel={k ? `Cover ${k + 1}. Tap to make it first` : 'Main cover'}
            style={st.coverTile}>
            <Image source={{ uri: imageUri(u) }} style={StyleSheet.absoluteFill} />
            {k === 0 ? (
              <View style={st.mainTag}>
                <Text style={st.mainTagText}>Main</Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => run(() => setCovers(urls.filter((x) => x !== u)))}
              accessibilityRole="button"
              accessibilityLabel={`Remove cover ${k + 1}`}
              hitSlop={8}
              style={st.coverRemove}>
              <X size={14} color="#fff" strokeWidth={3} />
            </Pressable>
          </Pressable>
        ))}
        {urls.length < max ? (
          <Pressable onPress={add} disabled={busy} accessibilityRole="button" accessibilityLabel="Add a cover photo" style={[st.coverTile, st.coverAdd]}>
            {busy ? <ActivityIndicator color={colors.primary} /> : <ImagePlus size={26} color={colors.primary} strokeWidth={2.2} />}
            <Text style={st.coverAddText}>{busy ? 'Saving…' : 'Add photo'}</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

// "In a room" pill on the cover: visitors tap to join the room this person is in; on your own profile it takes you back.
export function InRoomPill({ room, mine }: { room: NonNullable<UserProfile['inRoom']>; mine: boolean }) {
  const nav = useNav();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  // Already in that room (or it's yours): just show it; otherwise join (leaving any other room).
  const open = () => (nav.activeRoom?.roomId === room.roomId ? nav.showRoom() : nav.openRoom(room.roomId));
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={mine ? `You're in ${room.title}. Go back to the room` : `In ${room.title} now, ${room.listeners} listening. Join the room`}
      style={({ pressed }) => [st.inRoom, pressed && { opacity: 0.85 }]}>
      <View style={st.liveDotWrap}>
        <Animated.View style={[st.liveRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }] }]} />
        <View style={st.liveDot} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={st.inRoomLabel}>{mine ? "You're in" : room.kind === 'LIVE' ? 'Live now' : room.privacy === 'LOCKED' ? 'In a locked room' : 'In a room now'}</Text>
        <Text style={st.inRoomTitle} numberOfLines={1}>
          {room.title}
        </Text>
      </View>
      <View style={st.listeners}>
        <Users size={12} color="#fff" strokeWidth={2.6} />
        <Text style={st.listenersText}>{room.listeners}</Text>
      </View>
      <View style={st.joinBtn}>
        <Text style={st.joinText}>{mine ? 'Back' : 'Join'}</Text>
        <ChevronRight size={14} color={colors.primary} strokeWidth={3} />
      </View>
    </Pressable>
  );
}
