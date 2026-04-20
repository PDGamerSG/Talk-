import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socketClient } from '../lib/socketClient';
import { PeerManager, type RtcSignalPayload } from '../lib/PeerManager';
import type {
  ConnectionStatus,
  Member,
  SongModeState
} from '../types/room';

interface UseRoomResult {
  roomId: string | null;
  userName: string;
  members: Member[];
  connectionStatus: ConnectionStatus;
  error: string | null;
  songMode: SongModeState;
  selfSocketId: string | null;
  remoteStreams: Map<string, MediaStream>;
  peerManager: PeerManager;
  createRoom: (userName: string) => void;
  joinRoom: (roomId: string, userName: string) => void;
  leaveRoom: () => void;
}

/** Localhost port the embedded signaling server listens on. */
const SIGNALING_PORT = 45671;

export function useRoom(): UseRoomResult {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [members, setMembers] = useState<Member[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selfSocketId, setSelfSocketId] = useState<string | null>(null);
  const [songMode, setSongMode] = useState<SongModeState>({
    active: false,
    broadcasterSocketId: null,
    sourceName: null
  });
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map()
  );

  // PeerManager is a long-lived object — create once per hook instance.
  const peerManagerRef = useRef<PeerManager | null>(null);
  if (!peerManagerRef.current) {
    peerManagerRef.current = new PeerManager(
      (socketId, track, streams) => {
        // Prefer the stream reference from ontrack — it already groups
        // audio+video together if the remote side added them to the same
        // MediaStream. Otherwise synthesise a new stream per socket.
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          const existing = next.get(socketId);
          if (streams.length > 0) {
            next.set(socketId, streams[0]);
          } else if (existing) {
            existing.addTrack(track);
          } else {
            const stream = new MediaStream();
            stream.addTrack(track);
            next.set(socketId, stream);
          }
          return next;
        });
      },
      (socketId, state) => {
        if (state === 'closed' || state === 'failed') {
          setRemoteStreams((prev) => {
            if (!prev.has(socketId)) return prev;
            const next = new Map(prev);
            next.delete(socketId);
            return next;
          });
        }
      }
    );
  }

  // Connect the socket once on mount, tear down on unmount.
  useEffect(() => {
    const socket = socketClient.connect(SIGNALING_PORT);
    peerManagerRef.current?.setSocket(socket);

    const onConnect = () => {
      setSelfSocketId(socket.id ?? null);
    };
    const onDisconnect = () => {
      setConnectionStatus((prev) =>
        prev === 'joined' ? 'joining' : prev
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      peerManagerRef.current?.removeAll();
      socketClient.disconnect();
    };
  }, []);

  // Room / peer / signalling event wiring.
  useEffect(() => {
    const socket = socketClient.isConnected()
      ? socketClient.getSocket()
      : null;
    if (!socket) return;
    const peerManager = peerManagerRef.current!;

    const onRoomCreated = (payload: { roomId: string; members: Member[] }) => {
      setRoomId(payload.roomId);
      setMembers(payload.members);
      setConnectionStatus('joined');
      socketClient.setRejoinState({
        roomId: payload.roomId,
        userName
      });
    };

    const onRoomJoined = (payload: { roomId: string; members: Member[] }) => {
      setRoomId(payload.roomId);
      setMembers(payload.members);
      setConnectionStatus('joined');
      socketClient.setRejoinState({
        roomId: payload.roomId,
        userName
      });
      // New joiner is the initiator against every existing peer.
      for (const m of payload.members) {
        if (m.socketId !== socket.id) {
          peerManager.createPeer(m.socketId, true, []);
        }
      }
    };

    const onRoomError = (payload: { message: string }) => {
      setError(payload.message);
      setConnectionStatus('error');
    };

    const onPeerJoined = (member: Member) => {
      setMembers((prev) =>
        prev.some((m) => m.socketId === member.socketId)
          ? prev
          : [...prev, member]
      );
      // Existing peer is the callee — does not initiate, waits for offer.
      peerManager.createPeer(member.socketId, false, []);
    };

    const onPeerLeft = (payload: { socketId: string }) => {
      setMembers((prev) => prev.filter((m) => m.socketId !== payload.socketId));
      peerManager.removePeer(payload.socketId);
      setRemoteStreams((prev) => {
        if (!prev.has(payload.socketId)) return prev;
        const next = new Map(prev);
        next.delete(payload.socketId);
        return next;
      });
    };

    const onRtcSignal = (payload: {
      fromId: string;
      signal: RtcSignalPayload;
    }) => {
      // Lazily create the peer if an offer lands before the joined list
      // syncs (race on slow networks).
      if (!peerManager.getPeer(payload.fromId)) {
        peerManager.createPeer(payload.fromId, false, []);
      }
      void peerManager.handleSignal(payload.fromId, payload.signal);
    };

    const onPeerMuted = (payload: { socketId: string }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.socketId === payload.socketId ? { ...m, isMuted: true } : m
        )
      );
    };
    const onPeerUnmuted = (payload: { socketId: string }) => {
      setMembers((prev) =>
        prev.map((m) =>
          m.socketId === payload.socketId ? { ...m, isMuted: false } : m
        )
      );
    };

    const onSongStarted = (payload: {
      broadcasterSocketId: string;
      sourceName: string;
    }) => {
      setSongMode({
        active: true,
        broadcasterSocketId: payload.broadcasterSocketId,
        sourceName: payload.sourceName
      });
    };
    const onSongStopped = () => {
      setSongMode({
        active: false,
        broadcasterSocketId: null,
        sourceName: null
      });
    };

    socket.on('room:created', onRoomCreated);
    socket.on('room:joined', onRoomJoined);
    socket.on('room:error', onRoomError);
    socket.on('room:peer-joined', onPeerJoined);
    socket.on('room:peer-left', onPeerLeft);
    socket.on('rtc:signal', onRtcSignal);
    socket.on('call:peer-muted', onPeerMuted);
    socket.on('call:peer-unmuted', onPeerUnmuted);
    socket.on('song:started', onSongStarted);
    socket.on('song:stopped', onSongStopped);

    return () => {
      socket.off('room:created', onRoomCreated);
      socket.off('room:joined', onRoomJoined);
      socket.off('room:error', onRoomError);
      socket.off('room:peer-joined', onPeerJoined);
      socket.off('room:peer-left', onPeerLeft);
      socket.off('rtc:signal', onRtcSignal);
      socket.off('call:peer-muted', onPeerMuted);
      socket.off('call:peer-unmuted', onPeerUnmuted);
      socket.off('song:started', onSongStarted);
      socket.off('song:stopped', onSongStopped);
    };
  }, [userName]);

  const createRoom = useCallback((name: string) => {
    setError(null);
    setUserName(name);
    setConnectionStatus('joining');
    const socket = socketClient.getSocket();
    socket.emit('room:create', { userName: name });
  }, []);

  const joinRoom = useCallback((id: string, name: string) => {
    setError(null);
    setUserName(name);
    setConnectionStatus('joining');
    const socket = socketClient.getSocket();
    socket.emit('room:join', { roomId: id, userName: name });
  }, []);

  const leaveRoom = useCallback(() => {
    const peerManager = peerManagerRef.current;
    peerManager?.removeAll();
    setRemoteStreams(new Map());
    if (socketClient.isConnected()) {
      socketClient.getSocket().emit('room:leave');
    }
    socketClient.setRejoinState(null);
    setRoomId(null);
    setMembers([]);
    setConnectionStatus('idle');
    setError(null);
  }, []);

  return useMemo(
    () => ({
      roomId,
      userName,
      members,
      connectionStatus,
      error,
      songMode,
      selfSocketId,
      remoteStreams,
      peerManager: peerManagerRef.current!,
      createRoom,
      joinRoom,
      leaveRoom
    }),
    [
      roomId,
      userName,
      members,
      connectionStatus,
      error,
      songMode,
      selfSocketId,
      remoteStreams,
      createRoom,
      joinRoom,
      leaveRoom
    ]
  );
}
