import { useEffect, useState } from 'react';
import type { PeerManager } from '../lib/PeerManager';

interface UsePeerConnectionResult {
  connectionState: RTCPeerConnectionState;
  remoteStream: MediaStream | null;
}

/**
 * Tracks a single peer's connection state + its aggregated remote stream.
 *
 * The remote stream is built by listening to the PeerManager's onRemoteTrack
 * callback via the shared remoteStreams map on useRoom. This hook is a thin
 * view over that map.
 */
export function usePeerConnection(
  peerManager: PeerManager,
  socketId: string,
  remoteStreams: Map<string, MediaStream>,
  localStreams: MediaStream[]
): UsePeerConnectionResult {
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState>('new');

  // Whenever localStreams change, push their tracks to the peer.
  useEffect(() => {
    const pc = peerManager.getPeer(socketId);
    if (!pc) return;
    for (const stream of localStreams) {
      for (const track of stream.getTracks()) {
        const existing = pc
          .getSenders()
          .find((s) => s.track?.kind === track.kind);
        if (existing) {
          void existing.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
        }
      }
    }
  }, [peerManager, socketId, localStreams]);

  // Poll the pc for state transitions. Using a poll rather than attaching
  // another onconnectionstatechange listener avoids clobbering the manager's.
  useEffect(() => {
    let cancelled = false;
    const tick = (): void => {
      if (cancelled) return;
      const pc = peerManager.getPeer(socketId);
      if (pc && pc.connectionState !== connectionState) {
        setConnectionState(pc.connectionState);
      }
    };
    const interval = window.setInterval(tick, 500);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [peerManager, socketId, connectionState]);

  const remoteStream = remoteStreams.get(socketId) ?? null;

  return { connectionState, remoteStream };
}
