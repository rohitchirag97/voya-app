import { Play, Volume2, VolumeX } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Video from 'react-native-video';
import { imageUri, type Post } from '../api';
import { colors, tintPairFor } from '../theme';
import { Gradient } from './Gradient';

// Shown at the original shape; only extreme sizes are fitted (letterboxed), never cropped.
const MIN_RATIO = 9 / 16; // tall phone video
const MAX_RATIO = 1.91; // wide landscape
export const mediaRatio = (w: number | null, h: number | null) => (w && h ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, w / h)) : 1);

// Text posts this short get the big gradient card; longer ones read better as plain text.
export const isShortText = (text: string) => text.length <= 160;

// Photo or video of a post at full width. Videos play only while `active` (on screen), muted until tapped.
export function PostMedia({ post, active }: { post: Post; active: boolean }) {
  const [muted, setMuted] = useState(true);
  const aspectRatio = mediaRatio(post.width, post.height);
  if (post.kind === 'TEXT') return <TextArt post={post} />;
  if (post.kind === 'IMAGE' && post.imageUrl)
    return (
      <Image
        source={{ uri: imageUri(post.imageUrl) }}
        style={[st.media, { aspectRatio }]}
        resizeMode="contain"
        accessibilityLabel={post.caption || `Photo by ${post.author.displayName}`}
      />
    );
  if (!post.videoUrl) return null;
  return (
    <Pressable onPress={() => setMuted((m) => !m)} accessibilityRole="button" accessibilityLabel={muted ? 'Turn sound on' : 'Mute'} style={[st.media, st.video, { aspectRatio }]}>
      <Video
        source={{ uri: imageUri(post.videoUrl) }}
        poster={post.imageUrl ? { source: { uri: imageUri(post.imageUrl) }, resizeMode: 'contain' } : undefined}
        paused={!active}
        muted={muted}
        repeat
        resizeMode="contain"
        playInBackground={false}
        style={StyleSheet.absoluteFill}
      />
      {!active ? (
        <View style={st.playBadge} pointerEvents="none">
          <Play size={30} color="#fff" fill="#fff" />
        </View>
      ) : null}
      <View style={st.sound} pointerEvents="none">
        {muted ? <VolumeX size={16} color="#fff" /> : <Volume2 size={16} color="#fff" />}
      </View>
    </Pressable>
  );
}

// Short text post: big bold words on a colourful card.
function TextArt({ post }: { post: Post }) {
  if (!isShortText(post.caption)) return null; // long text is shown as plain text by the card
  return (
    <Gradient colors={tintPairFor(post.postId)} style={st.textArt}>
      <Text style={[st.textArtText, post.caption.length > 80 && { fontSize: 20, lineHeight: 28 }]}>{post.caption}</Text>
    </Gradient>
  );
}

// Square tile for profile grids (grids are square on purpose; the full post opens uncropped).
export function PostTile({ post, size }: { post: Post; size: number }) {
  if (post.kind === 'TEXT')
    return (
      <Gradient colors={tintPairFor(post.postId)} style={[st.tileText, { width: size, height: size }]}>
        <Text style={st.tileTextText} numberOfLines={5}>
          {post.caption}
        </Text>
      </Gradient>
    );
  return (
    <View>
      <Image source={{ uri: imageUri(post.imageUrl ?? '') }} style={{ width: size, height: size, backgroundColor: colors.surfaceHigh }} />
      {post.kind === 'VIDEO' ? (
        <View style={st.tilePlay} pointerEvents="none">
          <Play size={14} color="#fff" fill="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  media: { width: '100%', backgroundColor: colors.surfaceHigh },
  video: { backgroundColor: '#000', overflow: 'hidden' },
  playBadge: { position: 'absolute', alignSelf: 'center', top: '42%', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  sound: { position: 'absolute', right: 10, bottom: 10, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  textArt: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  textArtText: { color: '#fff', fontSize: 26, lineHeight: 34, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 6 },
  tileText: { padding: 8, justifyContent: 'center' },
  tileTextText: { color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' },
  tilePlay: { position: 'absolute', right: 6, top: 6 },
});
