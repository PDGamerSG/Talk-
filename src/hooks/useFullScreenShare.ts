import { useCallback, useEffect, useRef, useState } from 'react';
import { socketClient } from '../lib/socketClient';
import type { PeerManager } from '../lib/PeerManager';

/**
 * Full-screen share = monitor video + system audio loopback.
 *
 * On Windows, passing `chromeMediaSource: 'desktop'` to the AUDIO constraint
 * with no `chromeMediaSourceId` triggers WASAPI loopback capture (all system
 * audio output). Video + audio must be requested in separate getUserMedia
 * calls because mixing the two constraint shapes is rejected by Chromium.
 */
interface FullscreenVideoConstraints {
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
interface LoopbackAudioConstraints {
  mandatory: {
    chromeMediaSource: 'desktop';
  };
}

interface UseFullScreenShareOptions {
  peerManager: PeerManager;
}

interface UseFullScreenShareResult {
  screenStream: MediaStream | null;
  isSharing: boolean;
  sourceName: string | null;
  hasSystemAudio: boolean;
  error: string | null;
  startShare: (sourceId: string, sourceName: string) => Promise<void>;
  stopShare: () => void;
}

export function useFullScreenShare({
  peerManager
}: UseFullScreenShareOptions): UseFullScreenShareResult {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    streamRef.current = screenStream;
  }, [screenStream]);

  const stopShare = useCallback(() => {
    const current = streamRef.current;
    if (current) for (const t of current.getTracks()) t.stop();
    void peerManager.removeSenderTrackAll('video');
    void peerManager.removeSenderTrackAll('audio');
    setScreenStream(null);
    setIsSharing(false);
    setSourceName(null);
    setHasSystemAudio(false);
    if (socketClient.isConnected()) {
      socketClient.getSocket().emit('share:screen-stopped');
    }
  }, [peerManager]);

  const startShare = useCallback(
    async (sourceId: string, name: string) => {
      setError(null);
      if (name.includes('Talk+')) {
        setError('You cannot share Talk+ — choose a different source.');
        return;
      }

      const videoConstraints: FullscreenVideoConstraints = {
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

      const audioConstraints: LoopbackAudioConstraints = {
        mandatory: { chromeMediaSource: 'desktop' }
      };

      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints as unknown as MediaTrackConstraints,
          audio: false
        });

        let audioTrack: MediaStreamTrack | null = null;
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints as unknown as MediaTrackConstraints,
            video: false
          });
          audioTrack = audioStream.getAudioTracks()[0] ?? null;
          if (audioTrack) videoStream.addTrack(audioTrack);
        } catch {
          // Loopback can fail on some Windows drivers — continue video-only.
          audioTrack = null;
        }

        setScreenStream(videoStream);
        setIsSharing(true);
        setSourceName(name);
        setHasSystemAudio(audioTrack !== null);

        const [videoTrack] = videoStream.getVideoTracks();
        for (const peerId of peerManager.getAllPeerIds()) {
          if (videoTrack) {
            await peerManager.replaceSenderTrack(peerId, videoTrack);
          }
          if (audioTrack) {
            await peerManager.replaceSenderTrack(peerId, audioTrack);
          }
        }

        if (videoTrack) {
          videoTrack.onended = (): void => {
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
          `Could not start full-screen share: ${(err as Error).message ?? 'unknown error'}`
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

  return {
    screenStream,
    isSharing,
    sourceName,
    hasSystemAudio,
    error,
    startShare,
    stopShare
  };
}
