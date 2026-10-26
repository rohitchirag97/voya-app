import { DoorOpen, Mic, X } from 'lucide-react-native';
import React, { createContext, useContext, useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorText, roomCoverUri, type Me } from '../api';
import { showDialog } from '../components/Dialog';
import { DOCK_BOTTOM, FloatingBubble } from '../components/FloatingBubble';
import { Gradient } from '../components/Gradient';
import { Avatar, toast } from '../components/ui';
import type { ActiveRoom } from '../nav';
import { roomColors as colors, tintPairFor } from '../theme';
import { useRoom, type RoomState } from './useRoom';

const RoomContext = createContext<RoomState | null>(null);
export const useRoomSession = () => useContext(RoomContext);

const run = (fn: () => Promise<unknown>) => fn().catch((e) => toast(e instanceof Error && !('code' in e) ? e.message : errorText(e)));

// Owns the live room (socket + ZEGO media) for as long as the user is in it, whatever screen is showing.
export function RoomHost({ active, me, onClosed, children }: { active: ActiveRoom; me: Me; onClosed: () => void; children: React.ReactNode }) {
  const room = useRoom(active.roomId, me, active.created);

  // These alerts live here, not in the room screen, so they still show while the room is minimized.
  useEffect(() => {
    if (!room.closed) return;
    const text =
      room.closed === 'removed'
        ? 'You were removed from this room. The owner or an admin can let you back in.'
        : room.closed === 'ended'
          ? 'This live stream has ended.'
          : room.closed;
    showDialog({ title: 'Room closed', message: text, Icon: DoorOpen, tone: 'danger', dismissable: false, actions: [{ label: 'OK', value: 'ok', kind: 'primary' }] }).then(onClosed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.closed]);

  useEffect(() => {
    if (!room.invite) return;
    const { from, seatIndex } = room.invite;
    const live = room.snap?.kind === 'LIVE';
    showDialog({
      title: live ? 'Co-host this live?' : 'Join the stage?',
      message: live
        ? `${from.displayName} invited you to co-host their live. Join with your camera, or audio only.`
        : `${from.displayName} invited you to seat ${seatIndex + 1}. Your mic will be on.`,
      art: (
        <View>
          <Avatar id={from.userId} name={from.displayName} size={76} ring="#FFFFFF" />
          <View style={st.inviteMic}>
            <Mic size={14} color="#fff" strokeWidth={2.6} />
          </View>
        </View>
      ),
      dismissable: false,
      actions: live
        ? [
            { label: 'Join with video', value: 'video', kind: 'primary' },
            { label: 'Audio only', value: 'audio', kind: 'primary' },
            { label: 'Not now', value: 'no', kind: 'cancel' },
          ]
        : [
            { label: 'Decline', value: 'no', kind: 'cancel' },
            { label: 'Join seat', value: 'yes', kind: 'primary' },
          ],
    }).then((v) => run(() => room.answerInvite(v === 'yes' || v === 'video' || v === 'audio', { audioOnly: v === 'audio' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.invite]);

  return (
    <RoomContext.Provider value={room}>
      {children}
    </RoomContext.Provider>
  );
}

// Minimized room: just the room's picture (cover photo, or its colour tile with the first letter), draggable like the
// game bubble. Audio keeps flowing both ways; tap to go back in, or the small ✕ to leave the room.
export function MiniRoom({ onOpen, onLeave }: { onOpen: () => void; onLeave: () => void }) {
  const room = useRoomSession();
  if (!room?.snap) return null;
  const { snap } = room;
  return (
    <FloatingBubble id="room" size={56} bottom={DOCK_BOTTOM}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Return to ${snap.title}`} style={st.roomBubble}>
        {snap.coverUrl ? (
          // Covers are stored as server paths ("/v1/uploads/…"): make them full URLs, like the room screen does.
          <Image source={{ uri: roomCoverUri(snap.coverUrl)! }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Gradient colors={tintPairFor(snap.roomId)} style={[StyleSheet.absoluteFill, st.center]}>
            <Text style={st.initial}>{snap.title.slice(0, 1).toUpperCase()}</Text>
          </Gradient>
        )}
      </Pressable>
      <Pressable onPress={onLeave} accessibilityRole="button" accessibilityLabel={`Leave ${snap.title}`} hitSlop={8} style={st.leave}>
        <X size={12} color="#fff" strokeWidth={3} />
      </Pressable>
    </FloatingBubble>
  );
}

const st = StyleSheet.create({
  inviteMic: { position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderWidth: 3, borderColor: '#FFFFFF' },
  roomBubble: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: colors.surfaceHigh, elevation: 12 },
  center: { alignItems: 'center', justifyContent: 'center' },
  leave: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1d1a2e', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', elevation: 13 },
  initial: { color: '#fff', fontSize: 22, fontWeight: '900' },
});
