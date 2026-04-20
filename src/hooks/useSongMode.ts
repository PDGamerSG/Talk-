import { useCallback, useEffect, useRef, useState } from 'react';
import { socketClient } from '../lib/socketClient';
import type { PeerManager } from '../lib/PeerManager';

/**
 * Song Mode: one participant broadcasts system audio (Windows WASAPI
 * loopback) to the whole room at music-quality bitrate.
 *
 * IMPORTANT: on Windows the loopback captures the *entire* system audio
 * output, not a specific app. If the app is paused or silent the stream
 * will contain digital silence — this is expected, not a bug. The
 * silenceWarning state helps the UI surface this to the user.
 */

interface LoopbackAudioConstraints {
  mandatory: { chromeMediaSource: 'desktop' };
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  sampleRate: number;
  channelCount: number;
}

const LOOPBACK_CONSTRAINTS: LoopbackAudioConstraints = {
  mandatory: { chromeMediaSource: 'desktop' },
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  sampleRate: 48000,
  channelCount: 2
};

const MUSIC_MAX_BITRATE = 256_000;
const SILENCE_CHECK_DELAY_MS = 3000;
const SILENCE_RMS_THRESHOLD = 0.001;

interface UseSongModeOptions {
  peerManager: PeerManager;
}

interface UseSongModeResult {
  isBroadcasting: boolean;
  sourceName: string | null;
  audioStream: MediaStream | null;
  silenceWarning: boolean;
  error: string | null;
  startSongMode: (sourceId: string, sourceName: string) => Promise<void>;
  stopSongMode: () => void;
}

export function useSongMode({
  peerManager
}: UseSongModeOptions): UseSongModeResult {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [silenceWarning, setSilenceWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    streamRef.current = audioStream;
  }, [audioStream]);

  const teardownSilenceDetector = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopSongMode = useCallback(() => {
    const current = streamRef.current;
    if (current) for (const t of current.getTracks()) t.stop();
    void peerManager.removeSenderTrackAll('audio');
    teardownSilenceDetector();
    setAudioStream(null);
    setIsBroadcasting(false);
    setSourceName(null);
    setSilenceWarning(false);
    if (socketClient.isConnected()) {
      socketClient.getSocket().emit('song:stopped');
    }
  }, [peerManager, teardownSilenceDetector]);

  const startSongMode = useCallback(
    async (sourceId: string, name: string) => {
      setError(null);
      try {
        // We keep the sourceId for audit / future per-app capture — Windows
        // loopback ignores it today but the argument is preserved for the
        // broadcaster-side UI label.
        void sourceId;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: LOOPBACK_CONSTRAINTS as unknown as MediaTrackConstraints,
          video: false
        });

        setAudioStream(stream);
        setIsBroadcasting(true);
        setSourceName(name);

        const [track] = stream.getAudioTracks();
        if (track) {
          for (const peerId of peerManager.getAllPeerIds()) {
            const pc = peerManager.getPeer(peerId);
            if (!pc) continue;
            const existing = pc
              .getSenders()
              .find((s) => s.track?.kind === 'audio');
            const sender = existing ?? pc.addTrack(track, stream);
            if (existing) await existing.replaceTrack(track);

            // Bump the outbound bitrate for music quality.
            try {
              const params = sender.getParameters();
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = MUSIC_MAX_BITRATE;
              await sender.setParameters(params);
            } catch (err) {
              console.warn('[useSongMode] setParameters failed', err);
            }
          }
        }

        if (socketClient.isConnected()) {
          socketClient.getSocket().emit('song:started', { sourceName: name });
        }

        // Silence detector — after a warm-up window, sample RMS and warn.
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);

        silenceTimerRef.current = window.setTimeout(() => {
          analyser.getFloatTimeDomainData(buffer);
          let sumSquares = 0;
          for (let i = 0; i < buffer.length; i++) {
            sumSquares += buffer[i] * buffer[i];
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          if (rms < SILENCE_RMS_THRESHOLD) setSilenceWarning(true);
        }, SILENCE_CHECK_DELAY_MS);
      } catch (err) {
        const e = err as DOMException;
        if (e.name === 'NotAllowedError') {
          setError(
            'System audio capture denied. Make sure Talk+ has screen recording permission.'
          );
        } else {
          setError(
            `Could not start Song Mode: ${e.message ?? 'unknown error'}`
          );
        }
        setIsBroadcasting(false);
      }
    },
    [peerManager]
  );

  useEffect(() => {
    return () => {
      const s = streamRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
      teardownSilenceDetector();
    };
  }, [teardownSilenceDetector]);

  return {
    isBroadcasting,
    sourceName,
    audioStream,
    silenceWarning,
    error,
    startSongMode,
    stopSongMode
  };
}
