import { createServer, type Server as HttpServer } from 'node:http';
import { Server as IoServer, type Socket } from 'socket.io';
import express from 'express';
import cors from 'cors';

interface Member {
  socketId: string;
  userName: string;
  isMuted: boolean;
  joinedAt: number;
}

interface RoomState {
  roomId: string;
  members: Map<string, Member>;
}

const PORT = 45671;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateRoomId(existing: Set<string>): string {
  let attempt = '';
  do {
    attempt = Array.from({ length: 6 }, () =>
      ROOM_CODE_ALPHABET.charAt(
        Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
      )
    ).join('');
  } while (existing.has(attempt));
  return attempt;
}

export interface SignalingServerHandle {
  httpServer: HttpServer;
  io: IoServer;
  close: () => Promise<void>;
  port: number;
  /** Exposed so Phase 6 can attach a CoBrowser instance per room. */
  rooms: Map<string, RoomState>;
}

export async function startSignalingServer(
  port: number = PORT
): Promise<SignalingServerHandle> {
  const app = express();
  app.use(cors());
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io = new IoServer(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 4 * 1024 * 1024
  });

  const rooms = new Map<string, RoomState>();
  const socketToRoom = new Map<string, string>();

  function broadcastPeerLeft(room: RoomState, socketId: string): void {
    io.to(room.roomId).emit('room:peer-left', { socketId });
  }

  function destroyRoomIfEmpty(roomId: string): void {
    const room = rooms.get(roomId);
    if (room && room.members.size === 0) {
      rooms.delete(roomId);
    }
  }

  io.on('connection', (socket: Socket) => {
    socket.on(
      'room:create',
      ({ userName }: { userName: string }) => {
        const existingIds = new Set(rooms.keys());
        const roomId = generateRoomId(existingIds);
        const member: Member = {
          socketId: socket.id,
          userName,
          isMuted: false,
          joinedAt: Date.now()
        };
        const state: RoomState = {
          roomId,
          members: new Map([[socket.id, member]])
        };
        rooms.set(roomId, state);
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId);
        socket.emit('room:created', {
          roomId,
          members: Array.from(state.members.values())
        });
      }
    );

    socket.on(
      'room:join',
      ({ roomId, userName }: { roomId: string; userName: string }) => {
        const room = rooms.get(roomId);
        if (!room) {
          socket.emit('room:error', { message: `Room ${roomId} not found` });
          return;
        }
        const existing = room.members.get(socket.id);
        const member: Member = existing
          ? { ...existing, userName }
          : {
              socketId: socket.id,
              userName,
              isMuted: false,
              joinedAt: Date.now()
            };
        room.members.set(socket.id, member);
        socketToRoom.set(socket.id, roomId);
        socket.join(roomId);

        socket.emit('room:joined', {
          roomId,
          members: Array.from(room.members.values())
        });
        socket.to(roomId).emit('room:peer-joined', member);
      }
    );

    socket.on('room:leave', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.members.delete(socket.id);
      socketToRoom.delete(socket.id);
      socket.leave(roomId);
      broadcastPeerLeft(room, socket.id);
      destroyRoomIfEmpty(roomId);
    });

    socket.on(
      'rtc:signal',
      (payload: { targetId: string; signal: unknown }) => {
        io.to(payload.targetId).emit('rtc:signal', {
          fromId: socket.id,
          signal: payload.signal
        });
      }
    );

    socket.on('call:audio-started', () => {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socket.to(roomId).emit('call:audio-started', { socketId: socket.id });
      }
    });

    socket.on('call:peer-muted', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      const m = room?.members.get(socket.id);
      if (m) m.isMuted = true;
      socket.to(roomId).emit('call:peer-muted', { socketId: socket.id });
    });
    socket.on('call:peer-unmuted', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      const m = room?.members.get(socket.id);
      if (m) m.isMuted = false;
      socket.to(roomId).emit('call:peer-unmuted', { socketId: socket.id });
    });

    socket.on(
      'share:screen-started',
      (payload: { sourceName: string }) => {
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
          socket
            .to(roomId)
            .emit('share:screen-started', {
              socketId: socket.id,
              sourceName: payload.sourceName
            });
        }
      }
    );
    socket.on('share:screen-stopped', () => {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        socket
          .to(roomId)
          .emit('share:screen-stopped', { socketId: socket.id });
      }
    });

    socket.on(
      'song:started',
      (payload: { sourceName: string }) => {
        const roomId = socketToRoom.get(socket.id);
        if (roomId) {
          io.to(roomId).emit('song:started', {
            broadcasterSocketId: socket.id,
            sourceName: payload.sourceName
          });
        }
      }
    );
    socket.on('song:stopped', () => {
      const roomId = socketToRoom.get(socket.id);
      if (roomId) {
        io.to(roomId).emit('song:stopped', { socketId: socket.id });
      }
    });

    socket.on('disconnect', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.members.delete(socket.id);
      socketToRoom.delete(socket.id);
      broadcastPeerLeft(room, socket.id);
      destroyRoomIfEmpty(roomId);
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, '127.0.0.1', () => resolve());
  });

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  };

  return { httpServer, io, close, port, rooms };
}
