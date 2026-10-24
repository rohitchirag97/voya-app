// App screens: bright and light. The room keeps its night-party palette (roomColors).
export const colors = {
  bg: '#F7F6FC',
  surface: '#FFFFFF',
  surfaceHigh: '#F0EDFA',
  border: '#E7E3F3',
  primary: '#FF3D8B',
  primaryDim: '#FF3D8B22',
  accent: '#7C3AED',
  gold: '#E8920C',
  text: '#17132E',
  muted: '#77708F',
  success: '#10B981',
  danger: '#EF4444',
  overlay: '#17132E66',
  glass: '#FFFFFF',
  glassStrong: '#F3F0FB',
  glassBorder: '#E7E3F3',
  shade: 'rgba(255,255,255,0.9)',
};
export type Palette = typeof colors;

export const roomColors: Palette = {
  bg: '#0A0716',
  surface: '#16112B',
  surfaceHigh: '#221A3F',
  border: '#2E2552',
  primary: '#FF3D8B',
  primaryDim: '#FF3D8B33',
  accent: '#8B5CF6',
  gold: '#FFC94D',
  text: '#FFFFFF',
  muted: '#A59CC9',
  success: '#34E0A1',
  danger: '#FF4D5E',
  overlay: '#000000B3',
  // Frosted-glass panels over the room backdrop.
  glass: 'rgba(255,255,255,0.07)',
  glassStrong: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.14)',
  shade: 'rgba(8,5,20,0.55)',
};

export const gradients = {
  primary: ['#FF3D8B', '#8B5CF6'],
  gold: ['#FFE38A', '#F5A623'],
  violet: ['#8B5CF6', '#4F46E5'],
  danger: ['#FF6B6B', '#E11D48'],
};

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };
export const space = (n: number) => n * 4;

// Stable per-id tints for avatars and room covers (pairs give each one a two-tone gradient).
const tints = ['#8B5CF6', '#FF3D8B', '#06B6D4', '#F97316', '#10B981', '#D946EF', '#3B82F6', '#F43F5E'];
const hash = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
};
export const tintFor = (id: string) => tints[hash(id) % tints.length];
export const tintPairFor = (id: string): [string, string] => {
  const h = hash(id);
  return [tints[h % tints.length], tints[(h + 3) % tints.length]];
};

