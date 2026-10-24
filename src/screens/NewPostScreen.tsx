import { ChevronLeft, ImagePlus, Send, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createVideoThumbnail, Video as Compressor } from 'react-native-compressor';
import { launchImageLibrary } from 'react-native-image-picker';
import Video from 'react-native-video';
import { createPost, errorText } from '../api';
import { mediaRatio } from '../components/PostMedia';
import { Button, Screen, s, toast } from '../components/ui';
import { useNav } from '../nav';
import { colors, radius, space } from '../theme';

const MAX_VIDEO_SECONDS = 60;
const fileUri = (path: string) => (path.startsWith('file://') || path.startsWith('content://') ? path : `file://${path}`);

type Media = { kind: 'IMAGE' | 'VIDEO'; uri: string; type: string; width: number; height: number };

// Write something, and optionally add one photo or one video (up to 60s). Text alone is a text post.
export function NewPostScreen() {
  const nav = useNav();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<Media | null>(null);
  const [status, setStatus] = useState<string | null>(null); // e.g. "Compressing 40%" while busy

  async function pick() {
    const r = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 1, maxWidth: 1440, maxHeight: 1440, quality: 0.8, videoQuality: 'high' });
    if (r.errorMessage) return toast(r.errorMessage);
    const a = r.assets?.[0];
    if (!a?.uri) return;
    const isVideo = a.type?.startsWith('video/') ?? false;
    if (isVideo && a.duration && a.duration > MAX_VIDEO_SECONDS + 0.5) return toast(`Videos can be up to ${MAX_VIDEO_SECONDS} seconds`);
    if (isVideo) setMedia({ kind: 'VIDEO', uri: a.uri, type: a.type ?? 'video/mp4', width: a.width ?? 0, height: a.height ?? 0 });
    else setMedia({ kind: 'IMAGE', uri: a.uri, type: a.type ?? 'image/jpeg', width: a.width ?? 1, height: a.height ?? 1 });
  }

  async function share() {
    const caption = text.trim();
    if (!media && !caption) return;
    try {
      if (!media) {
        setStatus('Posting...');
        await createPost({ caption });
      } else if (media.kind === 'IMAGE') {
        setStatus('Uploading...');
        await createPost({ caption, file: { uri: media.uri, type: media.type, name: 'photo.jpg' }, width: media.width, height: media.height });
      } else {
        // Shrink the video on the phone first, then grab a poster frame (which also gives the true, rotated size).
        setStatus('Compressing 0%');
        const small = fileUri(await Compressor.compress(media.uri, { compressionMethod: 'auto' }, (p) => setStatus(`Compressing ${Math.round(p * 100)}%`)));
        const thumb = await createVideoThumbnail(small);
        setStatus('Uploading...');
        await createPost({
          caption,
          file: { uri: small, type: 'video/mp4', name: 'video.mp4' },
          thumb: { uri: fileUri(thumb.path), type: thumb.mime || 'image/jpeg', name: 'poster.jpg' },
          width: thumb.width || media.width || 1080,
          height: thumb.height || media.height || 1920,
        });
      }
      toast('Posted');
      nav.back();
    } catch (e) {
      toast(errorText(e));
      setStatus(null);
    }
  }

  const canShare = !!media || text.trim().length > 0;
  return (
    <Screen backdrop>
      <View style={st.head}>
        <Pressable onPress={nav.back} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={st.headLeft}>
          <ChevronLeft size={26} color={colors.text} />
          <Text style={s.h2}>New post</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={media ? 'Write a caption...' : "What's on your mind?"}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          style={[st.input, !media && st.inputBig]}
          accessibilityLabel={media ? 'Caption' : 'Post text'}
        />

        {media ? (
          <View style={st.preview}>
            {media.kind === 'IMAGE' ? (
              <Image source={{ uri: media.uri }} style={[st.previewMedia, { aspectRatio: mediaRatio(media.width, media.height) }]} resizeMode="contain" />
            ) : (
              <Video
                source={{ uri: media.uri }}
                style={[st.previewMedia, { aspectRatio: mediaRatio(media.width, media.height) || 9 / 16, backgroundColor: '#000' }]}
                resizeMode="contain"
                repeat
                muted
              />
            )}
            <Pressable onPress={() => setMedia(null)} accessibilityRole="button" accessibilityLabel="Remove" hitSlop={8} style={st.remove}>
              <X size={18} color="#fff" strokeWidth={2.6} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="Add a photo or video" style={({ pressed }) => [st.add, pressed && { opacity: 0.8 }]}>
            <View style={st.addIcon}>
              <ImagePlus size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.addTitle}>Add a photo or video</Text>
              <Text style={s.muted}>Optional. Videos up to {MAX_VIDEO_SECONDS} seconds.</Text>
            </View>
          </Pressable>
        )}

        <Button title={status ?? 'Share'} icon={status ? undefined : <Send size={18} color="#fff" />} onPress={share} loading={false} disabled={!canShare || !!status} />
      </ScrollView>
    </Screen>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(4), paddingVertical: space(3) },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
  body: { padding: space(4), gap: space(4), paddingBottom: 140 },
  input: {
    minHeight: 80,
    textAlignVertical: 'top',
    padding: space(4),
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  inputBig: { minHeight: 160, fontSize: 19, lineHeight: 27 },
  preview: { borderRadius: radius.lg, overflow: 'hidden' },
  previewMedia: { width: '100%', backgroundColor: colors.surfaceHigh },
  remove: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  add: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
  addIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDim },
  addTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
