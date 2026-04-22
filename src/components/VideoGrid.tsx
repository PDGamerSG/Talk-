import { useMemo } from 'react';
import { useRoomContext } from '../context/RoomContext';
import ScreenShareViewer from './ScreenShareViewer';
import CoBrowserPanel from './CoBrowserPanel';
import CoBrowserControls from './CoBrowserControls';
import WaveformVisualiser from './WaveformVisualiser';
import { useSpeakingDetector } from '../hooks/useSpeakingDetector';

const AVATAR_PALETTE = [
  '#c4a7e7',
  '#ea9d97',
  '#9cc4e4',
  '#a5d6a7',
  '#ffcc80',
  '#b39ddb',
  '#80cbc4',
  '#f48fb1'
];

function hashToIndex(name: string, size: number): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % size;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function VideoGrid(): JSX.Element {
  const { activeModeType, room, audio, screen, fullscreen, song, cobrowser } =
    useRoomContext();

  const { volume } = useSpeakingDetector(audio.localStream);

  // Find the first visible remote video stream (screen or fullscreen share
  // from another peer). We only ever render one visual share at a time.
  const remoteSharePresenter = useMemo(() => {
    for (const [socketId, stream] of room.remoteStreams.entries()) {
      if (stream.getVideoTracks().length > 0) {
        const member = room.members.find((m) => m.socketId === socketId);
        if (member) return { stream, member };
      }
    }
    return null;
  }, [room.remoteStreams, room.members]);

  if (activeModeType === 'screen' || activeModeType === 'fullscreen') {
    const shareStream = screen.isSharing
      ? screen.screenStream
      : fullscreen.isSharing
      ? fullscreen.screenStream
      : remoteSharePresenter?.stream ?? null;
    const presenterName = screen.isSharing
      ? `${room.userName} (you)`
      : fullscreen.isSharing
      ? `${room.userName} (you)`
      : remoteSharePresenter?.member.userName;

    return (
      <div style={{ flex: 1, padding: 16, display: 'flex', minHeight: 0 }}>
        <ScreenShareViewer
          videoStream={shareStream}
          presenterName={presenterName}
        />
      </div>
    );
  }

  if (activeModeType === 'cobrowser') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <CoBrowserControls
          currentUrl={cobrowser.currentUrl}
          pageTitle={cobrowser.pageTitle}
          isLoading={cobrowser.isLoading}
          onNavigate={cobrowser.navigate}
          onBack={cobrowser.back}
          onForward={cobrowser.forward}
          onReload={cobrowser.reload}
          onStop={cobrowser.stopCoBrowser}
        />
        <CoBrowserPanel
          frameDataUrl={cobrowser.frameDataUrl}
          isActive={cobrowser.isActive}
          onStart={cobrowser.startCoBrowser}
          sendMouseMove={cobrowser.sendMouseMove}
          sendMouseClick={cobrowser.sendMouseClick}
          sendScroll={cobrowser.sendScroll}
          sendKeypress={cobrowser.sendKeypress}
          sendType={cobrowser.sendType}
        />
      </div>
    );
  }

  if (activeModeType === 'song') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            minWidth: 360
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>
            {song.sourceName ?? 'Song Mode'}
          </h2>
          <p
            style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 13
            }}
          >
            {song.isBroadcasting
              ? 'Broadcasting to the room…'
              : 'Listening…'}
          </p>
          <WaveformVisualiser
            audioStream={song.audioStream}
            width={280}
            height={60}
          />
          {song.silenceWarning && (
            <p
              style={{
                margin: 0,
                color: 'var(--warning)',
                fontSize: 12,
                textAlign: 'center'
              }}
            >
              No audio detected — make sure the app is actually playing.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Default: participant grid.
  return (
    <div
      style={{
        flex: 1,
        padding: 32,
        overflow: 'auto'
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 24
        }}
      >
        {room.members.map((m) => {
          const isSelf = m.socketId === room.selfSocketId;
          const bg =
            AVATAR_PALETTE[hashToIndex(m.userName, AVATAR_PALETTE.length)];
          const speakingScale = isSelf ? volume : 0;
          return (
            <div
              key={m.socketId}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10
              }}
            >
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: bg,
                  color: '#1c1c21',
                  fontSize: 32,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    speakingScale > 0.05
                      ? `0 0 0 ${2 + speakingScale * 8}px var(--accent), 0 0 0 ${
                          6 + speakingScale * 8
                        }px rgba(91, 91, 214, 0.2)`
                      : isSelf && audio.isMicActive && !audio.isMuted
                      ? '0 0 0 2px rgba(91, 91, 214, 0.4)'
                      : 'none',
                  transition: 'box-shadow 100ms ease'
                }}
              >
                {initialsOf(m.userName)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--text-primary)'
                }}
              >
                {m.userName}
                {isSelf && (
                  <span
                    style={{
                      marginLeft: 4,
                      color: 'var(--text-muted)',
                      fontSize: 11
                    }}
                  >
                    (you)
                  </span>
                )}
              </div>
              {m.isMuted && (
                <span style={{ fontSize: 11, color: 'var(--danger)' }}>
                  Muted
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
