import { BadgeCheck } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';
import type { StaffRole } from '../api';
import { showDialog } from './Dialog';

// Reserved for staff: no badge, frame, bubble or other icon may use these ticks (room admins have the shield), so they can't be copied.
// Blue = staff, gold = the app owner only.
const OFFICIAL_BLUE = '#1D9BF0';
const OWNER_GOLD = '#F5B301';
export const tickColor = (role?: StaffRole | null) => (role === 'OWNER' ? OWNER_GOLD : OFFICIAL_BLUE);
const ROLE_LABEL: Record<StaffRole, string> = { SUPPORT: 'Support', MODERATOR: 'Moderator', ADMIN: 'Admin', OWNER: 'Owner' };

const explain = (role: StaffRole) =>
  showDialog({
    title: `Official VoyaLive ${ROLE_LABEL[role]}`,
    message:
      (role === 'OWNER'
        ? 'The owner of VoyaLive. Only the app owner shows this gold tick next to their name.'
        : 'Verified VoyaLive staff. Only staff accounts show this blue tick next to their name.') +
      '\n\nStaff will never ask for your OTP or password, or ask you to pay or send coins outside the app.',
    Icon: BadgeCheck,
    actions: [{ label: 'Got it', value: 'ok', kind: 'primary' }],
  });

// Next to a staff member's name. `still`: not tappable (inside another touch target, like a seat).
export function OfficialMark({ role, size = 16, still }: { role?: StaffRole | null; size?: number; still?: boolean }) {
  if (!role) return null;
  const icon = <BadgeCheck size={size} color="#fff" fill={tickColor(role)} strokeWidth={2.4} />;
  if (still) return icon;
  return (
    <Pressable
      onPress={() => explain(role)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`Official VoyaLive ${ROLE_LABEL[role]}. Tap for details`}
      style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {icon}
    </Pressable>
  );
}
