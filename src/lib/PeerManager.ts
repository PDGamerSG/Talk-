import type { Socket } from 'socket.io-client';
import { getIceConfig } from './rtcConfig';

export type RtcSignalPayload =
  | { type: 'offer'; sdp: string }
  | { type: 'answer'; sdp: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit };

export interface PeerStats {
  packetsLost: number;
  roundTripTime: number;
}

type OnRemoteTrack = (
  socketId: string,
  track: MediaStreamTrack,
  streams: readonly MediaStream[]
) => void;

type OnPeerStateChange = (
  socketId: string,
  state: RTCPeerConnectionState
) => void;

/**
 * Manages a pool of RTCPeerConnections keyed by remote socket id.
 *
 * One PeerManager instance per room. The signalling channel is the
 * Socket.io connection — we re-use the single `rtc:signal` event
 * for offer, answer, and ICE candidate exchange.
 */
export class PeerManager {
  private readonly peers = new Map<string, RTCPeerConnection>();

  /**
   * ICE candidates can arrive *before* we've applied the remote description
   * (the peer sends them as soon as local ICE gathering starts). Calling
   * `addIceCandidate` with no remote description set throws. We queue the
   * candidates here per-peer and flush the queue once the remote description
   * is set. This is the single most common WebRTC bug — do not remove.
   */
  private readonly pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  /** Tracks who is the local "initiator" for each peer (affects offer flow). */
  private readonly initiatorRole = new Map<string, boolean>();

  private socket: Socket | null = null;

  constructor(
    private readonly onRemoteTrack: OnRemoteTrack,
    private readonly onPeerStateChange: OnPeerStateChange
  ) {}

  /** Socket must be injected before the first createPeer call. */
  setSocket(socket: Socket): void {
    this.socket = socket;
  }

