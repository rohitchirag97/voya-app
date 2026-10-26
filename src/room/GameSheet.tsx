import { Leaf, Orbit, Rocket, X } from 'lucide-react-native';
import React, { useEffect, useRef } from 'react';
import { Animated, BackHandler, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { freshAccessToken } from '../api';
import { DOCK_BOTTOM, FloatingBubble } from '../components/FloatingBubble';
import { Gradient } from '../components/Gradient';
import { API_URL } from '../config';
import type { GameKey, OpenGame } from '../nav';
import { roomColors as colors, radius, space } from '../theme';

export type { GameKey } from '../nav';

// The HTML5 games we host, all on the same wallet; each has its own rounds, history and leaderboard.
// path = the page under API_URL; thumb = one of its help screenshots; bg = the page's bottom colour, so the strip above the nav bar has no seam.
const GAMES: { key: GameKey; title: string; subtitle: string; bg: string; path: string; thumb: string; colors: string[]; Icon: typeof Leaf }[] = [
  { key: 'rocket', title: 'Rocket', subtitle: 'Cash out before it crashes', bg: '#07061a', path: '/games/rocket/', thumb: '/games/rocket/help/step-fly.webp', colors: ['#ff9a45', '#b81f3a'], Icon: Rocket },
  { key: 'jungle', title: 'Greedy Jungle', subtitle: 'Bet on animals · up to ×45', bg: '#040c08', path: '/games/greedy/?game=jungle', thumb: '/games/greedy/help/jungle/step-bet.webp', colors: ['#35a067', '#0f4a2e'], Icon: Leaf },
  { key: 'galaxy', title: 'Greedy Galaxy', subtitle: 'Bet on planets · up to ×45', bg: '#04050f', path: '/games/greedy/?game=galaxy', thumb: '/games/greedy/help/galaxy/step-bet.webp', colors: ['#6a55e8', '#1d1660'], Icon: Orbit },
];
const gameMeta = (key: GameKey) => GAMES.find((g) => g.key === key) ?? GAMES[0]!;

// One card per game (the picture is the game's own help screenshot, served with it). Used in the room's More sheet.
export function GameCards({ onPick }: { onPick: (g: GameKey) => void }) {
  return (
    <View style={st.cards}>
      {GAMES.map((g) => (
        <Pressable key={g.key} onPress={() => onPick(g.key)} accessibilityRole="button" accessibilityLabel={`${g.title}. ${g.subtitle}`} style={({ pressed }) => [st.card, pressed && st.pressed]}>
          <Image source={{ uri: API_URL + g.thumb }} style={[st.thumb, { backgroundColor: g.bg }]} resizeMode="cover" />
          <Text style={st.cardTitle}>{g.title}</Text>
          <Text style={st.cardSub}>{g.subtitle}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// The open game, at the app's root (not inside the room): it keeps running when you leave the room or change screens.
// Minimized, the WebView stays mounted but slides away and goes quiet; one tap on the bubble brings it straight back.
export function GameHost({ game, onMinimize, onRestore, onClose }: { game: OpenGame | null; onMinimize: () => void; onRestore: () => void; onClose: () => void }) {
  const web = useRef<WebView<object>>(null);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const panelH = Math.round(height * 0.65) + insets.bottom; // 65% of the screen, so the top of the room stays visible
  const y = useRef(new Animated.Value(panelH)).current;
  const minimized = !!game?.minimized;

  useEffect(() => {
    if (!game) {
      y.setValue(panelH);
      return;
    }
    Animated.timing(y, { toValue: minimized ? panelH + 24 : 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // The page pauses its music while minimized (it would talk over the room) and resumes when shown again.
    web.current?.injectJavaScript(`window.voyaVisibility && window.voyaVisibility(${!minimized}); true;`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.key, minimized, panelH]);

  // Android back minimizes an open game (registered after the app's own handler, so it runs first).
  useEffect(() => {
    if (!game || minimized) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onMinimize();
      return true;
    });
    return () => sub.remove();
  }, [game, minimized, onMinimize]);

  // The page asks for a token on every socket (re)connect, and sends 'minimize' / 'close' from its header. Only our own pages are heard.
  async function onMessage(e: WebViewMessageEvent) {
    // Android reports only the origin here ("http://host:port"), iOS the full URL; accept both, from our server only.
    const url = e.nativeEvent.url;
    if (url !== API_URL && !url.startsWith(API_URL + '/')) return;
    let msg: { type?: string } | null = null;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {}
    if (msg?.type === 'close') return onClose();
    if (msg?.type === 'minimize') return onMinimize();
    if (msg?.type !== 'token') return;
    const token = await freshAccessToken();
    web.current?.injectJavaScript(`window.voyaToken(${JSON.stringify(token)}); true;`);
  }

  if (!game) return null;
  const meta = gameMeta(game.key);
  return (
    // A real layer above the whole room: Android stacks by elevation, and room extras (CP links, emotes, the gift
    // combo) carry their own; collapsable={false} keeps this view from being flattened away.
    <View style={[StyleSheet.absoluteFill, st.layer]} pointerEvents="box-none" collapsable={false}>
      {minimized ? null : <Pressable style={st.backdrop} onPress={onMinimize} accessibilityLabel="Minimize game" />}
      <Animated.View
        pointerEvents={minimized ? 'none' : 'auto'}
        style={[st.panel, { height: panelH, paddingBottom: insets.bottom, backgroundColor: meta.bg, transform: [{ translateY: y }] }]}>
        <WebView<object> // explicit generic: the default (undefined) makes the props type `never`
          key={game.key} // switching games loads the other page; minimizing never remounts
          ref={web}
          source={{ uri: API_URL + meta.path }}
          originWhitelist={[API_URL]} // anything else opens outside the app
          // Not browser-like, so ngrok's free tunnel serves the game instead of its "you are about to visit" page.
          userAgent="VoyaLiveApp"
          onMessage={onMessage}
          webviewDebuggingEnabled={__DEV__} // chrome://inspect in dev builds
          mediaPlaybackRequiresUserAction={false} // game music starts when the game opens (the player can mute it in the game)
          style={[st.web, { backgroundColor: meta.bg }]}
          bounces={false}
          overScrollMode="never"
        />
      </Animated.View>
      {minimized ? <GameBubble game={game.key} onOpen={onRestore} onClose={onClose} /> : null}
    </View>
  );
}

// Minimized game: a round badge in the game's colours. Draggable (see FloatingBubble); starts on the right just above
// the room's bubble, away from the left-aligned chat. A tap reopens the game; the small ✕ closes it.
function GameBubble({ game, onOpen, onClose }: { game: GameKey; onOpen: () => void; onClose: () => void }) {
  const meta = gameMeta(game);
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <FloatingBubble id="game" size={60} bottom={DOCK_BOTTOM + 56 + 16}>
      <Animated.View style={[st.halo, { borderColor: meta.colors[0], opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.6] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }]} />
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${meta.title}`} style={st.bubble}>
        <Gradient colors={meta.colors} style={StyleSheet.absoluteFill} />
        <meta.Icon size={26} color="#fff" strokeWidth={2.2} />
      </Pressable>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close ${meta.title}`} hitSlop={8} style={st.bubbleClose}>
        <X size={12} color="#fff" strokeWidth={3} />
      </Pressable>
    </FloatingBubble>
  );
}

const st = StyleSheet.create({
  layer: { zIndex: 100, elevation: 100 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', elevation: 24 },
  web: { flex: 1 },
  cards: { flexDirection: 'row', gap: space(3), paddingTop: space(2) },
  card: { flex: 1, gap: 4 },
  pressed: { opacity: 0.8 },
  thumb: { width: '100%', aspectRatio: 0.92, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: space(1) },
  cardSub: { color: colors.muted, fontSize: 12 },
  halo: { position: 'absolute', inset: -4, borderRadius: 34, borderWidth: 2 },
  bubble: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', elevation: 12 },
  bubbleClose: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1d1a2e', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', elevation: 13 },
});
