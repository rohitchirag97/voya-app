import { Camera, ChevronLeft, Heart, ImagePlus, Lock, Menu, MessageCircle, PenLine, Share2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  equipCosmetics,
  errorText,
  followLabel,
  getProfile,
  likeProfile,
  isFriend,
  listCosmetics,
  listPosts,
  setFollowing,
  type Cosmetic,
  type Post,
  type UserProfile,
} from '../api';
import { CpEntry } from '../components/Cp';
import { useCatalog } from '../room/catalog';
import { OfficialMark } from '../components/Official';
import { SvipBadge } from '../components/Svip';
import { FollowIcon } from '../components/Icons';
import { UserIds } from '../components/UserIds';
import { LevelBadge, LevelProgress } from '../components/Level';
import { DecorBanner, FramedAvatar } from '../components/Decor';
import { Gradient } from '../components/Gradient';
import { PostTile } from '../components/PostMedia';
import { SvgXml } from 'react-native-svg';
import { Button, IconButton, Screen, s, toast } from '../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNav } from '../nav';
import { BadgeShelf, BadgesSection, chooseAvatar, CoverSheet, CoverSlideshow, DetailsSection, GenderAge, InRoomPill, PhotoViewer, QuickActions } from './ProfileParts';
import { colors, gradients, radius, space, tintPairFor } from '../theme';

const AVATAR = 100;
const PARTNER = 60; // Love CP partner's picture beside yours
const MAX_COVERS = 6; // same as the server's limit
// Covers for profiles with no cover photos or card decoration. Sources: assets/avatars/cover-*.svg.
const DEFAULT_COVER = require('../../assets/avatars/cover-default.png');
const STAFF_COVER = require('../../assets/avatars/cover-staff.png');
type Section = 'profile' | 'badges' | 'posts' | 'style';

