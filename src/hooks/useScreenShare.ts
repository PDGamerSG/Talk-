import { useCallback, useEffect, useRef, useState } from 'react';
import { socketClient } from '../lib/socketClient';
import type { PeerManager } from '../lib/PeerManager';

/**
 * Chrome-specific constraints exposed by Electron's desktopCapturer bridge.
 * These fields are non-standard — the TS lib does not know about them so we
 * define a local shape and cast at the getUserMedia boundary.
 */
interface DesktopCaptureVideoConstraints {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    minFrameRate: number;
    maxFrameRate: number;
  };
}

function buildVideoConstraints(
  sourceId: string
): DesktopCaptureVideoConstraints {
  return {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: sourceId,
      minWidth: 1280,
      maxWidth: 1920,
      minHeight: 720,
      maxHeight: 1080,
      minFrameRate: 15,
      maxFrameRate: 30
    }
  };
}

interface UseScreenShareOptions {
  peerManager: PeerManager;
}

interface UseScreenShareResult {
  screenStream: MediaStream | null;
  isSharing: boolean;
  sourceName: string | null;
  error: string | null;
  startShare: (sourceId: string, sourceName: string) => Promise<void>;
  stopShare: () => void;
}

export function useScreenShare({
  peerManager
}: UseScreenShareOptions): UseScreenShareResult {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    streamRef.current = screenStream;
  }, [screenStream]);

  const stopShare = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      for (const t of current.getTracks()) t.stop();
    }
    void peerManager.removeSenderTrackAll('video');
    setScreenStream(null);
    setIsSharing(false);
    setSourceName(null);
    if (socketClient.isConnected()) {
      socketClient.getSocket().emit('share:screen-stopped');
    }
  }, [peerManager]);

  const startShare = useCallback(
    async (sourceId: string, name: string) => {
      setError(null);
      if (name.includes('Talk+')) {
        setError('You cannot share Talk+ — choose a different window.');
        return;
      }
      try {
        // Cast: desktopCapturer video constraints are non-standard Chrome shape.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: buildVideoConstraints(sourceId) as unknown as MediaTrackConstraints,
          audio: false
        });
        setScreenStream(stream);
        setIsSharing(true);
        setSourceName(name);

        const [track] = stream.getVideoTracks();
        if (track) {
          for (const peerId of peerManager.getAllPeerIds()) {
            await peerManager.replaceSenderTrack(peerId, track);
          }
          // Auto-stop when the user clicks the native "Stop sharing" chip.
          track.onended = (): void => {
            stopShare();
          };
        }

        if (socketClient.isConnected()) {
          socketClient
            .getSocket()
            .emit('share:screen-started', { sourceName: name });
        }
      } catch (err) {
        setError(
          `Could not start screen share: ${(err as Error).message ?? 'unknown error'}`
        );
        setIsSharing(false);
      }
    },
    [peerManager, stopShare]
  );

  useEffect(() => {
    return () => {
      const s = streamRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
    };
  }, []);

  return { screenStream, isSharing, sourceName, error, startShare, stopShare };
}
