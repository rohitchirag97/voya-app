import React, { useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { freshAccessToken } from '../api';
import { API_URL } from '../config';
import { space } from '../theme';

// The Ludo board for a room in Ludo mode: a square in the room itself, under the seat row. Never minimized; the page
// (server/public/games/ludo) follows the game for everyone, players and listeners alike.
export function LudoBoard({ roomId }: { roomId: string }) {
  const web = useRef<WebView>(null);
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - space(3) * 2, height * 0.5); // leaves the chat room on short phones

  // The page asks for a token on every socket (re)connect. Only our own page is heard.
  async function onMessage(e: WebViewMessageEvent) {
    const url = e.nativeEvent.url;
    if (url !== API_URL && !url.startsWith(API_URL + '/')) return;
    let msg: { type?: string } | null = null;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {}
    if (msg?.type !== 'token') return;
    const token = await freshAccessToken();
    web.current?.injectJavaScript(`window.voyaToken(${JSON.stringify(token)}); true;`);
  }

  return (
    <View style={[st.wrap, { width: size, height: size }]}>
      <WebView<object> // explicit generic: the default (undefined) makes the props type `never`
        key={roomId}
        ref={web}
        source={{ uri: `${API_URL}/games/ludo/?room=${roomId}` }}
        originWhitelist={[API_URL]}
        userAgent="VoyaLiveApp"
        onMessage={onMessage}
        webviewDebuggingEnabled={__DEV__}
        style={st.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        accessibilityLabel="Ludo board"
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignSelf: 'center', marginVertical: space(1) },
  web: { flex: 1, backgroundColor: 'transparent' },
});
