import { Crown, Gem, Lock, MicOff, Plus, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { Seat } from '../api';
import { FramedAvatar } from '../components/Decor';
import { OfficialMark } from '../components/Official';
import { Avatar } from '../components/ui';
import { roomColors as colors, radius, space } from '../theme';
import { useCatalog } from './catalog';

type Props = {
  rowLayout: number[];
  seats: Seat[];
  meId: string;
  hostUserId: string;
  admins: string[];
  levels: Record<string, number>;
  pendingSeat: number | null;
  charisma?: Record<string, number> | null; // set while the charisma counter is on: coins received per userId
  onPress: (seat: Seat) => void;
};

// Renders exactly the server's rowLayout (8=4+4, 10=5+5, 12=4+4+4, 16=4x4, 20=4x5), row-major.
export function SeatGrid({ rowLayout, seats, meId, hostUserId, admins, levels, pendingSeat, charisma, onPress }: Props) {
  const { width } = useWindowDimensions();
  const maxCols = Math.max(...rowLayout);
  const cell = (width - space(4) * 2) / maxCols;
  const avatar = Math.min(rowLayout.length > 3 ? 54 : 62, cell * 0.62);
  const catalog = useCatalog();
  let start = 0;

  return (
    <View style={{ paddingHorizontal: space(4), gap: rowLayout.length > 3 ? space(1) : space(3) }}>
      {rowLayout.map((cols, r) => {
        const row = seats.slice(start, (start += cols));
        return (
          <View key={r} style={st.row} testID={`seat-row-${r}`}>
            {row.map((seat) => (
              <SeatTile
                key={seat.seatIndex}
                seat={seat}
                width={cell}
                avatar={avatar}
                isMe={seat.occupant?.userId === meId}
                owner={seat.occupant?.userId === hostUserId}
                admin={!!seat.occupant && admins.includes(seat.occupant.userId)}
                speaking={!!seat.streamId && (levels[seat.streamId] ?? 0) > 8 && !seat.micMuted && !seat.modMuted}
                pending={pendingSeat === seat.seatIndex}
                charisma={charisma && seat.occupant ? charisma[seat.occupant.userId] ?? 0 : undefined}
                frameSvg={seat.occupant?.frameId ? catalog.frames[seat.occupant.frameId]?.svg : undefined}
                onPress={() => onPress(seat)}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// Two soft rings that pulse outward while someone talks.
function Ripple({ size, color }: { size: number; color: string }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const ring = (offset: number) => {
    const t = Animated.modulo(Animated.add(a, offset), 1);
    return (
      <Animated.View
        style={[
          st.ripple,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
          },
        ]}
      />
    );
  };
  return (
    <>
      {ring(0)}
      {ring(0.5)}
    </>
  );
}

function SeatTile({ seat, width, avatar, isMe, owner, admin, speaking, pending, charisma, frameSvg, onPress }: {
  seat: Seat;
  width: number;
  avatar: number;
  isMe: boolean;
  owner: boolean;
  admin: boolean;
  speaking: boolean;
  pending: boolean;
  charisma: number | undefined; // undefined = counter off or empty seat
  frameSvg?: string; // the occupant's avatar frame (drawn bigger than the seat, like a crown around it)
  onPress: () => void;
}) {
  const o = seat.occupant;
  const ownerSeat = seat.seatIndex === 0; // only the owner and admins can sit here
  const away = o?.presence === 'DISCONNECTED';
  const muted = seat.micMuted || seat.modMuted;
  const ring = owner ? colors.gold : admin ? colors.accent : isMe ? colors.primary : 'rgba(255,255,255,0.35)';
  const label = o
    ? `${owner ? 'Owner ' : admin ? 'Admin ' : ''}${o.displayName}${seat.modMuted ? ', muted by admin' : ''}${seat.micMuted ? ', self-muted' : ''}${away ? ', reconnecting' : ''}`
    : ownerSeat
      ? 'Empty owner seat'
      : `${seat.locked ? 'Locked' : 'Empty'} seat ${seat.seatIndex + 1}`;
  const icon = Math.round(avatar * 0.36);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [st.tile, { width }, pressed && { opacity: 0.8 }]}>
      <View style={{ width: avatar + 10, height: avatar + 10, alignItems: 'center', justifyContent: 'center' }}>
        {o && speaking ? <Ripple size={avatar} color={owner ? colors.gold : colors.success} /> : null}
        {o ? (
          <View style={[st.avatarWrap, { opacity: away ? 0.4 : 1 }, owner && st.ownerGlow]}>
            {frameSvg ? (
              <FramedAvatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={avatar} frameSvg={frameSvg} />
            ) : (
              <Avatar id={o.userId} name={o.displayName} uri={o.avatarUrl} size={avatar} ring={speaking ? colors.success : ring} />
            )}
          </View>
        ) : (
          <View
            style={[
              st.empty,
              { width: avatar, height: avatar, borderRadius: avatar / 2 },
              ownerSeat && { borderColor: colors.gold + '88', backgroundColor: colors.gold + '14' },
              seat.locked && st.locked,
            ]}>
            {pending ? (
              <ActivityIndicator color={colors.primary} />
            ) : ownerSeat ? (
              <Crown size={icon} color={colors.gold} strokeWidth={2} />
            ) : seat.locked ? (
              <Lock size={icon * 0.85} color={colors.muted} strokeWidth={2.2} />
            ) : (
              <Plus size={icon} color="rgba(255,255,255,0.8)" strokeWidth={2.6} />
            )}
          </View>
        )}
        {owner ? (
          <View style={st.crown}>
            <Crown size={16} color={colors.gold} fill={colors.gold} strokeWidth={1.5} />
          </View>
        ) : null}
        {admin && !owner ? (
          <View style={st.shield}>
            <ShieldCheck size={12} color="#fff" strokeWidth={2.5} />
          </View>
        ) : null}
        {o && muted ? (
          <View style={[st.mute, seat.modMuted && { backgroundColor: colors.danger }]}>
            <MicOff size={10} color="#fff" strokeWidth={2.6} />
          </View>
        ) : null}
      </View>
      {o ? (
        <View style={[st.namePill, owner && st.namePillOwner]}>
          {ownerSeat ? null : <Text style={[st.seatNo, { backgroundColor: SEAT_NO_COLORS[seat.seatIndex % SEAT_NO_COLORS.length] }]}>{seat.seatIndex + 1}</Text>}
          <Text numberOfLines={1} style={[st.name, owner && { color: colors.gold }]}>
            {away ? 'reconnecting…' : o.displayName}
          </Text>
          {away ? null : <OfficialMark role={o.staffRole} size={11} still />}
        </View>
      ) : (
        <Text style={[st.index, ownerSeat && { color: colors.gold }]}>{ownerSeat ? 'OWNER' : `NO.${seat.seatIndex + 1}`}</Text>
      )}
      {charisma !== undefined ? (
        <View style={st.charisma} accessibilityLabel={`Charisma ${charisma}`}>
          <Gem size={10} color="#FF8AC6" strokeWidth={2.6} />
          <Text style={st.charismaText}>{short(charisma)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Seat-number chips in front of names.
const SEAT_NO_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4'];

// 950 · 1.2K · 3.4M
const short = (n: number) => (n >= 1e6 ? +(n / 1e6).toFixed(1) + 'M' : n >= 1000 ? +(n / 1000).toFixed(1) + 'K' : String(n));

const st = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  tile: { alignItems: 'center', paddingVertical: space(1), gap: 3 },
  avatarWrap: { borderRadius: 999 },
  ownerGlow: { shadowColor: colors.gold, shadowOpacity: 0.9, shadowRadius: 12, elevation: 10 },
  ripple: { position: 'absolute', borderWidth: 2 },
  empty: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locked: { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)' },
  seatNo: { minWidth: 15, height: 15, borderRadius: 8, overflow: 'hidden', textAlign: 'center', color: '#fff', fontSize: 10, fontWeight: '900', lineHeight: 15, paddingHorizontal: 3 },
  crown: { position: 'absolute', top: -8 },
  shield: { position: 'absolute', top: 0, left: 0, backgroundColor: colors.accent, borderRadius: 10, padding: 3 },
  mute: { position: 'absolute', bottom: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  namePill: { maxWidth: '96%', flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.35)' },
  namePillOwner: { backgroundColor: 'rgba(255,201,77,0.16)' },
  name: { flexShrink: 1, color: colors.text, fontSize: 11, fontWeight: '700' },
  index: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  charisma: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: 'rgba(255,95,174,0.16)', borderWidth: 1, borderColor: 'rgba(255,138,198,0.35)' },
  charismaText: { color: '#FFB3DA', fontSize: 10.5, fontWeight: '800' },
});
