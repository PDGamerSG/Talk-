export interface Member {
  socketId: string;
  userName: string;
  isMuted: boolean;
  joinedAt: number;
}

export type ConnectionStatus = 'idle' | 'joining' | 'joined' | 'error';

export type ActiveModeType =
  | 'none'
  | 'audio'
  | 'screen'
  | 'fullscreen'
  | 'song'
  | 'cobrowser';

export interface SongModeState {
  active: boolean;
  broadcasterSocketId: string | null;
  sourceName: string | null;
}

export interface SourceInfo {
  id: string;
  name: string;
  thumbnailDataURL: string;
  appIconDataURL: string | null;
  type: 'window' | 'screen';
}
