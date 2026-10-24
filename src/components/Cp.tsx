import { Check, Clock, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { answerCp, endCp, errorText, getCpOptions, proposeCp, type CpLabel, type CpOptions, type CpProposal, type CpType, type Relationship } from '../api';
import { useNav } from '../nav';
import { radius, space } from '../theme';
import { confirmDialog } from './Dialog';
import { Avatar, Button, Sheet, toast, usePalette } from './ui';

// One look per relationship, used on profiles, the room card and DM cards.
export const CP_LOOK: Record<CpType, { emoji: string; name: string; tint: string }> = {
  LOVE: { emoji: '💍', name: 'Love', tint: '#FF4F8B' },
  BESTIE: { emoji: '🤝', name: 'Best friends', tint: '#F5A524' },
  SIBLING: { emoji: '👫', name: 'Brother & Sister', tint: '#4FA8FF' },
};
export const cpName = (type: CpType, label: CpLabel | null) =>
  type === 'LOVE' ? 'Love CP' : type === 'BESTIE' ? 'Best friend' : label === 'SISTER' ? 'Sister' : 'Brother';

let optionsCache: CpOptions | null = null;
function useCpOptions() {
  const [o, setO] = useState(optionsCache);
  useEffect(() => {
    if (!optionsCache) getCpOptions().then((r) => setO((optionsCache = r)), () => {});
  }, []);
  return o;
}

// Relationship slots on a profile. Your own filled slots can be ended; others' open that person's profile.
export function CpSection({ relationships, isMe, onPropose, onEnded }: {
  relationships: Relationship[];
  isMe: boolean;
  onPropose?: () => void; // someone else's profile, when you two aren't paired yet
  onEnded?: (pairId: string) => void;
}) {
  const c = usePalette();
  const nav = useNav();
  const o = useCpOptions();

  async function tap(r: Relationship) {
    if (!isMe) return nav.push({ name: 'user', userId: r.user.userId });
    const ok = await confirmDialog({
      title: `End ${cpName(r.type, r.label)} with ${r.user.displayName}?`,
      message: r.type === 'LOVE' ? "You both can't start a new Love CP for 7 days." : 'You can pair again any time.',
      confirmText: 'End',
      danger: true,
    });
    if (!ok) return;
    try {
      await endCp(r.pairId);
      onEnded?.(r.pairId);
    } catch (e) {
      toast(errorText(e));
    }
  }

  return (
    <View style={[st.section, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={st.head}>
        <Text style={[st.title, { color: c.text }]}>CP</Text>
        {onPropose ? (
          <Pressable onPress={onPropose} accessibilityRole="button" style={[st.propose, { backgroundColor: c.primary }]}>
            <Text style={st.proposeText}>Send CP request</Text>
          </Pressable>
        ) : null}
      </View>
      {(Object.keys(CP_LOOK) as CpType[]).map((type) => {
        const mine = relationships.filter((r) => r.type === type);
        const max = o?.types[type].max ?? { LOVE: 1, BESTIE: 4, SIBLING: 7 }[type];
        return (
          <View key={type} style={st.row}>
            <Text style={[st.rowName, { color: c.muted }]}>
              {CP_LOOK[type].emoji} {CP_LOOK[type].name} <Text style={st.count}>{mine.length}/{max}</Text>
            </Text>
            <View style={st.slots}>
              {mine.map((r) => (
                <Pressable
                  key={r.pairId}
                  onPress={() => tap(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`${cpName(r.type, r.label)}: ${r.user.displayName}${isMe ? '. Double tap to end' : ''}`}
                  style={st.slot}>
                  <View style={[st.ring, { borderColor: CP_LOOK[type].tint }]}>
                    <Avatar id={r.user.userId} name={r.user.displayName} uri={r.user.avatarUrl} size={40} />
                  </View>
                  <Text style={[st.slotName, { color: c.text }]} numberOfLines={1}>{r.user.displayName}</Text>
                  <Text style={[st.slotSub, { color: CP_LOOK[type].tint }]}>{type === 'SIBLING' ? cpName(type, r.label) : `${daysSince(r.since)}d`}</Text>
                </Pressable>
              ))}
              {mine.length < max ? (
                <View style={st.slot} accessibilityElementsHidden importantForAccessibility="no">
                  <View style={[st.empty, { borderColor: c.border }]} />
                  <Text style={[st.slotSub, { color: c.muted }]}>{max - mine.length} open</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const daysSince = (iso: string) => Math.max(1, Math.ceil((Date.now() - new Date(iso).getTime()) / 86_400_000));

// Pick a relationship and send the request; the coins come back if it's declined or not answered in 48 hours.
export function ProposeCpSheet({ visible, onClose, to }: { visible: boolean; onClose: () => void; to: { userId: string; displayName: string | null } }) {
  const c = usePalette();
  const o = useCpOptions();
  const [type, setType] = useState<CpType>('LOVE');
  const [label, setLabel] = useState<CpLabel>('BROTHER');
  const [busy, setBusy] = useState(false);
  const choices: { type: CpType; label?: CpLabel; title: string }[] = [
    { type: 'LOVE', title: 'Love' },
    { type: 'BESTIE', title: 'Best friend' },
    { type: 'SIBLING', label: 'BROTHER', title: 'Brother' },
    { type: 'SIBLING', label: 'SISTER', title: 'Sister' },
  ];

  async function send() {
    setBusy(true);
    try {
      await proposeCp(to.userId, type, type === 'SIBLING' ? label : undefined);
      toast(`Request sent to ${to.displayName}`);
      onClose();
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const price = o?.types[type].price;
  return (
    <Sheet visible={visible} onClose={onClose} title={`CP with ${to.displayName ?? 'them'}`}>
      <View style={st.choices} accessibilityRole="radiogroup">
        {choices.map((ch) => {
          const on = ch.type === type && (ch.type !== 'SIBLING' || ch.label === label);
          const look = CP_LOOK[ch.type];
          return (
            <Pressable
              key={ch.title}
              onPress={() => {
                setType(ch.type);
                if (ch.label) setLabel(ch.label);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[st.choice, { borderColor: on ? look.tint : c.border, backgroundColor: on ? look.tint + '1F' : 'transparent' }]}>
              <Text style={st.choiceEmoji}>{ch.label === 'SISTER' ? '👭' : ch.label === 'BROTHER' ? '👬' : look.emoji}</Text>
              <Text style={[st.choiceTitle, { color: c.text }]}>{ch.title}</Text>
              <Text style={[st.choicePrice, { color: c.muted }]}>{o ? `${o.types[ch.type].price} coins` : ' '}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[st.note, { color: c.muted }]}>
        {type === 'LOVE' ? 'You can each have 1 Love CP. ' : type === 'BESTIE' ? 'Up to 4 best friends each. ' : 'Up to 7 brothers and sisters each. '}
        If {to.displayName ?? 'they'} declines or doesn't answer within 48 hours, you get your coins back.
      </Text>
      <Button title={price ? `Send for ${price} coins` : 'Send request'} loading={busy || !o} onPress={send} />
    </Sheet>
  );
}

// A request in DMs: the recipient accepts or declines, the sender can cancel while it's open.
export function CpRequestCard({ cp, meId, onChange }: { cp: CpProposal; meId: string; onChange: (cp: CpProposal) => void }) {
  const c = usePalette();
  const [busy, setBusy] = useState<string | null>(null);
  const look = CP_LOOK[cp.type];
  const mine = cp.fromId === meId;
  const open = cp.status === 'PENDING';

  async function act(action: 'accept' | 'decline' | 'cancel') {
    setBusy(action);
    try {
      onChange(await answerCp(cp.id, action));
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const status =
    cp.status === 'ACCEPTED' ? `You're now ${cp.type === 'LOVE' ? 'Love CP' : cp.type === 'BESTIE' ? 'best friends' : 'family'} 🎉` :
    cp.status === 'DECLINED' ? 'Declined' + (mine ? ' · coins refunded' : '') :
    cp.status === 'EXPIRED' ? 'Expired' + (mine ? ' · coins refunded' : '') :
    cp.status === 'CANCELLED' ? 'Cancelled' + (mine ? ' · coins refunded' : '') :
    mine ? `Waiting for an answer · ${hoursLeft(cp.expiresAt)}` : `Answer within ${hoursLeft(cp.expiresAt)}`;

  return (
    <View style={[st.card, { borderColor: look.tint, backgroundColor: c.surface }]}>
      <Text style={st.cardEmoji}>{look.emoji}</Text>
      <Text style={[st.cardTitle, { color: c.text }]}>{mine ? `You asked to be their ${cpName(cp.type, cp.label)}` : `Be their ${cpName(cp.type, cp.label)}?`}</Text>
      <View style={st.cardStatus}>
        {open ? <Clock size={13} color={c.muted} /> : null}
        <Text style={[st.cardStatusText, { color: open ? c.muted : look.tint }]}>{status}</Text>
      </View>
      {open ? (
        mine ? (
          <Pressable onPress={() => act('cancel')} disabled={!!busy} accessibilityRole="button" style={st.cancel}>
            {busy ? <ActivityIndicator color={c.muted} /> : <Text style={[st.cancelText, { color: c.muted }]}>Cancel request</Text>}
          </Pressable>
        ) : (
          <View style={st.cardActions}>
            <Pressable onPress={() => act('decline')} disabled={!!busy} accessibilityRole="button" style={[st.cardBtn, { borderColor: c.border }]}>
              {busy === 'decline' ? <ActivityIndicator color={c.text} /> : <><X size={16} color={c.text} /><Text style={[st.cardBtnText, { color: c.text }]}>Decline</Text></>}
            </Pressable>
            <Pressable onPress={() => act('accept')} disabled={!!busy} accessibilityRole="button" style={[st.cardBtn, { backgroundColor: look.tint, borderColor: look.tint }]}>
              {busy === 'accept' ? <ActivityIndicator color="#fff" /> : <><Check size={16} color="#fff" /><Text style={[st.cardBtnText, { color: '#fff' }]}>Accept</Text></>}
            </Pressable>
          </View>
        )
      ) : null}
    </View>
  );
}

const hoursLeft = (iso: string) => {
  const h = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return h <= 1 ? 'under an hour' : `${h} hours`;
};

const st = StyleSheet.create({
  section: { gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
  propose: { height: 32, paddingHorizontal: space(3), borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  proposeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  row: { gap: space(2) },
  rowName: { fontSize: 13, fontWeight: '700' },
  count: { fontWeight: '500' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space(3) },
  slot: { width: 56, alignItems: 'center', gap: 2 },
  ring: { borderWidth: 2, borderRadius: 24, padding: 2 },
  empty: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed' },
  slotName: { fontSize: 11, fontWeight: '600', maxWidth: 56 },
  slotSub: { fontSize: 10, fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2) },
  choice: { width: '48%', flexGrow: 1, alignItems: 'center', gap: 2, paddingVertical: space(3), borderRadius: radius.md, borderWidth: 1.5 },
  choiceEmoji: { fontSize: 26 },
  choiceTitle: { fontSize: 15, fontWeight: '800' },
  choicePrice: { fontSize: 12 },
  note: { fontSize: 13, marginVertical: space(3) },
  card: { width: 260, alignSelf: 'center', alignItems: 'center', gap: space(2), padding: space(4), borderRadius: radius.lg, borderWidth: 1.5 },
  cardEmoji: { fontSize: 34 },
  cardTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatusText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  cardActions: { flexDirection: 'row', gap: space(2), marginTop: space(1) },
  cardBtn: { flex: 1, height: 40, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
  cardBtnText: { fontWeight: '800' },
  cancel: { paddingVertical: space(1) },
  cancelText: { fontWeight: '700', fontSize: 13 },
});
