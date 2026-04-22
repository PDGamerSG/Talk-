import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import ModeBar from './components/ModeBar';
import ShareBanner from './components/ShareBanner';
import SongModeBar from './components/SongModeBar';
import RemoteAudio from './components/RemoteAudio';
import LobbyScreen from './screens/LobbyScreen';
import { RoomProvider, useRoomContext } from './context/RoomContext';

export default function App(): JSX.Element {
  return (
    <RoomProvider>
      <div className="app-shell">
        <TitleBar />
        <main className="content" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <AppBody />
        </main>
      </div>
    </RoomProvider>
  );
}

function AppBody(): JSX.Element {
  const { room } = useRoomContext();
  if (room.connectionStatus !== 'joined' || !room.roomId) {
    return <LobbyScreen />;
  }
  return <RoomShell />;
}

function RoomShell(): JSX.Element {
  const { room, screen, fullscreen, song } = useRoomContext();

  const localShare = screen.isSharing
    ? { name: screen.sourceName ?? 'Screen', stop: screen.stopShare }
    : fullscreen.isSharing
    ? { name: fullscreen.sourceName ?? 'Screen', stop: fullscreen.stopShare }
    : null;

  const broadcaster =
    room.songMode.active && room.songMode.broadcasterSocketId
      ? room.members.find(
          (m) => m.socketId === room.songMode.broadcasterSocketId
        )
      : null;
  const isSelfBroadcaster =
    !!broadcaster && broadcaster.socketId === room.selfSocketId;

  const remoteAudioEntries: [string, MediaStream][] = [];
  for (const [socketId, stream] of room.remoteStreams.entries()) {
    if (stream.getAudioTracks().length > 0) {
      remoteAudioEntries.push([socketId, stream]);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0
        }}
      >
        {localShare && (
          <ShareBanner sourceName={localShare.name} onStop={localShare.stop} />
        )}
        <VideoGrid />
        <SongModeBar
          visible={room.songMode.active}
          broadcasterName={broadcaster?.userName ?? 'Someone'}
          sourceName={room.songMode.sourceName ?? ''}
          isSelfBroadcaster={isSelfBroadcaster}
          audioStream={isSelfBroadcaster ? song.audioStream : null}
          onStop={song.stopSongMode}
        />
        <ModeBar />
      </div>
      {remoteAudioEntries.map(([id, stream]) => (
        <RemoteAudio key={id} remoteStream={stream} />
      ))}
    </div>
  );
}
