import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as Keychain from 'react-native-keychain';
import { API_URL, GOOGLE_WEB_CLIENT_ID } from './config';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

// In chat, senders also carry their bubble id and up to 3 active badge ids (artwork via the catalog).
export type StaffRole = 'SUPPORT' | 'MODERATOR' | 'ADMIN' | 'OWNER';
export type UserSummary = { userId: string; displayName: string | null; avatarUrl: string | null; level?: number; bubbleId?: string | null; badges?: string[]; staffRole?: StaffRole | null; svip?: number; frameId?: string | null };
// Your own / a full profile: `level` is the detailed progress, not just the number.
// publicId: everyone's 10-digit ID. specialId: optional premium short ID, granted separately.
export type Me = Omit<UserSummary, 'level' | 'badges'> & {
  publicId: number;
  specialId: string | null;
  bio: string | null;
  status: string;
  level?: import('./components/Level').LevelInfo;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  birthday: string | null; // YYYY-MM-DD
  hometown: string | null;
  interests: string[];
  coverUrls: string[]; // profile cover photos, first is the main one
};
export type Seat = {
  seatIndex: number;
  rowIndex: number;
  columnIndex: number;
  role: 'HOST' | 'SPEAKER';
  streamId: string | null;
  micMuted: boolean; // self mute: the occupant's own switch
  modMuted: boolean; // admin mute: the owner/admin switch. Mic is live only when both are off.
  cameraOff?: boolean; // live streams: this seat's camera is off (audio only), so show the avatar
  locked: boolean;
  occupant: (UserSummary & { presence: 'CONNECTED' | 'DISCONNECTED' | null }) | null;
};
export type Participant = UserSummary & { role: string; presence: string };
export type RoomSnapshot = {
  roomId: string;
  hostUserId: string;
  title: string;
  coverUrl?: string | null;
  category: string | null;
  status: 'CREATED' | 'LIVE' | 'ENDING' | 'ENDED' | 'FAILED';
  seatCount: number;
  rowLayout: number[];
  listenerCount: number;
  roomVersion: number;
  seats: Seat[];
  participants: Participant[];
  admins: string[];
  charisma: Charisma | null; // null = counter off
  pk: Pk | null; // running PK 1v1, null = none
  background: string; // backdrop preset key (see ROOM_BACKGROUNDS)
  showEntry: boolean; // "X joined" notices in chat
  giftAnimations: boolean; // full-screen gift effects + gift banners
  privacy: RoomPrivacy;
  kind: RoomKind; // LIVE: video live stream (seat 0 = host camera, 1-3 = co-hosts)
  pinned?: boolean;
  official?: boolean;
  ludo?: boolean; // Ludo mode: seats in one row with the board below (the board page follows the game itself)
};
// Charisma counter: coins of gifts each person received in this room since startedAt.
export type Charisma = { startedAt: string; totals: Record<string, number> };
// PK 1v1: score = coins of gifts each side received in this room since startedAt; ends at endsAt.
export type PkSide = { userId: string; displayName: string | null; avatarUrl: string | null; score: number };
export type Pk = { a: PkSide; b: PkSide; startedAt: string; endsAt: string };
// Weekly rank among all rooms (null = no gifts yet this week) and the heart level from lifetime gift coins.
export type RoomStats = { rank: number | null; weekCoins: number; weekEndsAt: string; heart: { level: number; coins: number; nextAt: number | null } };
export type ZegoCreds = {
  appId: number;
  zegoRoomId: string;
  zegoUserId: string;
  token: string;
  streamId: string | null;
};
export type RoomCard = {
  roomId: string;
  title: string;
  category: string | null;
  seatCount: number;
  listenerCount: number;
  privacy: RoomPrivacy; // never PRIVATE here: private rooms aren't listed
  kind: RoomKind;
  inPk?: boolean; // live streams: invited to or in a PK right now
  pinned?: boolean; // pinned to the top of the list (staff)
  official?: boolean; // the official help room, always first
  stage?: { userId: string; displayName: string | null; avatarUrl: string | null }[]; // first 4 seated, by seat
  seatsFree?: number; // open, unlocked guest seats
  host: UserSummary;
};
// Home "Friends": a room or live stream with the people you follow who are in it.
export type FriendActivity = { room: RoomCard; friends: { userId: string; displayName: string | null; avatarUrl: string | null }[] };
export type ChatMessage = {
  messageId: string;
  type: 'USER' | 'SYSTEM' | 'FOLLOW' | 'PRIVATE'; // FOLLOW/PRIVATE: local-only notes only this user sees
  body: string;
  mentions: string[];
  clientMessageId: string | null;
  payload?: { userId?: string; youFollowThem?: boolean; kind?: string; game?: 'jungle' | 'galaxy' | 'rocket'; amount?: number; emote?: import('./room/Emotes').EmoteKey; result?: string } | null; // system/follow items name the user they are about; game wins name the game; emotes carry the server-drawn result
  sender: UserSummary | null;
  createdAt: string;
};
export type Decoration = { id: string; name: string; svg: string };
export type BubbleStyle = { gradient: string[]; border: string; text: string };
export type Cosmetic = Decoration & { kind: 'AVATAR_FRAME' | 'CARD_DECOR' | 'CHAT_BUBBLE'; style?: BubbleStyle | null; minSvip: number }; // minSvip: SVIP tier needed (0 = anyone)
export type UserProfile = Me & {
  followers: number;
  following: number;
  friends: number; // mutual follows
  posts: number;
  likes: number; // profile likes (heart on the profile page)
  likedByMe: boolean;
  visitors?: number; // only on your own profile
  isFollowing: boolean;
  followsMe: boolean;
  isMe: boolean;
  avatarFrame: Decoration | null;
  cardDecor: Decoration | null;
  chatBubble: (Decoration & { style?: BubbleStyle | null }) | null;
  badges: import('./components/Badges').Badge[];
  pinnedBadges: string[]; // badge wall, in order (owned badges only)
  inRoom: { roomId: string; title: string; coverUrl: string | null; listeners: number; privacy: RoomPrivacy; kind: RoomKind } | null; // the live room they're in now
  svip: number;
  week?: { contribution: number; charisma: number; endsAt: string }; // gifts sent / received since Monday (India time)
  relationships: Relationship[]; // active CPs, oldest first
};

