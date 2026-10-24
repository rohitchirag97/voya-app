import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import ZegoExpressEngine, {
  ZegoEffectsBeautyParam,
  ZegoEngineProfile,
  ZegoPublishChannel,
  ZegoRoomConfig,
  ZegoRoomState,
  ZegoScenario,
  ZegoSoundLevelConfig,
  ZegoUpdateType,
  ZegoUser,
  ZegoVideoConfig,
  ZegoVideoConfigPreset,
  ZegoView,
  ZegoViewMode,
} from 'zego-express-engine-reactnative';
import type { ZegoCreds } from '../api';

export type MediaState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
// Live camera beauty: each intensity is 0-100.
export type Beauty = { on: boolean; smooth: number; whiten: number; rosy: number; sharpen: number };
type Handlers = {
  onState: (s: MediaState) => void;
  onSoundLevels: (levels: Record<string, number>) => void; // streamId -> 0..100; local stream included
  onTokenWillExpire: () => Promise<string>;
};

// Android foreground service (RoomCallService.kt) that keeps the room's audio and socket alive in the background.
const RoomCall: { start(mic: boolean): void; stop(): void } | undefined = Platform.OS === 'android' ? NativeModules.RoomCall : undefined;

export async function ensureMicPermission() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Microphone',
    message: 'VoyaLive needs your microphone so others in the room can hear you on stage.',
    buttonPositive: 'Allow',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensureCameraPermission() {
  if (Platform.OS !== 'android') return true;
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Camera',
    message: 'VoyaLive needs your camera so viewers can see you when you go live or co-host.',
    buttonPositive: 'Allow',
  });
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

// Portrait 540p for live video (hosts and co-hosts).
const liveVideoConfig = () => {
  const c = new ZegoVideoConfig(ZegoVideoConfigPreset.Preset540P);
  c.captureWidth = c.encodeWidth = 540;
  c.captureHeight = c.encodeHeight = 960;
  return c;
};
const viewOf = (reactTag: number) => new ZegoView(reactTag, ZegoViewMode.AspectFill, 0x000000);

// The only place that talks to ZegoExpressEngine. Audio rooms never touch the camera; live rooms (`video`) publish
// camera + mic from seats and render streams into views.
class ZegoAudioRoomService {
  private engine: ZegoExpressEngine | null = null;
  private roomId: string | null = null;
  private publishing: string | null = null;
  private playing = new Set<string>();
  private views = new Map<string, number>(); // streamId -> the tile (reactTag) it should render into
  private connected = false; // logged in to the room: plays can start
  private video = false;
  private previewTag: number | null = null;
  private frontCamera = true;

