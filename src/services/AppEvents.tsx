import { DoorOpen } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, NativeModules, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type DirectMessage, type RoomInvite } from '../api';
import { ackDms, saveDms, setDmOwner, subscribeDms, syncPending, totalUnread, updateCpStatus } from './DmStore';
import { Avatar } from '../components/ui';
import { useNav } from '../nav';
import { roomColors as colors, radius, space } from '../theme';
import { connectSocket } from './RoomSocket';

// Android (RoomCallService.kt): posts the "new message" notification.
const Notify: { notifyMessage(senderId: string, title: string, body: string): void } | undefined = Platform.OS === 'android' ? NativeModules.RoomCall : undefined;

// ---------- notification settings (Settings > Notifications), kept on the phone ----------
export type NotifySettings = { messages: boolean; invites: boolean };
const Saved: { getSetting(key: string, fallback: boolean): Promise<boolean>; setSetting(key: string, value: boolean): void } | undefined =
  Platform.OS === 'android' ? NativeModules.RoomCall : undefined;
const KEYS: Record<keyof NotifySettings, string> = { messages: 'notify_messages', invites: 'notify_invites' };
let notify: NotifySettings = { messages: true, invites: true };
export async function loadNotifySettings() {
  if (Saved) notify = { messages: await Saved.getSetting(KEYS.messages, true), invites: await Saved.getSetting(KEYS.invites, true) };
  return notify;
}
export function setNotifySetting(key: keyof NotifySettings, on: boolean) {
  notify = { ...notify, [key]: on };
  Saved?.setSetting(KEYS[key], on); // the message notification itself also checks this natively
}

// ---------- unread direct messages (badges on the Messages buttons) ----------
// Counted from the chats saved on this phone (chats aren't kept on the server).
export function useUnreadDms() {
  const [n, setN] = useState(totalUnread);
  useEffect(() => {
    setN(totalUnread());
    return subscribeDms(() => setN(totalUnread()));
  }, []);
  return n;
}
// The chat open right now (DmScreen sets it): its new messages are read on arrival, so they don't count.
export let openChatWith: string | null = null;
export const setOpenChat = (userId: string | null) => (openChatWith = userId);

// Mounted once while signed in: one socket for things that matter on every screen — new messages (badge, and a
// notification when the app isn't on screen) and room invites from friends (a banner, tap to join).
// shortcut: works while the app process is alive (always during a room, thanks to the room's foreground service);
// messages to a closed app need push (FCM) to notify.
export function AppEvents() {
  const nav = useNav();
  const meId = nav.me!.userId;
  const activeRoom = useRef(nav.activeRoom?.roomId);
  activeRoom.current = nav.activeRoom?.roomId;
  const [invite, setInvite] = useState<(RoomInvite & { at: number }) | null>(null);

  useEffect(() => {
    setDmOwner(meId);
    const s = connectSocket();
    // Pick up messages that waited on the server while this phone was away (also after every reconnect).
    s.on('connect', () => syncPending(openChatWith).catch(() => {}));
    // A message, live: save it on this phone, tell the server it can forget it, and notify if the app is in the background.
    s.on('dm:new', (m: DirectMessage) => {
      ackDms(saveDms([m], openChatWith));
      if (m.recipientId === meId && m.senderId !== openChatWith && AppState.currentState !== 'active')
        Notify?.notifyMessage(m.senderId, m.senderName ?? 'New message', m.imageUrl ? '📷 Photo' : m.body);
    });
    s.on('cp:update', (e: { proposalId: string; status: NonNullable<DirectMessage['cp']>['status'] }) => updateCpStatus(e.proposalId, e.status));
    s.on('room:invite', (i: RoomInvite) => {
      if (notify.invites && i.roomId !== activeRoom.current) setInvite({ ...i, at: Date.now() });
    });
    loadNotifySettings().catch(() => {});
    s.connect();
    // Android 13+ shows nothing without this; asked once (the system remembers the answer).
    if (Platform.OS === 'android' && Platform.Version >= 33) PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    const app = AppState.addEventListener('change', (state) => state === 'active' && syncPending(openChatWith).catch(() => {}));
    return () => {
      s.removeAllListeners();
      s.disconnect();
      app.remove();
      setDmOwner(null);
    };
  }, [meId]);

  return invite ? (
    <InviteBanner
      key={invite.at}
      invite={invite}
      onDone={() => setInvite(null)}
      onJoin={() => {
        setInvite(null);
        nav.openRoom(invite.roomId); // leaves any other room first
      }}
    />
  ) : null;
}

const SHOW_MS = 2000;
// Slides down over whatever screen is open, stays 2 seconds, slides away. Tap to join the room.
function InviteBanner({ invite, onDone, onJoin }: { invite: RoomInvite; onDone: () => void; onJoin: () => void }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(-140)).current;
  useEffect(() => {
    const a = Animated.sequence([
      Animated.spring(y, { toValue: 0, friction: 7, useNativeDriver: true }),
      Animated.delay(SHOW_MS),
      Animated.timing(y, { toValue: -140, duration: 220, useNativeDriver: true }),
    ]);
    a.start(({ finished }) => finished && onDone());
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const name = invite.from.displayName ?? 'A friend';
  return (
    <Animated.View style={[st.wrap, { top: insets.top + space(2), transform: [{ translateY: y }] }]} pointerEvents="box-none">
      <Pressable onPress={onJoin} accessibilityRole="button" accessibilityLabel={`${name} invited you to ${invite.title}. Join`} accessibilityLiveRegion="polite" style={st.card}>
        <Avatar id={invite.from.userId} name={invite.from.displayName} uri={invite.from.avatarUrl} size={40} />
        <View style={st.mid}>
          <Text style={st.title} numberOfLines={1}>
            {name} invited you
          </Text>
          <Text style={st.sub} numberOfLines={1}>
            {invite.kind === 'LIVE' ? 'to their live: ' : 'to '}
            {invite.title}
          </Text>
        </View>
        <View style={st.join}>
          <DoorOpen size={14} color="#fff" strokeWidth={2.6} />
          <Text style={st.joinText}>Join</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: space(3), right: space(3), zIndex: 1000, elevation: 50 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    padding: space(3),
    borderRadius: radius.lg,
    backgroundColor: '#1C1238',
    borderWidth: 1,
    borderColor: 'rgba(255,138,198,0.45)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 50,
  },
  mid: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 13 },
  join: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: space(3), borderRadius: radius.pill, backgroundColor: colors.primary },
  joinText: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
