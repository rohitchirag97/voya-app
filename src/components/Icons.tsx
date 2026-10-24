import { Coffee, Crown, Flower2, Gift, Handshake, Mic, ShieldCheck, Star, User, UserCheck, UserPlus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { UserProfile } from '../api';
import { roomColors as colors, radius } from '../theme';

// Gift artwork: the catalog SVG when there is one, otherwise a coloured icon per gift.
const giftIcons: Record<string, { Icon: typeof Gift; color: string }> = {
  rose: { Icon: Flower2, color: '#FF4D7A' },
  chai: { Icon: Coffee, color: '#D9A066' },
  star: { Icon: Star, color: colors.gold },
  crown: { Icon: Crown, color: colors.gold },
};
export function GiftArt({ gift, size }: { gift: { id: string; svg?: string | null }; size: number }) {
  if (gift.svg) return <SvgXml xml={gift.svg} width={size} height={size} />;
  const { Icon, color } = giftIcons[gift.id] ?? { Icon: Gift, color: colors.primary };
  return <Icon size={size * 0.85} color={color} fill={color + '55'} strokeWidth={1.8} />;
}

// Role in a room: Owner / Admin / On stage / Listener, as a small tag with an icon.
export type Role = 'owner' | 'admin' | 'stage' | 'listener';
export const roleOf = (userId: string | null | undefined, room: { hostUserId: string; admins: string[]; seated: boolean }): Role =>
  userId === room.hostUserId ? 'owner' : userId && room.admins.includes(userId) ? 'admin' : room.seated ? 'stage' : 'listener';

const roles: Record<Role, { label: string; Icon: typeof Gift; color: string; bg: string }> = {
  owner: { label: 'Owner', Icon: Crown, color: colors.gold, bg: 'rgba(255,201,77,0.16)' },
  admin: { label: 'Admin', Icon: ShieldCheck, color: '#C9B6FF', bg: 'rgba(139,92,246,0.22)' },
  stage: { label: 'On stage', Icon: Mic, color: colors.success, bg: 'rgba(52,224,161,0.14)' },
  listener: { label: 'Listener', Icon: User, color: colors.muted, bg: 'rgba(255,255,255,0.08)' },
};
export function RoleTag({ role }: { role: Role }) {
  const r = roles[role];
  return (
    <View style={[st.tag, { backgroundColor: r.bg }]}>
      <r.Icon size={12} color={r.color} strokeWidth={2.4} />
      <Text style={[st.tagText, { color: r.color }]}>{r.label}</Text>
    </View>
  );
}

// Icon that matches the follow button's label (Follow / Follow back / Following / Friends).
export function FollowIcon({ p, color = '#fff' }: { p: UserProfile; color?: string }) {
  const Icon = p.isFollowing && p.followsMe ? Handshake : p.isFollowing ? UserCheck : UserPlus;
  return <Icon size={18} color={color} strokeWidth={2.4} />;
}

const st = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { fontSize: 12, fontWeight: '800' },
});
