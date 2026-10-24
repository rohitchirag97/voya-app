import { ChevronLeft, Video } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorText, startLive } from '../api';
import { Gradient } from '../components/Gradient';
import { Button, Field, Screen, toast } from '../components/ui';
import { useNav } from '../nav';
import { ensureCameraPermission, ensureMicPermission } from '../services/ZegoAudioRoomService';
import { colors, radius, space } from '../theme';

// Name your stream and start. Camera and mic permissions are asked first, so the stream starts with video.
export function GoLiveScreen() {
  const nav = useNav();
  const [title, setTitle] = useState(`${nav.me?.displayName ?? 'My'}'s live`);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!(await ensureCameraPermission()) || !(await ensureMicPermission())) return toast('Camera and microphone are needed to go live');
    setBusy(true);
    try {
      const created = await startLive(title.trim());
      nav.back();
      nav.openRoom(created.room.roomId, created);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen backdrop>
      <View style={st.top}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={st.title}>Go live</Text>
      </View>
      <View style={st.body}>
        <Gradient colors={['#FF3D5A', '#FF7A45']} style={st.icon}>
          <Video size={36} color="#fff" strokeWidth={2.2} />
        </Gradient>
        <Text style={st.lead}>Stream live with your camera. Invite up to 3 co-hosts, and challenge other streamers to PK battles.</Text>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={60} placeholder="What's your live about?" />
        <Button title="Start live" onPress={go} loading={busy} disabled={!title.trim()} />
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space(2), paddingHorizontal: space(3), paddingVertical: space(3) },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  body: { padding: space(6), gap: space(5) },
  icon: { width: 80, height: 80, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  lead: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
