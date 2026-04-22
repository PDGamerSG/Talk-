import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { useRoom } from '../hooks/useRoom';
import { useAudioCall } from '../hooks/useAudioCall';
import { useScreenShare } from '../hooks/useScreenShare';
import { useFullScreenShare } from '../hooks/useFullScreenShare';
import { useSongMode } from '../hooks/useSongMode';
import { useCoBrowser } from '../hooks/useCoBrowser';
import type { ActiveModeType } from '../types/room';

type RoomApi = ReturnType<typeof useRoom>;
type AudioApi = ReturnType<typeof useAudioCall>;
type ScreenApi = ReturnType<typeof useScreenShare>;
type FullScreenApi = ReturnType<typeof useFullScreenShare>;
type SongApi = ReturnType<typeof useSongMode>;
type CoBrowserApi = ReturnType<typeof useCoBrowser>;

interface RoomContextValue {
  room: RoomApi;
  audio: AudioApi;
  screen: ScreenApi;
  fullscreen: FullScreenApi;
  song: SongApi;
  cobrowser: CoBrowserApi;
  activeModeType: ActiveModeType;
  setActiveMode: (type: ActiveModeType) => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({
  children
}: {
  children: ReactNode;
}): JSX.Element {
  const room = useRoom();
  const audio = useAudioCall({ peerManager: room.peerManager });
  const screen = useScreenShare({ peerManager: room.peerManager });
  const fullscreen = useFullScreenShare({ peerManager: room.peerManager });
  const song = useSongMode({ peerManager: room.peerManager });
  const cobrowser = useCoBrowser();

  const [activeModeType, setActiveModeType] = useState<ActiveModeType>('none');

  const setActiveMode = useCallback(
    async (type: ActiveModeType) => {
      // Stop whatever is currently running before switching. Audio is a
      // special case — it can run alongside any visual mode.
      if (activeModeType === 'screen' && type !== 'screen') {
        screen.stopShare();
      }
      if (activeModeType === 'fullscreen' && type !== 'fullscreen') {
        fullscreen.stopShare();
      }
      if (activeModeType === 'song' && type !== 'song') {
        song.stopSongMode();
      }
      if (activeModeType === 'cobrowser' && type !== 'cobrowser') {
        cobrowser.stopCoBrowser();
      }
      if (activeModeType === 'audio' && type !== 'audio') {
        audio.stopCall();
      }

      setActiveModeType(type);
      if (type === 'audio') {
        await audio.startCall();
      }
    },
    [activeModeType, audio, screen, fullscreen, song, cobrowser]
  );

  const value = useMemo<RoomContextValue>(
    () => ({
      room,
      audio,
      screen,
      fullscreen,
      song,
      cobrowser,
      activeModeType,
      setActiveMode
    }),
    [
      room,
      audio,
      screen,
      fullscreen,
      song,
      cobrowser,
      activeModeType,
      setActiveMode
    ]
  );

  return (
    <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
  );
}

export function useRoomContext(): RoomContextValue {
  const ctx = useContext(RoomContext);
  if (!ctx) {
    throw new Error('useRoomContext must be used inside a RoomProvider');
  }
  return ctx;
}
