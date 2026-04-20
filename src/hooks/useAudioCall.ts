import { useCallback, useEffect, useRef, useState } from 'react';
import { socketClient } from '../lib/socketClient';
import type { PeerManager } from '../lib/PeerManager';

interface UseAudioCallOptions {
  peerManager: PeerManager;
}

interface UseAudioCallResult {
  localStream: MediaStream | null;
  isMicActive: boolean;
  isMuted: boolean;
  error: string | null;
  deviceList: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  startCall: () => Promise<void>;
  stopCall: () => void;
  toggleMute: () => void;
  switchDevice: (deviceId: string) => Promise<void>;
}

/**
 * Windows-tuned mic constraints. echoCancellation/noiseSuppression are the
 * Chromium built-ins (WebRTC-DSP), not WASAPI effects. autoGainControl off is
 * arguable; we keep it on for consistent perceived volume across speakers.
 * latency: 0.01 asks WASAPI for the lowest buffer it can give.
 */
// `latency` is a Chrome-supported constraint but missing from the standard
// lib.dom type — widen to a superset so we can ship it.
interface ChromeAudioConstraints extends MediaTrackConstraints {
  latency?: number;
}

const WINDOWS_AUDIO_CONSTRAINTS: ChromeAudioConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
  latency: 0.01
};

export function useAudioCall({
  peerManager
}: UseAudioCallOptions): UseAudioCallResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceList, setDeviceList] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Keep latest stream reachable from unmount cleanup without re-running
  // the effect on every state change.
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => {
    streamRef.current = localStream;
  }, [localStream]);

  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setDeviceList(devices.filter((d) => d.kind === 'audioinput'));
    } catch {
      setDeviceList([]);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const onChange = (): void => {
      void refreshDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
    };
  }, [refreshDevices]);

  const buildConstraints = useCallback(
    (deviceId: string | null): MediaStreamConstraints => ({
      audio: deviceId
        ? { ...WINDOWS_AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } }
        : WINDOWS_AUDIO_CONSTRAINTS,
      video: false
    }),
    []
  );

  const startCall = useCallback(async () => {
    setError(null);
    try {
      // Ask the main process to ensure mic permission is wired. On Windows
      // the grant is driven by getUserMedia itself — this call is a hook
      // for any future OS-level integration and also surfaces a clearer
      // error string on NotAllowedError.
      try {
        await window.electronAPI.requestMicPermission();
      } catch {
        // Non-fatal — fall through to getUserMedia.
      }

      const stream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(selectedDeviceId)
      );
      setLocalStream(stream);
      setIsMicActive(true);
      setIsMuted(false);

      const [track] = stream.getAudioTracks();
      if (track) {
        for (const peerId of peerManager.getAllPeerIds()) {
          const pc = peerManager.getPeer(peerId);
          if (!pc) continue;
          const existing = pc
            .getSenders()
            .find((s) => s.track?.kind === 'audio');
          if (existing) {
            await existing.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        }
      }

      if (socketClient.isConnected()) {
        socketClient.getSocket().emit('call:audio-started');
      }
      void refreshDevices();
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError') {
        setError(
          'Microphone access denied — check Windows Settings > Privacy & Security > Microphone and allow Talk+.'
        );
      } else if (e.name === 'NotFoundError') {
        setError('No microphone found. Plug in a microphone and try again.');
      } else {
        setError(`Could not start microphone: ${e.message ?? 'unknown error'}`);
      }
      setIsMicActive(false);
    }
  }, [peerManager, selectedDeviceId, buildConstraints, refreshDevices]);

  const stopCall = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      for (const t of current.getTracks()) t.stop();
    }
    void peerManager.removeSenderTrackAll('audio');
    setLocalStream(null);
    setIsMicActive(false);
    setIsMuted(false);
  }, [peerManager]);

  const toggleMute = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const [track] = stream.getAudioTracks();
    if (!track) return;
    const next = !track.enabled;
    track.enabled = next;
    setIsMuted(!next);
    // `enabled = false` just gates the samples; we still hold the sender
    // open so un-muting is instant (no renegotiation).
    if (socketClient.isConnected()) {
      socketClient
        .getSocket()
        .emit(next ? 'call:peer-unmuted' : 'call:peer-muted');
    }
  }, []);

  const switchDevice = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      if (!isMicActive) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          buildConstraints(deviceId)
        );
        const oldStream = streamRef.current;
        const [newTrack] = stream.getAudioTracks();
        if (newTrack) {
          await peerManager.replaceSenderTrackAll(newTrack);
        }
        if (oldStream) {
          for (const t of oldStream.getTracks()) t.stop();
        }
        setLocalStream(stream);
        // Preserve mute state across device switch.
        if (isMuted && newTrack) newTrack.enabled = false;
      } catch (err) {
        setError(
          `Could not switch microphone: ${(err as Error).message ?? 'unknown error'}`
        );
      }
    },
    [buildConstraints, isMicActive, isMuted, peerManager]
  );

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      const s = streamRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
    };
  }, []);

  return {
    localStream,
    isMicActive,
    isMuted,
    error,
    deviceList,
    selectedDeviceId,
    startCall,
    stopCall,
    toggleMute,
    switchDevice
  };
}
