import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Pk } from '../api';
import { space } from '../theme';
import { PkCard } from './Pk';

// Floating on the right of the room while a PK battle is running.
export function RoomWidgets({ pk, onGift, onUserPress }: {
  pk: Pk | null;
  onGift: (userId: string) => void;
  onUserPress: (userId: string) => void;
}) {
  if (!pk) return null;
  return (
    <View style={st.wrap} pointerEvents="box-none">
      <PkCard pk={pk} onGift={onGift} onUserPress={onUserPress} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', right: space(2), bottom: 76 },
});
