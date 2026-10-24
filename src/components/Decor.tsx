import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Avatar } from './ui';

// Frames are drawn on a 200×200 box with the picture in the centre circle (70% of the box).
export const FRAME_SCALE = 1 / 0.7;

// Profile picture, wrapped in an equipped frame when there is one. `size` is the picture's size.
export function FramedAvatar({ id, name, size, frameSvg, uri }: { id: string; name: string | null; size: number; frameSvg?: string | null; uri?: string | null }) {
  if (!frameSvg) return <Avatar id={id} name={name} size={size} uri={uri} />;
  const box = Math.round(size * FRAME_SCALE);
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
      <Avatar id={id} name={name} size={size} uri={uri} />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SvgXml xml={frameSvg} width={box} height={box} />
      </View>
    </View>
  );
}

// Card decoration artwork, filling a banner area (it scales to cover, like a background image).
export function DecorBanner({ svg, height }: { svg: string; height: number }) {
  return <SvgXml xml={svg} width="100%" height={height} preserveAspectRatio="xMidYMid slice" />;
}
