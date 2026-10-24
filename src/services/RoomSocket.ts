import { io, type Socket } from 'socket.io-client';
import { ApiError, freshAccessToken } from '../api';
import { API_URL } from '../config';

export type Ack<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function connectSocket(): Socket {
  return io(API_URL, {
    autoConnect: false, // caller connects once the backend confirmed room membership
    transports: ['websocket'],
    // Called on every (re)connect so a reconnect after 15 min still sends a valid token.
    auth: (cb) => void freshAccessToken().then((token) => cb({ token })),
  });
}

export async function send<T = any>(socket: Socket, event: string, payload: object): Promise<T> {
  let r: Ack<T>;
  try {
    r = await socket.timeout(8000).emitWithAck(event, payload);
  } catch {
    throw new ApiError('NETWORK', 'Connection is unstable, try again.');
  }
  if (!r.ok) throw new ApiError(r.error.code, r.error.message);
  return r.data;
}
