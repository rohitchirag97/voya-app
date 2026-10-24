import { createContext, useContext } from 'react';
import type { Me, PeopleKind, Post, RoomSnapshot, StaffRole, ZegoCreds } from './api';

export type Tab = 'rooms' | 'posts' | 'messages' | 'me';

export type OtpPurpose = 'link' | 'verifyCurrent' | 'change';

export type Route =
  | { name: 'login' }
  // purpose (default: sign in): link adds the phone to the signed-in account; verifyCurrent is step 1 of changing it, change is step 2.
  | { name: 'otp'; phone: string; devCode?: string; purpose?: OtpPurpose; changeToken?: string }
  | { name: 'linkPhone'; changeToken?: string } // with changeToken: entering the new number when changing it
  | { name: 'profile' }
  | { name: 'home'; tab?: Tab } // the bottom-tab shell
  | { name: 'create' }
  | { name: 'room' } // shows the active room session
  | { name: 'user'; userId: string }
  | { name: 'dm'; userId: string; displayName: string | null; staffRole?: StaffRole | null }
  | { name: 'recharge' }
  | { name: 'svip' }
  | { name: 'goLive' }
  | { name: 'newPost' }
  | { name: 'search' }
  | { name: 'settings' }
  | { name: 'comments'; postId: string; postAuthorId: string }
  | { name: 'people'; userId: string; kind: PeopleKind }
  | { name: 'coinSellers' }
  | { name: 'post'; post: Post };

export type ActiveRoom = { roomId: string; created?: { room: RoomSnapshot; zego: ZegoCreds } };

export type Nav = {
  me: Me | null;
  setMe: (m: Me | null) => void;
  push: (r: Route) => void;
  replace: (r: Route) => void;
  reset: (r: Route) => void;
  back: () => void;
  // The room session lives outside the screen stack, so it keeps running (minimized) on other screens.
  activeRoom: ActiveRoom | null;
  openRoom: (roomId: string, created?: ActiveRoom['created']) => void;
  showRoom: () => void;
  closeRoom: () => void;
  // The open game lives outside the screens and the room too: it survives leaving the room and can sit minimized as a bubble.
  game: OpenGame | null;
  openGame: (key: GameKey) => void; // opens it, or brings a minimized one back
  minimizeGame: () => void;
  closeGame: () => void;
};

export type GameKey = 'jungle' | 'galaxy' | 'rocket';
export type OpenGame = { key: GameKey; minimized: boolean };

export const NavContext = createContext<Nav>(null as unknown as Nav);
export const useNav = () => useContext(NavContext);
