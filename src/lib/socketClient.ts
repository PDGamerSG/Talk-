import { io, type Socket } from 'socket.io-client';

interface RejoinState {
  roomId: string;
  userName: string;
}

/**
 * Singleton Socket.io client wrapper.
 *
 * The renderer never talks to the Electron main process for room state —
 * it talks to the embedded Socket.io server (spawned by main) over localhost.
 * We keep a single connection for the lifetime of the app and re-join the
 * active room transparently after a reconnect.
 */
class SocketClient {
  private socket: Socket | null = null;
  private port: number | null = null;
  private rejoinState: RejoinState | null = null;

  connect(port: number): Socket {
    if (this.socket && this.socket.connected && this.port === port) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.port = port;
    this.socket = io(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      timeout: 8000
    });

    // On every successful (re)connect, transparently restore the active room.
    this.socket.on('connect', () => {
      if (this.rejoinState && this.socket) {
        this.socket.emit('room:join', this.rejoinState);
      }
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.port = null;
    this.rejoinState = null;
  }

  getSocket(): Socket {
    if (!this.socket) {
      throw new Error('SocketClient: not connected — call connect(port) first');
    }
    return this.socket;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.connected;
  }

  /** Remember the current room so we can auto-rejoin after reconnect. */
  setRejoinState(state: RejoinState | null): void {
    this.rejoinState = state;
  }

  getRejoinState(): RejoinState | null {
    return this.rejoinState;
  }
}

export const socketClient = new SocketClient();
export type { Socket };