  async join(creds: ZegoCreds, displayName: string, h: Handlers, opts: { video?: boolean } = {}) {
    if (this.roomId) await this.leave();
    this.video = !!opts.video;
    this.engine ??= await ZegoExpressEngine.createEngineWithProfile(
      // token auth: no AppSign in the app
      new ZegoEngineProfile(creds.appId, '', this.video ? ZegoScenario.Broadcast : ZegoScenario.HighQualityChatroom),
    );
    const e = this.engine;
    await e.enableCamera(false, ZegoPublishChannel.Main);
    if (this.video) {
      await e.setVideoConfig(liveVideoConfig(), ZegoPublishChannel.Main);
      // The built-in beauty effects must be set up before the camera starts.
      await e.startEffectsEnv().catch(() => {});
      await this.applyBeauty();
    }

    e.on('roomStateUpdate', (_room, state) => {
      h.onState(state === ZegoRoomState.Connected ? 'connected' : state === ZegoRoomState.Connecting ? 'reconnecting' : 'disconnected');
    });
    // Everyone's audio plays as soon as their stream appears; video tiles attach a view to the same stream.
    e.on('roomStreamUpdate', (_room, type, streams) => {
      for (const s of streams) {
        if (type === ZegoUpdateType.Add) this.play(s.streamID);
        else this.stopPlay(s.streamID);
      }
    });
    e.on('remoteSoundLevelUpdate', (levels) => h.onSoundLevels(levels));
    e.on('capturedSoundLevelUpdate', (level) => this.publishing && h.onSoundLevels({ [this.publishing]: level }));
    e.on('roomTokenWillExpire', async (room) => {
      try {
        await e.renewToken(room, await h.onTokenWillExpire());
      } catch {} // the SDK will report the room state if renewal ultimately fails
    });

    h.onState('connecting');
    this.roomId = creds.zegoRoomId;
    const result = await e.loginRoom(creds.zegoRoomId, new ZegoUser(creds.zegoUserId, displayName), new ZegoRoomConfig(0, true, creds.token));
    if (result.errorCode !== 0) {
      await this.leave();
      // Codes: https://www.zegocloud.com/docs/real-time-video-android-java/client-sdk/error-code
      throw new Error(`${this.video ? 'Live' : 'Audio'} connection failed (ZEGO ${result.errorCode})`);
    }
    await e.startSoundLevelMonitor(new ZegoSoundLevelConfig(300, true));
    // Tiles that mounted while we were connecting get their video now.
    this.connected = true;
    for (const [streamId, tag] of this.views) {
      if (streamId === this.publishing) continue;
      this.playing.add(streamId);
      await e.startPlayingStream(streamId, viewOf(tag), undefined).catch(() => {});
    }
    RoomCall?.start(false);
    // Android 13+ hides the "in a room" notification without this; the background audio works either way.
    if (Platform.OS === 'android' && Platform.Version >= 33) PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
  }

  // Call only after the backend confirmed the seat. `token` carries publish privilege. Live rooms also turn on the
  // camera, unless `camera: false` (audio-only co-host).
  async startPublishing(streamId: string, token?: string, { camera = true } = {}) {
    if (!this.engine || !this.roomId || this.publishing === streamId) return;
    if (!(await ensureMicPermission())) throw new Error('Microphone permission denied');
    const video = this.video && camera;
    if (video && !(await ensureCameraPermission())) throw new Error('Camera permission denied');
    if (token) await this.engine.renewToken(this.roomId, token);
    await this.engine.mutePublishStreamAudio(false, ZegoPublishChannel.Main);
    if (video) {
      await this.engine.enableCamera(true, ZegoPublishChannel.Main);
      await this.engine.useFrontCamera(this.frontCamera, ZegoPublishChannel.Main);
      if (this.previewTag !== null) await this.engine.startPreview(viewOf(this.previewTag), ZegoPublishChannel.Main);
    }
    await this.engine.startPublishingStream(streamId, ZegoPublishChannel.Main, undefined);
    this.publishing = streamId;
    RoomCall?.start(true);
  }

  async stopPublishing() {
    if (!this.engine || !this.publishing) return;
    this.publishing = null;
    if (this.roomId) RoomCall?.start(false); // back to listening (leave() clears roomId first, then stops the service)
    await this.engine.stopPublishingStream(ZegoPublishChannel.Main);
    if (this.video) {
      await this.engine.stopPreview(ZegoPublishChannel.Main).catch(() => {});
      await this.engine.enableCamera(false, ZegoPublishChannel.Main).catch(() => {});
    }
  }

  isPublishing = () => !!this.publishing;
  publishingStream = () => this.publishing;

  setMicMuted(muted: boolean) {
    return this.engine?.mutePublishStreamAudio(muted, ZegoPublishChannel.Main);
  }

  // ---------- video (live rooms) ----------
  // Your own camera in a view (the tile calls this when it mounts; null when it unmounts).
  async setPreviewView(reactTag: number) {
    this.previewTag = reactTag;
    if (!this.engine || !this.video) return;
    if (this.publishing) await this.engine.startPreview(viewOf(reactTag), ZegoPublishChannel.Main).catch(() => {});
  }

  // A preview tile went away: stop the preview only if no newer tile has taken it over.
  async releasePreviewView(reactTag: number) {
    if (this.previewTag !== reactTag) return;
    this.previewTag = null;
    await this.engine?.stopPreview(ZegoPublishChannel.Main).catch(() => {});
  }

