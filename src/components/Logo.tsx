import React from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// The VoyaLive icon: a cheering figure whose raised arms form the V, head as the "live" dot, arcs as its voice.
// Same artwork as assets/brand/voyalive-icon.svg (the launcher icons are rendered from that file).
export function LogoMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 108 108" accessibilityLabel="VoyaLive">
      <Defs>
        <LinearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF4F8F" />
          <Stop offset="0.55" stopColor="#D046D8" />
          <Stop offset="1" stopColor="#7C3AED" />
        </LinearGradient>
        <RadialGradient id="logoGlow" cx="0.3" cy="0.2" r="0.8">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect width="108" height="108" rx="24" fill="url(#logoBg)" />
      <Rect width="108" height="108" rx="24" fill="url(#logoGlow)" />
      <Path d="M33 41 L54 76 L75 41" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="54" cy="38" r="8" fill="#fff" />
      <Path d="M24 30 A20 20 0 0 0 24 52" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="4.5" strokeLinecap="round" />
      <Path d="M84 30 A20 20 0 0 1 84 52" fill="none" stroke="#fff" strokeOpacity="0.75" strokeWidth="4.5" strokeLinecap="round" />
    </Svg>
  );
}
