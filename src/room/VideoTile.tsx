import React, { useEffect, useRef, useState } from 'react';
import { findNodeHandle, type StyleProp, type ViewStyle } from 'react-native';
import { ZegoTextureView } from 'zego-express-engine-reactnative';
import { zego } from '../services/ZegoAudioRoomService';

// One live video: your own camera (`local`) or someone's stream. `otherRoom`: a stream from another live room
// (the PK opponent), which stops playing when the tile goes away.
// The video is attached only after the native view has laid out (attaching earlier can leave it black on some
// devices), and once more a moment later in case the native surface was still being created.
export function VideoTile({ streamId, local, otherRoom, style }: { streamId?: string | null; local?: boolean; otherRoom?: boolean; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<ZegoTextureView>(null);
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => {
    if (!laidOut) return;
    const tag = findNodeHandle(ref.current);
    if (tag == null) return;
    const attach = () => (local ? zego.setPreviewView(tag) : streamId ? zego.showStream(streamId, tag) : undefined);
    attach();
    const again = setTimeout(attach, 600);
    return () => {
      clearTimeout(again);
      // Only lets go of its own view: when the layout changes, the new tile may already have taken over.
      if (local) zego.releasePreviewView(tag);
      else if (streamId) zego.hideStream(streamId, !!otherRoom, tag);
    };
  }, [laidOut, streamId, local, otherRoom]);
  return <ZegoTextureView ref={ref} style={style} onLayout={() => setLaidOut(true)} />;
}
