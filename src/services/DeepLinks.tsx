import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useNav } from '../nav';

// voyalive://room/<roomId> → that room. Shared links (http…/r/<roomId>) open a web page that hands off to this.
const ROOM_LINK = /^voyalive:\/\/room\/([0-9a-f-]{36})/i;
const roomOf = (url: string | null | undefined) => (url ? ROOM_LINK.exec(url)?.[1] ?? null : null);

// Mounted once at the app root. Catches the link the app was opened with and any that arrive while it runs; if
// nobody is signed in yet, the room opens right after login.
export function DeepLinks() {
  const nav = useNav();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    Linking.getInitialURL().then((url) => setPending(roomOf(url)), () => {});
    const sub = Linking.addEventListener('url', ({ url }) => setPending(roomOf(url)));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pending || !nav.me) return;
    nav.openRoom(pending); // locked rooms still ask for the password; ended ones say so
    setPending(null);
  }, [pending, nav]);

  return null;
}
