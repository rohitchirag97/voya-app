import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

const svgId = (raw: string) => 'g' + raw.replace(/[^a-zA-Z0-9]/g, '');

// react-native-svg ignores the alpha inside rgba(); split it into colour + opacity.
const stop = (c: string) => {
  const m =
    /^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)$/.exec(
      c,
    );
  return m
    ? { color: `rgb(${m[1]},${m[2]},${m[3]})`, opacity: Number(m[4]) }
    : { color: c, opacity: 1 };
};

// A View filled with a linear gradient (diagonal by default). Children sit on top.
export function Gradient({
  colors,
  style,
  children,
  vertical,
}: {
  colors: string[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  vertical?: boolean;
}) {
  const id = svgId(useId());
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {/* Unpadded full-size layer: "100%" inside a padded view would only cover its content box. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient
              id={id}
              x1="0"
              y1="0"
              x2={vertical ? '0' : '1'}
              y2="1"
            >
              {colors.map((c, i) => {
                const { color, opacity } = stop(c);
                return (
                  <Stop
                    key={i}
                    offset={i / Math.max(1, colors.length - 1)}
                    stopColor={color}
                    stopOpacity={opacity}
                  />
                );
              })}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}

// Room backdrops the owner can pick (the server stores the key). base = top→bottom gradient; glows = three soft colour orbs.
export const ROOM_BACKGROUNDS: { key: string; name: string; base: [string, string, string]; glows: [string, string, string] }[] = [
  { key: 'night', name: 'Night', base: ['#24104A', '#140A2E', '#09061A'], glows: ['#FF3D8B', '#8B5CF6', '#22D3EE'] },
  { key: 'sunset', name: 'Sunset', base: ['#4A1630', '#2A0F24', '#120714'], glows: ['#FF8A3D', '#FF3D8B', '#FFC94D'] },
  { key: 'ocean', name: 'Ocean', base: ['#0B2A4A', '#08182E', '#040B18'], glows: ['#22D3EE', '#3B82F6', '#14B8A6'] },
  { key: 'forest', name: 'Forest', base: ['#0F3A2A', '#0A2419', '#05120C'], glows: ['#34D399', '#A3E635', '#22D3EE'] },
  { key: 'aurora', name: 'Aurora', base: ['#14233F', '#0E1530', '#070A1A'], glows: ['#4ADE80', '#A78BFA', '#22D3EE'] },
  { key: 'rose', name: 'Rose', base: ['#4A0F2E', '#2C0A1E', '#14050E'], glows: ['#FB7185', '#F472B6', '#C084FC'] },
];
export const roomBackground = (key?: string | null) => ROOM_BACKGROUNDS.find((b) => b.key === key) ?? ROOM_BACKGROUNDS[0]!;

// The room's "night party" backdrop (or the room's chosen preset): a deep base with soft glowing colour orbs.
export function RoomBackdrop({ theme }: { theme?: string | null }) {
  const b = roomBackground(theme);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={b.base[0]} />
            <Stop offset="0.45" stopColor={b.base[1]} />
            <Stop offset="1" stopColor={b.base[2]} />
          </LinearGradient>
          <RadialGradient id="g1" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={b.glows[0]} stopOpacity="0.45" />
            <Stop offset="1" stopColor={b.glows[0]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="g2" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={b.glows[1]} stopOpacity="0.55" />
            <Stop offset="1" stopColor={b.glows[1]} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="g3" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={b.glows[2]} stopOpacity="0.25" />
            <Stop offset="1" stopColor={b.glows[2]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="800" fill="url(#base)" />
        <Circle cx="360" cy="40" r="230" fill="url(#g1)" />
        <Circle cx="10" cy="300" r="260" fill="url(#g2)" />
        <Circle cx="330" cy="640" r="240" fill="url(#g3)" />
        <Circle cx="80" cy="760" r="180" fill="url(#g1)" opacity="0.6" />
      </Svg>
    </View>
  );
}

// Light app screens: soft white base with faint pastel glows, so pages feel bright but not flat.
export function LightBackdrop() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="lpink" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#FF3D8B" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#FF3D8B" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="lviolet" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#8B5CF6" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="lcyan" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#22D3EE" stopOpacity="0.12" />
            <Stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="400" height="800" fill="#F7F6FC" />
        <Circle cx="380" cy="20" r="220" fill="url(#lpink)" />
        <Circle cx="0" cy="260" r="240" fill="url(#lviolet)" />
        <Circle cx="360" cy="700" r="230" fill="url(#lcyan)" />
      </Svg>
    </View>
  );
}