// ---------- CP (relationships) ----------
export type CpType = 'LOVE' | 'BESTIE' | 'SIBLING';
export type CpLabel = 'BROTHER' | 'SISTER';
export type Relationship = { pairId: string; type: CpType; label: CpLabel | null; since: string; user: { userId: string; displayName: string | null; avatarUrl: string | null } };
export type CpProposal = { id: string; fromId: string; toId: string; type: CpType; label: CpLabel | null; price: number; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED'; expiresAt: string };
export type CpOptions = { types: Record<CpType, { max: number; price: number; gift: string }>; proposalTtlMs: number };
export const getCpOptions = () => api<CpOptions>('GET', '/cp/options');
export const proposeCp = (toUserId: string, type: CpType, label?: CpLabel) => api<{ proposal: CpProposal; balance: number }>('POST', '/cp/proposals', { toUserId, type, label });
export const answerCp = (id: string, action: 'accept' | 'decline' | 'cancel') => api<CpProposal>('POST', `/cp/proposals/${id}/${action}`);
export const endCp = (pairId: string) => api<{ ended: true }>('DELETE', `/cp/pairs/${pairId}`);
export const listCosmetics = () => api<Cosmetic[]>('GET', '/cosmetics');
export const equipCosmetics = (change: { avatarFrameId?: string | null; cardDecorId?: string | null; chatBubbleId?: string | null }) =>
  api<UserProfile>('PATCH', '/me/cosmetics', change);
export const isFriend = (p: UserProfile) => p.isFollowing && p.followsMe; // mutual follow
export const followLabel = (p: UserProfile) =>
  isFriend(p) ? 'Friends' : p.isFollowing ? 'Following' : p.followsMe ? 'Follow back' : 'Follow';
export type DirectMessage = { id: number; senderId: string; recipientId: string; body: string; clientMessageId: string | null; createdAt: string; cp?: CpProposal | null };
export const getProfile = (userId: string) => api<UserProfile>('GET', `/users/${userId}`);
// Up to 50 profiles at once, without counting as visits (room prefetch).
export const getCards = (ids: string[]) => api<{ profiles: UserProfile[] }>('POST', '/users/cards', { ids });
export const likeProfile = (userId: string, on: boolean) => api<{ likes: number; likedByMe: boolean }>(on ? 'POST' : 'DELETE', `/users/${userId}/like`);

// imageUrl: the photo, or a video's poster frame. width/height: original size (null for text and older posts).
export type Post = {
  postId: string;
  kind: 'IMAGE' | 'VIDEO' | 'TEXT';
  imageUrl: string | null;
  videoUrl: string | null;
  width: number | null;
  height: number | null;
  caption: string;
  createdAt: string;
  author: UserSummary;
  likes: number;
  comments: number;
  likedByMe: boolean;
};
export type PostComment = { id: number; body: string; createdAt: string; user: UserSummary };
export type PostPage = { posts: Post[]; nextCursor: string | null };
export const imageUri = (path: string) => API_URL + path; // server returns /v1/uploads/<file>
// Room covers: uploaded ones come back as /v1/uploads/<file>; older ones may be full URLs.
export const roomCoverUri = (url?: string | null) => (!url ? null : url.startsWith('/') ? API_URL + url : url);
// PUBLIC: listed, anyone joins. LOCKED: 4-digit password to join. PRIVATE: hidden; only the owner and admins enter.
export type RoomPrivacy = 'PUBLIC' | 'LOCKED' | 'PRIVATE';
export type RoomSettingsPatch = { title?: string; background?: string; showEntry?: boolean; giftAnimations?: boolean; privacy?: RoomPrivacy; password?: string };
export const listPosts = (userId?: string, cursor?: string | null) =>
  api<PostPage>('GET', `${userId ? `/users/${userId}/posts` : '/posts'}?limit=12${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
type LocalFile = { uri: string; type: string; name: string };
// Text post: caption only. Photo: file + size. Video: file + poster thumb + size.
export function createPost(p: { caption: string; file?: LocalFile; thumb?: LocalFile; width?: number; height?: number }) {
  const form = new FormData();
  form.append('caption', p.caption);
  if (p.file) {
    form.append('file', p.file as unknown as Blob); // React Native uploads { uri, type, name } straight from disk
    form.append('width', String(p.width));
    form.append('height', String(p.height));
  }
  if (p.thumb) form.append('thumb', p.thumb as unknown as Blob);
  return api<{ postId: string }>('POST', '/posts', form);
}
export const deletePost = (postId: string) => api('DELETE', `/posts/${postId}`);
export const likePost = (postId: string, on: boolean) => api<{ likes: number; likedByMe: boolean }>(on ? 'POST' : 'DELETE', `/posts/${postId}/like`);

export type Conversation = { user: UserSummary; lastMessage: DirectMessage };

export type FoundUser = UserSummary & { publicId: number; specialId: string | null };
export type PeopleKind = 'followers' | 'following' | 'visitors';
// at = when they followed / last visited; visits only on the visitors list.
export type Person = FoundUser & { isFollowing: boolean; at: string; visits?: number };
export type CoinSeller = FoundUser & { since: string };
export type CoinSellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null; // null = never applied
export const searchUsers = (q: string) => api<{ users: FoundUser[] }>('GET', `/users/search?q=${q}`);
export const listConversations = () => api<{ conversations: Conversation[] }>('GET', '/dm');

// "now", "5m", "3h", "2d", then a date.
export function timeAgo(iso: string) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}
export const setFollowing = (userId: string, follow: boolean) => api(follow ? 'POST' : 'DELETE', `/users/${userId}/follow`);

// svg: optional artwork; animation: motion preset played when sent ("launch", else "pop").
export type Gift = { id: string; name: string; coinPrice: number; maxQuantity: number; svg?: string | null; animation?: string | null };

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0) {
    super(message);
  }
}

type Session = { accessToken: string; refreshToken: string; accessTokenExpiresAt: number };
let session: Session | null = null;
let onSignedOut = () => {};
export const setSignedOutHandler = (fn: () => void) => (onSignedOut = fn);

async function save(s: Session | null) {
  session = s;
  if (s) await Keychain.setGenericPassword('session', JSON.stringify(s));
  else await Keychain.resetGenericPassword();
}

export async function loadSession() {
  const c = await Keychain.getGenericPassword();
  session = c ? JSON.parse(c.password) : null;
  return !!session;
}

let refreshing: Promise<boolean> | null = null;
async function refresh() {
  if (!session) return false;
  refreshing ??= raw('POST', '/v1/auth/refresh', { refreshToken: session.refreshToken })
    .then(async (s: Session) => (await save(s), true))
    .catch(async () => (await save(null), onSignedOut(), false))
    .finally(() => (refreshing = null));
  return refreshing;
}

// Access token valid for at least another minute (used by Socket.IO handshakes too).
export async function freshAccessToken() {
  if (session && session.accessTokenExpiresAt * 1000 - Date.now() < 60_000) await refresh();
  return session?.accessToken ?? '';
}

async function raw(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  let res: Response;
  try {
    // FormData (file uploads) goes as multipart; fetch sets its own content-type boundary.
    const form = body instanceof FormData;
    res = await fetch(API_URL + path, {
      method,
      headers: form ? headers : { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error?.code ?? 'HTTP_' + res.status, data?.error?.message ?? 'Request failed', res.status);
  return data;
}

export async function api<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const call = async () => raw(method, '/v1' + path, body, { ...headers, authorization: `Bearer ${await freshAccessToken()}` });
  try {
    return await call();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && (await refresh())) return call();
    throw e;
  }
}

export type SignInMethods = { phone: string | null; googleLinked: boolean };

// Opens Google's account picker; null when the user backs out.
async function googleIdToken() {
  await GoogleSignin.hasPlayServices();
  const res = await GoogleSignin.signIn();
  return isSuccessResponse(res) ? res.data.idToken : null;
}

export const auth = {
  requestOtp: (phone: string) => raw('POST', '/v1/auth/otp/request', { phone }) as Promise<{ devCode?: string }>,
  async verifyOtp(phone: string, code: string): Promise<Me> {
    const { user, ...s } = await raw('POST', '/v1/auth/otp/verify', { phone, code });
    await save(s);
    return user;
  },
  // null when the user backs out of Google's account picker.
  async google(): Promise<Me | null> {
    const idToken = await googleIdToken();
    if (!idToken) return null;
    const { user, ...s } = await raw('POST', '/v1/auth/google', { idToken });
    await save(s);
    return user;
  },
  // Second sign-in method on the current account. null when the user backs out.
  async linkGoogle(): Promise<SignInMethods | null> {
    const idToken = await googleIdToken();
    return idToken ? api('POST', '/me/link/google', { idToken }) : null;
  },
  linkPhone: (phone: string, code: string) => api<SignInMethods>('POST', '/me/link/phone', { phone, code }),
  // Changing the phone: step 1 returns a short-lived pass for step 2.
  verifyCurrentPhone: async (code: string) => (await api<{ changeToken: string }>('POST', '/me/phone/verify-current', { code })).changeToken,
  changePhone: (changeToken: string, phone: string, code: string) => api<SignInMethods>('POST', '/me/phone/change', { changeToken, phone, code }),
  async logout() {
    await api('POST', '/auth/logout').catch(() => {});
    // Forget the Google account so the picker shows again next time.
    await GoogleSignin.signOut().catch(() => {});
    await save(null);
  },
};

const friendly: Record<string, string> = {
  SEAT_TAKEN: 'Someone just took that seat.',
  ALREADY_SEATED: 'Leave your current seat first.',
  HOST_SEAT_RESERVED: 'That seat is reserved for the host.',
  SEAT_LOCKED: 'This seat is locked. The host can invite you to it.',
  SEAT_OCCUPIED: 'Someone is on that seat. Remove them before locking it.',
  INVITE_EXPIRED: 'That invite has expired.',
  RECIPIENT_NOT_SEATED: 'They left their seat before the gift went through. You were not charged.',
  INSUFFICIENT_COINS: 'Not enough coins.',
  RATE_LIMITED: 'Slow down a little and try again.',
  ROOM_NOT_LIVE: 'This room is no longer live.',
  REMOVED_FROM_ROOM: 'You were removed from this room.',
  NOT_SEATED: 'They are no longer on a seat.',
  NO_ONE_SEATED: 'Nobody is on stage right now.',
  NOT_FRIENDS: 'You can only message friends. Follow each other first.',
  BLOCKED: "You can't message this person.",
  NOT_ROOM_ADMIN: 'Only the room owner or an admin can do that.',
  NOT_HOST: 'Only the room owner can do that.',
  CANNOT_TARGET_OWNER: "You can't do that to the room owner.",
  CANNOT_TARGET_ADMIN: "Admins can't do that to other admins.",
  DISPLAY_NAME_TAKEN: 'That name is taken.',
  OTP_INVALID: 'That code is wrong or expired.',
  ALREADY_HAS_ROOM: 'You already have a room. Open it from the home screen.',
};
export const errorText = (e: unknown) =>
  e instanceof ApiError ? friendly[e.code] ?? e.message : 'Something went wrong';
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// SVIP from this calendar month's recharge. validUntil: end of the month, when the tier runs out (null = no tier).
export type SvipStatus = {
  tier: number;
  thisMonthRupees: number;
  validUntil: string | null;
  next: { tier: number; rupees: number; remaining: number } | null;
  tiers: { tier: number; rupees: number; perks: { title: string; detail: string }[] }[];
};
export const getSvip = () => api<SvipStatus>('GET', '/me/svip');
export type ProfileOptions = { interests: string[]; maxInterests: number; maxPinnedBadges: number; minAge: number; maxCovers: number };
export const getProfileOptions = () => api<ProfileOptions>('GET', '/profile-options');

// Profile picture and cover photos (JPEG/PNG from the phone's gallery).
const photoForm = (file: LocalFile) => {
  const form = new FormData();
  form.append('file', file as unknown as Blob);
  return form;
};
export const uploadAvatar = (file: LocalFile) => api<Me>('POST', '/me/avatar', photoForm(file));
export const removeAvatar = () => api<Me>('DELETE', '/me/avatar');
export const addCover = (file: LocalFile) => api<Me>('POST', '/me/covers', photoForm(file));
export const setCovers = (coverUrls: string[]) => api<Me>('PUT', '/me/covers', { coverUrls });

// ---------- live streams ----------
export type RoomKind = 'AUDIO' | 'LIVE';
export type LivePkSide = { roomId: string; title: string; host: UserSummary; streamId: string | null; score: number };
// Live PK: two live streams head to head; each side's score = gift coins received in its room during the battle.
export type LivePk = { pkId: string; status: 'ACTIVE'; minutes: number; startedAt: string; endsAt: string; a: LivePkSide; b: LivePkSide };
export type LivePkInvite = { pkId: string; minutes: number; from: { roomId: string; title: string; host: UserSummary }; expiresInMs: number };
export const LIVE_PK_MINUTES = [3, 5, 10] as const;
export const listLives = () => api<{ rooms: RoomCard[]; nextCursor: string | null }>('GET', '/lives?limit=30');
export const startLive = (title: string) => api<{ room: RoomSnapshot; zego: ZegoCreds }>('POST', '/lives', { title });
export const getFollowingActive = () => api<{ items: FriendActivity[] }>('GET', '/me/following/active');
export const getMyLive = () => api<{ room: RoomCard | null }>('GET', '/me/live');
