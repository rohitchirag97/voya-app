import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api, ApiError, loadSession, setSignedOutHandler, type Me } from './src/api';
import { NavContext, type ActiveRoom, type Nav, type OpenGame, type Route } from './src/nav';
import { DialogHost } from './src/components/Dialog';
import { GameHost } from './src/room/GameSheet';
import { MiniRoom, RoomHost } from './src/room/RoomSession';
import { CoinSellersScreen } from './src/screens/CoinSellersScreen';
import { CommentsScreen } from './src/screens/CommentsScreen';
import { CreateRoomScreen } from './src/screens/CreateRoomScreen';
import { DmScreen } from './src/screens/DmScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MainTabs } from './src/screens/MainTabs';
import { NewPostScreen } from './src/screens/NewPostScreen';
import { OtpScreen } from './src/screens/OtpScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';
import { CpScreen } from './src/screens/CpScreen';
import { PostScreen } from './src/screens/PostsScreen';
import { ProfileSetupScreen } from './src/screens/ProfileSetupScreen';
import { RechargeScreen } from './src/screens/RechargeScreen';
import { SvipScreen } from './src/screens/SvipScreen';
import { GoLiveScreen } from './src/screens/GoLiveScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { UserProfileScreen } from './src/screens/UserProfileScreen';
import { RoomTheme } from './src/components/ui';
import { colors } from './src/theme';

const withoutRoom = (st: Route[]) => {
  const rest = st.filter((r) => r.name !== 'room');
  return rest.length ? rest : [{ name: 'home' } as Route];
};

export default function App() {
  const [stack, setStack] = useState<Route[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  const [game, setGame] = useState<OpenGame | null>(null);
  const activeRef = useRef(activeRoom);
  activeRef.current = activeRoom;

  const nav = useMemo<Nav>(() => {
    // Jump back to the room screen if it's in the stack, otherwise open it on top.
    const showRoom = () =>
      setStack((st) => {
        const s = st ?? [];
        const i = s.findIndex((r) => r.name === 'room');
        return i >= 0 ? s.slice(0, i + 1) : [...s, { name: 'room' }];
      });
    return {
      me,
      setMe,
      push: (r) => setStack((st) => [...(st ?? []), r]),
      replace: (r) => setStack((st) => [...(st ?? []).slice(0, -1), r]),
      reset: (r) => setStack([r]),
      back: () => setStack((st) => (st && st.length > 1 ? st.slice(0, -1) : st)),
      activeRoom,
      openRoom: (roomId, created) => {
        const cur = activeRef.current;
        if (cur && cur.roomId !== roomId) api('POST', `/rooms/${cur.roomId}/leave`).catch(() => {}); // one room at a time
        if (cur?.roomId !== roomId) setActiveRoom({ roomId, created });
        showRoom();
      },
      showRoom,
      closeRoom: () => {
        setActiveRoom(null);
        setStack((st) => withoutRoom(st ?? []));
      },
      game,
      openGame: (key) => setGame({ key, minimized: false }),
      minimizeGame: () => setGame((g) => (g ? { ...g, minimized: true } : g)),
      closeGame: () => setGame(null),
    };
  }, [me, activeRoom, game]);

  useEffect(() => {
    setSignedOutHandler(() => {
      setMe(null);
      setActiveRoom(null);
      setGame(null); // the next account must not inherit an open game
      setStack([{ name: 'login' }]);
    });
    (async () => {
      if (!(await loadSession())) return setStack([{ name: 'login' }]);
      // Only a real "not signed in" means login; a server restart or a network blip is retried for ~10s first.
      for (let attempt = 0; ; attempt++) {
        try {
          const user = await api<Me>('GET', '/me');
          setMe(user);
          return setStack([{ name: user.displayName ? 'home' : 'profile' }]);
        } catch (e) {
          if ((e instanceof ApiError && e.status === 401) || attempt >= 6) return setStack([{ name: 'login' }]);
          await new Promise<void>((r) => setTimeout(r, 1500));
        }
      }
    })();
  }, []);

  // Back pops one screen; on the room screen that minimizes the room instead of leaving it.
  const depth = useRef(0);
  depth.current = stack?.length ?? 0;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (depth.current <= 1) return false;
      setStack((st) => st!.slice(0, -1));
      return true;
    });
    return () => sub.remove();
  }, []);

  const route = stack?.at(-1);
  // Leave from the minimized room's ✕: tell the server, then drop the session.
  const leave = () => {
    const cur = activeRef.current;
    if (cur) api('POST', `/rooms/${cur.roomId}/leave`).catch(() => {});
    nav.closeRoom();
  };
  const body = (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!route ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : route.name === 'login' ? (
        <LoginScreen />
      ) : route.name === 'linkPhone' ? (
        <LoginScreen link changeToken={route.changeToken} />
      ) : route.name === 'otp' ? (
        <OtpScreen phone={route.phone} devCode={route.devCode} purpose={route.purpose} changeToken={route.changeToken} />
      ) : route.name === 'profile' ? (
        <ProfileSetupScreen />
      ) : route.name === 'home' ? (
        <MainTabs tab={route.tab ?? 'rooms'} />
      ) : route.name === 'create' ? (
        <CreateRoomScreen />
      ) : route.name === 'user' ? (
        <UserProfileScreen key={route.userId} userId={route.userId} />
      ) : route.name === 'dm' ? (
        <DmScreen key={route.userId} userId={route.userId} displayName={route.displayName} staffRole={route.staffRole} />
      ) : route.name === 'recharge' ? (
        <RechargeScreen />
      ) : route.name === 'svip' ? (
        <SvipScreen />
      ) : route.name === 'goLive' ? (
        <GoLiveScreen />
      ) : route.name === 'coinSellers' ? (
        <CoinSellersScreen />
      ) : route.name === 'comments' ? (
        <CommentsScreen key={route.postId} postId={route.postId} postAuthorId={route.postAuthorId} />
      ) : route.name === 'people' ? (
        <PeopleScreen key={route.userId + route.kind} userId={route.userId} kind={route.kind} />
      ) : route.name === 'cp' ? (
        <CpScreen key={route.userId} userId={route.userId} />
      ) : route.name === 'settings' ? (
        <SettingsScreen />
      ) : route.name === 'search' ? (
        <SearchScreen />
      ) : route.name === 'newPost' ? (
        <NewPostScreen />
      ) : route.name === 'post' ? (
        <PostScreen key={route.post.postId} post={route.post} />
      ) : (
        <RoomTheme>
          <RoomScreen />
        </RoomTheme>
      )}
      {activeRoom && route && route.name !== 'room' ? <MiniRoom onOpen={nav.showRoom} onLeave={leave} /> : null}
    </View>
  );

  return (
    <SafeAreaProvider>
      {/* Only the room is dark. */}
      <StatusBar barStyle={route?.name === 'room' ? 'light-content' : 'dark-content'} />
      <NavContext.Provider value={nav}>
        {activeRoom && me ? (
          <RoomHost key={activeRoom.roomId} active={activeRoom} me={me} onClosed={nav.closeRoom}>
            {body}
          </RoomHost>
        ) : (
          body
        )}
        {/* Outside the room host: the game keeps running (open or minimized) after leaving the room. */}
        {me ? <GameHost game={game} onMinimize={nav.minimizeGame} onRestore={() => game && nav.openGame(game.key)} onClose={nav.closeGame} /> : null}
        <DialogHost />
      </NavContext.Provider>
    </SafeAreaProvider>
  );
}