// `tab`: shown as the Profile tab (no back button, the tab bar sits below).
export function UserProfileScreen({
  userId,
  tab,
}: {
  userId: string;
  tab?: boolean;
}) {
  const nav = useNav();
  const [p, setP] = useState<UserProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<Section>('profile');
  const [cardH, setCardH] = useState(380); // the cover decoration / photos are drawn at the cover's real height
  const [coversOpen, setCoversOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const catalog = useCatalog();
  const love = p?.relationships?.find(r => r.type === 'LOVE');

  useEffect(() => {
    getProfile(userId)
      .then(setP)
      .catch(e => (toast(errorText(e)), nav.back()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // New or removed profile picture: this screen and the signed-in user (home header, other screens).
  function setAvatar(avatarUrl: string | null) {
    setP(cur => (cur ? { ...cur, avatarUrl } : cur));
    if (nav.me) nav.setMe({ ...nav.me, avatarUrl });
  }

  async function toggleFollow() {
    if (!p) return;
    setBusy(true);
    try {
      await setFollowing(p.userId, !p.isFollowing);
      setP({
        ...p,
        isFollowing: !p.isFollowing,
        followers: p.followers + (p.isFollowing ? -1 : 1),
      });
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const share = () =>
    p &&
    Share.share({ message: `${p.displayName} on VoyaLive · ID ${p.specialId ?? p.publicId}` }).catch(() => {});
  const pills: { key: Section; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'badges', label: p?.badges.length ? `Badges ${p.badges.length}` : 'Badges' },
    { key: 'posts', label: p?.posts ? `Posts ${p.posts}` : 'Posts' },
  ];

  return (
    <Screen backdrop top={false} bottom={!tab}>
      {/* White icons over the cover; the app default comes back when this screen closes. */}
      <StatusBar barStyle="light-content" />
      {!p ? (
        <ActivityIndicator
          color={colors.primary}
          size="large"
          style={{ marginTop: insets.top + space(24) }}
        />
      ) : (
        <ScrollView contentContainerStyle={st.body}>
          {/* Cover runs up behind the status bar: big avatar on the left, name, ID and badges under it, likes on the right. */}
          <View style={[st.hero, { paddingTop: insets.top + 60 }]} onLayout={e => setCardH(e.nativeEvent.layout.height)}>
            <Gradient colors={tintPairFor(p.userId)} style={StyleSheet.absoluteFill} />
            {/* Cover photos win over the card decoration; with neither, the default cover (staff get their own). */}
            {p.coverUrls.length ? (
              <CoverSlideshow urls={p.coverUrls} height={cardH} />
            ) : p.cardDecor ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <DecorBanner svg={p.cardDecor.svg} height={cardH} />
              </View>
            ) : (
              <Image source={p.staffRole ? STAFF_COVER : DEFAULT_COVER} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
            <Gradient vertical colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.45)']} style={StyleSheet.absoluteFill} />
            {p.isMe ? (
              <Pressable onPress={() => setCoversOpen(true)} accessibilityRole="button" accessibilityLabel="Change cover photos" style={st.coverBtn}>
                <ImagePlus size={15} color="#fff" strokeWidth={2.4} />
                <Text style={st.coverBtnText}>Cover</Text>
              </Pressable>
            ) : null}
            <View style={st.heroRow}>
              <View style={st.heroLeft}>
                <View style={st.avatarRow}>
                  {/* With a photo: open it full screen (yours also offers Change / Remove). Without one: yours goes straight to picking. */}
                  <Pressable
                    onPress={() => (p.avatarUrl ? setPhotoOpen(true) : chooseAvatar(p.svip >= 3).then(url => url && setAvatar(url)))}
                    disabled={!p.isMe && !p.avatarUrl}
                    accessibilityRole="button"
                    accessibilityLabel={p.avatarUrl ? 'View profile picture' : 'Add a profile picture'}
                  >
                    <FramedAvatar id={p.userId} name={p.displayName} uri={p.avatarUrl} size={AVATAR} frameSvg={p.avatarFrame?.svg} />
                    {p.isMe ? (
                      <View style={st.camera}>
                        <Camera size={14} color="#fff" strokeWidth={2.6} />
                      </View>
                    ) : null}
                  </Pressable>
                  {/* Love CP: the partner's framed picture tucked against yours, a heart where they meet. */}
                  {love ? (
                    <>
                      <View style={st.loveHeart} pointerEvents="none">
                        <Text style={st.loveHeartText}>💗</Text>
                      </View>
                      <Pressable
                        onPress={() => nav.push({ name: 'user', userId: love.user.userId })}
                        accessibilityRole="button"
                        accessibilityLabel={`Love CP: ${love.user.displayName}. Open their profile`}
                        style={st.partner}
                      >
                        <FramedAvatar
                          id={love.user.userId}
                          name={love.user.displayName}
                          uri={love.user.avatarUrl}
                          size={PARTNER}
                          frameSvg={love.user.frameId ? catalog.frames[love.user.frameId]?.svg : undefined}
                        />
                        <Text style={st.partnerName} numberOfLines={1}>
                          {love.user.displayName}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
                <View style={st.nameRow}>
                  <Text style={st.name} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                  <OfficialMark role={p.staffRole} size={18} />
                  <GenderAge gender={p.gender} birthday={p.birthday} />
                </View>
                <UserIds publicId={p.publicId} specialId={p.specialId} light />
                <View style={st.chipRow}>
                  <SvipBadge tier={p.svip} size="md" />
                  {p.level ? <LevelBadge level={p.level.level} size="md" /> : null}
                </View>
                {p.inRoom ? <InRoomPill room={p.inRoom} mine={p.isMe} /> : null}
              </View>
              {p.isMe ? (
                // Your own total (not a button): outlined until someone likes you, then filled.
                <View style={st.likeTotal} accessibilityLabel={`${p.likes} profile likes`}>
                  <Heart size={24} color={p.likes ? '#FF3D6E' : '#fff'} fill={p.likes ? '#FF3D6E' : 'transparent'} strokeWidth={2.2} />
                  <Text style={st.likeTotalText}>{p.likes}</Text>
                  <Text style={st.likeTotalLabel}>{p.likes === 1 ? 'like' : 'likes'}</Text>
                </View>
              ) : (
                <LikeButton profile={p} onChange={l => setP({ ...p, ...l })} />
              )}
            </View>
            <BadgeShelf profile={p} onEdit={() => setSection('badges')} />
          </View>

          {/* Stats on a white card that tucks under the cover's rounded edge. */}
          <View style={st.statBar}>
            <Stat n={p.followers} label="Followers" onPress={() => nav.push({ name: 'people', userId: p.userId, kind: 'followers' })} />
            <Stat n={p.following} label="Following" onPress={() => nav.push({ name: 'people', userId: p.userId, kind: 'following' })} />
            <Stat n={p.friends} label="Friends" />
            {p.visitors !== undefined ? (
              <Stat n={p.visitors} label="Visitors" onPress={() => nav.push({ name: 'people', userId: p.userId, kind: 'visitors' })} />
            ) : null}
          </View>

          {p.isMe ? (
            <QuickActions svip={p.svip} styleOn={section === 'style'} onStyle={() => setSection(s => (s === 'style' ? 'profile' : 'style'))} />
          ) : (
            <View style={st.ctaRow}>
              <Button
                title={followLabel(p)}
                icon={<FollowIcon p={p} color={p.isFollowing ? colors.text : '#fff'} />}
                variant={p.isFollowing ? 'ghost' : 'primary'}
                onPress={toggleFollow}
                loading={busy}
                style={{ flex: 1 }}
              />
              {isFriend(p) ? (
                <Button
                  title="Message"
                  icon={<MessageCircle size={18} color="#fff" strokeWidth={2.4} />}
                  onPress={() => nav.push({ name: 'dm', userId: p.userId, displayName: p.displayName, staffRole: p.staffRole })}
                  style={{ flex: 1 }}
                />
              ) : null}
            </View>
          )}

          {section === 'style' ? (
            <Text style={st.styleTitle}>Your style</Text>
          ) : (
            <View style={st.pills} accessibilityRole="tablist">
              {pills.map(t => (
                <Pressable
                  key={t.key}
                  onPress={() => setSection(t.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: section === t.key }}
                  style={[st.pill, section === t.key && st.pillOn]}
                >
                  {section === t.key ? <Gradient colors={gradients.primary} style={StyleSheet.absoluteFill} /> : null}
                  <Text style={[st.pillText, section === t.key && st.pillTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {section === 'profile' ? (
            <>
              <CpEntry relationships={p.relationships ?? []} onPress={() => nav.push({ name: 'cp', userId: p.userId })} />
              <DetailsSection profile={p} />
            </>
          ) : section === 'badges' ? (
            <BadgesSection profile={p} onChange={pinnedBadges => setP({ ...p, pinnedBadges })} />
          ) : section === 'posts' ? (
            <PostGrid userId={p.userId} />
          ) : (
            <>
              {p.level ? (
                <Pressable onPress={() => nav.push({ name: 'recharge' })} accessibilityRole="button" accessibilityHint="Opens Recharge" style={st.levelCard}>
                  <LevelProgress info={p.level} />
                </Pressable>
              ) : null}
              <DecorationsPicker profile={p} onChange={setP} />
            </>
          )}
        </ScrollView>
      )}
      {p ? (
        <PhotoViewer
          uri={p.avatarUrl}
          name={p.displayName}
          visible={photoOpen}
          onClose={() => setPhotoOpen(false)}
          onChange={p.isMe ? setAvatar : undefined}
          gifOk={p.svip >= 3} // SVIP3 perk: animated profile picture
        />
      ) : null}
      {p?.isMe ? (
        <CoverSheet
          visible={coversOpen}
          onClose={() => setCoversOpen(false)}
          profile={p}
          max={MAX_COVERS}
          onChange={coverUrls => setP({ ...p, coverUrls })}
        />
      ) : null}
      {/* Top bar: back (or settings on your own tab), then edit and share. */}
      <View style={[st.floating, { top: insets.top + space(2) }]} pointerEvents="box-none">
        {tab ? (
          <IconButton label="Settings" onPress={() => nav.push({ name: 'settings' })} style={st.floatBtn}>
            <Menu size={22} color="#fff" strokeWidth={2.4} />
          </IconButton>
        ) : (
          <IconButton label="Back" onPress={nav.back} style={st.floatBtn}>
            <ChevronLeft size={24} color="#fff" strokeWidth={2.6} />
          </IconButton>
        )}
        <View style={st.topRight}>
          {p?.isMe ? (
            <IconButton label="Edit profile" onPress={() => nav.push({ name: 'profile' })} style={st.floatBtn}>
              <PenLine size={19} color="#fff" strokeWidth={2.4} />
            </IconButton>
          ) : null}
          {p ? (
            <IconButton label="Share profile" onPress={share} style={st.floatBtn}>
              <Share2 size={19} color="#fff" strokeWidth={2.4} />
            </IconButton>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

// Visitors' heart: outlined until they like the profile, then filled pink (with a little pop).
function LikeButton({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (l: { likes: number; likedByMe: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pop = useRef(new Animated.Value(1)).current;
  const liked = profile.likedByMe;
  async function toggle() {
    if (busy) return;
    const before = { likes: profile.likes, likedByMe: liked };
    onChange({ likes: profile.likes + (liked ? -1 : 1), likedByMe: !liked }); // optimistic
    if (!liked) {
      pop.setValue(0.6);
      Animated.spring(pop, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }).start();
    }
    setBusy(true);
    try {
      onChange(await likeProfile(profile.userId, !liked));
    } catch (e) {
      onChange(before);
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={st.likeCol}>
      <IconButton
        label={`${liked ? 'Unlike' : 'Like'} profile, ${profile.likes} likes`}
        onPress={toggle}
        style={st.floatBtn}
      >
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Heart
            size={21}
            color={liked ? '#FF3D8B' : '#fff'}
            fill={liked ? '#FF3D8B' : 'transparent'}
            strokeWidth={2.4}
          />
        </Animated.View>
      </IconButton>
      {/* Total likes, under the heart. */}
      <Text style={st.likeCount} importantForAccessibility="no">
        {profile.likes}
      </Text>
    </View>
  );
}

// Your own profile: choose a picture frame and a card decoration (all items free for now).
function DecorationsPicker({
  profile,
  onChange,
}: {
  profile: UserProfile;
  onChange: (p: UserProfile) => void;
}) {
  const [items, setItems] = useState<Cosmetic[] | null>(null);
  useEffect(() => {
    listCosmetics()
      .then(setItems)
      .catch(e => toast(errorText(e)));
  }, []);

  const equip = (change: Parameters<typeof equipCosmetics>[0]) =>
    equipCosmetics(change)
      .then(u =>
        onChange({
          ...profile,
          avatarFrame: u.avatarFrame,
          cardDecor: u.cardDecor,
          chatBubble: u.chatBubble,
        }),
      )
      .catch(e => toast(errorText(e)));

  if (!items) return null;
  const frames = items.filter(x => x.kind === 'AVATAR_FRAME');
  const decors = items.filter(x => x.kind === 'CARD_DECOR');
  const bubbles = items.filter(x => x.kind === 'CHAT_BUBBLE');
  return (
    <View style={st.decor}>
      <Text style={s.label}>Picture frame</Text>
      <View style={st.tiles}>
        <Tile
          label="None"
          on={!profile.avatarFrame}
          onPress={() => equip({ avatarFrameId: null })}
        >
          <FramedAvatar
            id={profile.userId}
            name={profile.displayName}
            size={44}
          />
        </Tile>
        {frames.map(f => (
          <Tile
            key={f.id}
            label={f.name}
            on={profile.avatarFrame?.id === f.id}
            lock={f.minSvip > (profile.svip ?? 0) ? f.minSvip : 0}
            onPress={() => equip({ avatarFrameId: f.id })}
          >
            <FramedAvatar
              id={profile.userId}
              name={profile.displayName}
              size={44}
              frameSvg={f.svg}
            />
          </Tile>
        ))}
      </View>
      <Text style={s.label}>Profile card</Text>
      <View style={st.tiles}>
        <Tile
          label="None"
          on={!profile.cardDecor}
          onPress={() => equip({ cardDecorId: null })}
        >
          <View style={st.decorNone} />
        </Tile>
        {decors.map(d => (
          <Tile
            key={d.id}
            label={d.name}
            on={profile.cardDecor?.id === d.id}
            onPress={() => equip({ cardDecorId: d.id })}
          >
            <View style={st.decorThumb}>
              <DecorBanner svg={d.svg} height={52} />
            </View>
          </Tile>
        ))}
      </View>
      <Text style={s.label}>Chat bubble</Text>
      <View style={st.tiles}>
        <Tile
          label="None"
          on={!profile.chatBubble}
          onPress={() => equip({ chatBubbleId: null })}
        >
          <View style={st.bubbleNone}>
            <Text style={st.bubbleText}>Hi</Text>
          </View>
        </Tile>
        {bubbles.map(b => (
          <Tile
            key={b.id}
            label={b.name}
            on={profile.chatBubble?.id === b.id}
            lock={b.minSvip > (profile.svip ?? 0) ? b.minSvip : 0}
            onPress={() => equip({ chatBubbleId: b.id })}
          >
            <View style={st.bubbleWrap}>
              <Gradient
                colors={
                  b.style?.gradient ?? [colors.surfaceHigh, colors.surfaceHigh]
                }
                style={[
                  st.bubbleNone,
                  {
                    borderWidth: 1.5,
                    borderColor: b.style?.border ?? colors.border,
                  },
                ]}
              >
                <Text
                  style={[st.bubbleText, b.style && { color: b.style.text }]}
                >
                  Hi
                </Text>
              </Gradient>
              <View style={st.bubbleOrn} pointerEvents="none">
                <SvgXml xml={b.svg} width={26} height={15} />
              </View>
            </View>
          </Tile>
        ))}
      </View>
    </View>
  );
}

// `lock`: SVIP tier needed when you don't have it yet (0 = free to use).
function Tile({
  label,
  on,
  onPress,
  lock = 0,
  children,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
  lock?: number;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={lock ? () => toast(`Reach SVIP${lock} this month to use ${label}`) : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: on, disabled: !!lock }}
      accessibilityLabel={lock ? `${label}, needs SVIP ${lock}` : label}
      style={({ pressed }) => [
        st.tile,
        on && st.tileOn,
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={[st.tileArt, !!lock && { opacity: 0.45 }]}>{children}</View>
      {lock ? (
        <View style={st.tileLock}>
          <SvipBadge tier={lock} />
          <Lock size={12} color={colors.muted} strokeWidth={2.6} />
        </View>
      ) : null}
      <Text
        style={[st.tileLabel, on && { color: colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// 3-column photo grid; tap opens the post.
function PostGrid({ userId }: { userId: string }) {
  const nav = useNav();
  const { width } = useWindowDimensions();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const more = (c: string | null) =>
    listPosts(userId, c)
      .then(r => {
        setPosts(prev => [...(c ? prev ?? [] : []), ...r.posts]);
        setCursor(r.nextCursor);
      })
      .catch(e => toast(errorText(e)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void more(null), [userId]);

  const cell = Math.floor((width - space(4) * 2 - 4) / 3);
  if (!posts)
    return (
      <ActivityIndicator
        color={colors.primary}
        style={{ marginTop: space(6) }}
      />
    );
  if (!posts.length)
    return <Text style={[s.muted, { marginTop: space(6) }]}>No posts yet</Text>;
  return (
    <View style={st.gridWrap}>
      <View style={st.grid}>
        {posts.map(x => (
          <Pressable
            key={x.postId}
            onPress={() => nav.push({ name: 'post', post: x })}
            accessibilityRole="button"
            accessibilityLabel={x.caption || (x.kind === 'VIDEO' ? 'Video' : 'Photo')}
          >
            <PostTile post={x} size={cell} />
          </Pressable>
        ))}
      </View>
      {cursor ? (
        <Button
          title="Show more"
          variant="ghost"
          onPress={() => more(cursor)}
          style={{ marginTop: space(3) }}
        />
      ) : null}
    </View>
  );
}

function Stat({
  n,
  label,
  onPress,
}: {
  n: number;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${n} ${label}`}
      style={({ pressed }) => [st.stat, pressed && { opacity: 0.6 }]}
    >
      <Text style={st.statNum}>{n}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  // Full-width cover (cancels the body's side padding) with rounded bottom corners.
  hero: { marginHorizontal: -space(4), gap: space(3), paddingBottom: space(10), borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: space(4), gap: space(3) },
  heroLeft: { flex: 1, alignItems: 'flex-start', gap: space(2) },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end' },
  // Pulled left over the frame's empty margin so the two pictures sit together.
  partner: { alignItems: 'center', gap: 2, maxWidth: 84, marginLeft: -26, marginBottom: 6 },
  loveHeart: {
    zIndex: 2,
    elevation: 6,
    marginLeft: -20,
    marginBottom: 34,
    marginRight: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  loveHeartText: { fontSize: 13 },
  partnerName: { color: '#fff', fontSize: 11, fontWeight: '700', maxWidth: 84 },
  camera: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 2, borderColor: '#fff' },
  coverBtn: { position: 'absolute', right: space(4), bottom: space(12), zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space(3), paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  coverBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  likeTotal: { alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.22)' },
  likeTotalText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  likeTotalLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '700', marginTop: -2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: '#fff', fontSize: 24, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 4 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statBar: { flexDirection: 'row', marginTop: -space(10), paddingVertical: space(3), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, shadowColor: '#5B3FFF', shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  body: { paddingHorizontal: space(4), paddingBottom: 200, gap: space(4) },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statNum: { color: colors.text, fontSize: 19, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 11.5, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: space(2), padding: 4, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  pill: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, overflow: 'hidden' },
  pillOn: {},
  pillText: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  pillTextOn: { color: '#fff' },
  styleTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  topRight: { flexDirection: 'row', gap: space(2) },
  likeCol: { alignItems: 'center', gap: 2 },
  likeCount: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 4,
  },
  floating: {
    position: 'absolute',
    left: space(4),
    right: space(4),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  floatBtn: {
    backgroundColor: 'rgba(15,10,36,0.32)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  decor: {
    alignSelf: 'stretch',
    gap: space(3),
    marginTop: space(4),
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  tile: {
    width: 104,
    alignItems: 'center',
    gap: space(2),
    padding: space(2),
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileLock: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  tileOn: { borderColor: colors.primary },
  tileArt: {
    height: 66,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  decorThumb: {
    width: 88,
    height: 52,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  bubbleWrap: { paddingTop: 5, paddingRight: 8 },
  bubbleNone: {
    width: 64,
    height: 34,
    borderRadius: 14,
    borderTopLeftRadius: 4,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bubbleText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  bubbleOrn: { position: 'absolute', top: -4, right: -2 },
  decorNone: {
    width: 88,
    height: 52,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
  },
  levelCard: {
    alignSelf: 'stretch',
    padding: space(4),
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  gridWrap: { alignSelf: 'stretch', },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: space(2),
    alignSelf: 'stretch',
    },
});