  createPeer(
    socketId: string,
    isInitiator: boolean,
    localStreams: MediaStream[] = []
  ): RTCPeerConnection {
    // Close any existing peer for this id so we always return a fresh one.
    const existing = this.peers.get(socketId);
    if (existing) {
      existing.close();
      this.peers.delete(socketId);
    }

    const pc = new RTCPeerConnection(getIceConfig());
    this.peers.set(socketId, pc);
    this.initiatorRole.set(socketId, isInitiator);

    // Pre-seed any local tracks the caller already has.
    for (const stream of localStreams) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('rtc:signal', {
          targetId: socketId,
          signal: {
            type: 'candidate',
            candidate: event.candidate.toJSON()
          } satisfies RtcSignalPayload
        });
      }
    };

    pc.ontrack = (event) => {
      this.onRemoteTrack(socketId, event.track, event.streams);
    };

    pc.onconnectionstatechange = () => {
      this.onPeerStateChange(socketId, pc.connectionState);
    };

    if (isInitiator) {
      // Small delay gives the addTrack calls time to flush through the
      // internal sender pool before we build the SDP — avoids an empty
      // m= section race on slower machines.
      setTimeout(() => {
        void this.sendOffer(socketId, pc);
      }, 100);
    }

    return pc;
  }

  private async sendOffer(
    socketId: string,
    pc: RTCPeerConnection
  ): Promise<void> {
    if (!this.socket) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('rtc:signal', {
        targetId: socketId,
        signal: { type: 'offer', sdp: offer.sdp ?? '' } satisfies RtcSignalPayload
      });
    } catch (err) {
      console.error('[PeerManager] sendOffer failed', socketId, err);
    }
  }

  async handleSignal(
    socketId: string,
    signal: RtcSignalPayload
  ): Promise<void> {
    const pc = this.peers.get(socketId);
    if (!pc) {
      console.warn('[PeerManager] handleSignal: no peer for', socketId);
      return;
    }

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        await this.flushPendingCandidates(socketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket?.emit('rtc:signal', {
          targetId: socketId,
          signal: {
            type: 'answer',
            sdp: answer.sdp ?? ''
          } satisfies RtcSignalPayload
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        await this.flushPendingCandidates(socketId, pc);
      } else if (signal.type === 'candidate') {
        // If the remote description is not yet set, adding the candidate
        // will throw InvalidStateError. Queue for later instead.
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(signal.candidate);
        } else {
          const queue = this.pendingCandidates.get(socketId) ?? [];
          queue.push(signal.candidate);
          this.pendingCandidates.set(socketId, queue);
        }
      }
    } catch (err) {
      console.error('[PeerManager] handleSignal error', socketId, err);
    }
  }

  private async flushPendingCandidates(
    socketId: string,
    pc: RTCPeerConnection
  ): Promise<void> {
    const queue = this.pendingCandidates.get(socketId);
    if (!queue || queue.length === 0) return;
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.warn('[PeerManager] failed to flush candidate', err);
      }
    }
    this.pendingCandidates.delete(socketId);
  }

  /** Replace the outgoing track of a given kind for a specific peer. */
  replaceSenderTrack(
    socketId: string,
    newTrack: MediaStreamTrack
  ): Promise<void> | void {
    const pc = this.peers.get(socketId);
    if (!pc) return;
    const sender = pc
      .getSenders()
      .find((s) => s.track?.kind === newTrack.kind);
    if (sender) {
      return sender.replaceTrack(newTrack);
    }
    // No matching sender yet — add a new one.
    pc.addTrack(newTrack);
  }

  /** Remove the track of a given kind by replacing it with null. */
  removeSenderTrack(
    socketId: string,
    kind: 'audio' | 'video'
  ): Promise<void> | void {
    const pc = this.peers.get(socketId);
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === kind);
    if (sender) {
      return sender.replaceTrack(null);
    }
  }

  /** Broadcast helper: apply a track replacement to every active peer. */
  replaceSenderTrackAll(newTrack: MediaStreamTrack): Promise<void[]> {
    const ops: Array<Promise<void> | void> = [];
    for (const socketId of this.peers.keys()) {
      ops.push(this.replaceSenderTrack(socketId, newTrack));
    }
    return Promise.all(ops.map((p) => Promise.resolve(p ?? undefined)));
  }

  /** Broadcast helper: remove a kind of track from every active peer. */
  removeSenderTrackAll(kind: 'audio' | 'video'): Promise<void[]> {
    const ops: Array<Promise<void> | void> = [];
    for (const socketId of this.peers.keys()) {
      ops.push(this.removeSenderTrack(socketId, kind));
    }
    return Promise.all(ops.map((p) => Promise.resolve(p ?? undefined)));
  }

  /** Add a brand-new track (no existing sender of that kind) to every peer. */
  addTrackAll(track: MediaStreamTrack, stream: MediaStream): void {
    for (const pc of this.peers.values()) {
      pc.addTrack(track, stream);
    }
  }

  getPeer(socketId: string): RTCPeerConnection | undefined {
    return this.peers.get(socketId);
  }

  getAllPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  isInitiator(socketId: string): boolean {
    return this.initiatorRole.get(socketId) ?? false;
  }

  removePeer(socketId: string): void {
    const pc = this.peers.get(socketId);
    if (pc) {
      pc.close();
      this.peers.delete(socketId);
    }
    this.pendingCandidates.delete(socketId);
    this.initiatorRole.delete(socketId);
  }

  removeAll(): void {
    for (const pc of this.peers.values()) {
      pc.close();
    }
    this.peers.clear();
    this.pendingCandidates.clear();
    this.initiatorRole.clear();
  }

  async getStats(socketId: string): Promise<PeerStats> {
    const pc = this.peers.get(socketId);
    if (!pc) return { packetsLost: 0, roundTripTime: 0 };

    const stats = await pc.getStats();
    let packetsLost = 0;
    let roundTripTime = 0;

    stats.forEach((report) => {
      // Aggregate inbound packet loss across all streams.
      if (report.type === 'inbound-rtp' && 'packetsLost' in report) {
        const lost = (report as RTCInboundRtpStreamStats).packetsLost;
        if (typeof lost === 'number') packetsLost += lost;
      }
      // Use the currently-selected candidate pair's RTT if available.
      if (
        report.type === 'candidate-pair' &&
        'state' in report &&
        (report as RTCIceCandidatePairStats).state === 'succeeded' &&
        'currentRoundTripTime' in report
      ) {
        const rtt = (report as RTCIceCandidatePairStats).currentRoundTripTime;
        if (typeof rtt === 'number' && rtt > roundTripTime) {
          // Convert seconds → ms.
          roundTripTime = rtt * 1000;
        }
      }
    });

    return { packetsLost, roundTripTime };
  }
}