  // Someone else's stream in a view. Works for streams in other rooms too (the PK opponent's camera).
  // Remembered, so a tile that mounts before the connection is ready still gets its video once it is.
  async showStream(streamId: string, reactTag: number) {
    this.views.set(streamId, reactTag);
    if (!this.engine || !this.connected || streamId === this.publishing) return;
    this.playing.add(streamId);
    await this.engine.startPlayingStream(streamId, viewOf(reactTag), undefined).catch(() => {});
  }

  // A stream from another room stops when its tile goes; this room's streams keep playing audio.
  hideStream(streamId: string, otherRoom: boolean, reactTag?: number) {
    if (reactTag !== undefined && this.views.get(streamId) !== reactTag) return; // a newer tile shows it now
    this.views.delete(streamId);
    if (otherRoom) this.stopPlay(streamId);
  }

  // ---------- beauty (your own camera) ----------
  // Kept for the whole app session, so it carries over to your next live or co-host spot.
  beauty: Beauty = { on: true, smooth: 50, whiten: 50, rosy: 25, sharpen: 25 };
  async setBeauty(b: Beauty) {
    this.beauty = b;
    await this.applyBeauty();
  }
  private async applyBeauty() {
    const e = this.engine;
    if (!e || !this.video) return;
    await e.enableEffectsBeauty(this.beauty.on).catch(() => {});
    if (!this.beauty.on) return;
    const p = new ZegoEffectsBeautyParam();
    p.smoothIntensity = this.beauty.smooth;
    p.whitenIntensity = this.beauty.whiten;
    p.rosyIntensity = this.beauty.rosy;
    p.sharpenIntensity = this.beauty.sharpen;
    await e.setEffectsBeautyParam(p).catch(() => {});
  }

  async flipCamera() {
    this.frontCamera = !this.frontCamera;
    await this.engine?.useFrontCamera(this.frontCamera, ZegoPublishChannel.Main);
  }

  // Camera on/off while on a seat (an audio-only co-host can switch it on later).
  async setCameraOn(on: boolean) {
    const e = this.engine;
    if (!e) return;
    if (on && !(await ensureCameraPermission())) throw new Error('Camera permission denied');
    await e.enableCamera(on, ZegoPublishChannel.Main);
    if (on) {
      await e.useFrontCamera(this.frontCamera, ZegoPublishChannel.Main);
      if (this.previewTag !== null) await e.startPreview(viewOf(this.previewTag), ZegoPublishChannel.Main).catch(() => {});
    }
  }

  // A stream appeared: play it, straight into its tile if one is already waiting for it.
  private play(streamId: string) {
    if (this.playing.has(streamId) || streamId === this.publishing) return;
    this.playing.add(streamId);
    const tag = this.views.get(streamId);
    this.engine?.startPlayingStream(streamId, tag === undefined ? undefined : viewOf(tag), undefined);
  }

  private stopPlay(streamId: string) {
    if (this.playing.delete(streamId)) this.engine?.stopPlayingStream(streamId);
  }

  async leave() {
    const e = this.engine;
    if (!e) return;
    this.roomId = null;
    RoomCall?.stop();
    await this.stopPublishing().catch(() => {});
    for (const s of this.playing) await e.stopPlayingStream(s).catch(() => {});
    this.playing.clear();
    await e.stopSoundLevelMonitor().catch(() => {});
    // Don't call logoutRoom: in zego-express-engine-reactnative 3.25.0 it resolves its promise twice,
    // which aborts the app on RN's new architecture. destroyEngine logs out of the room itself.
    this.roomId = null;
    this.previewTag = null;
    this.connected = false;
    this.views.clear();
    for (const ev of ['roomStateUpdate', 'roomStreamUpdate', 'remoteSoundLevelUpdate', 'capturedSoundLevelUpdate', 'roomTokenWillExpire'] as const) {
      e.off(ev, undefined);
    }
    this.engine = null;
    await ZegoExpressEngine.destroyEngine();
  }
}

export const zego = new ZegoAudioRoomService();
