import { useState } from 'react';
import { useRoomContext } from '../context/RoomContext';
import ScreenSharePicker from './ScreenSharePicker';
import SongModePicker from './SongModePicker';
import type { ActiveModeType } from '../types/room';

interface ModeEntry {
  type: ActiveModeType | 'leave';
  label: string;
  Icon: () => JSX.Element;
}

const ENTRIES: ModeEntry[] = [
  { type: 'audio', label: 'Mic', Icon: MicIcon },
  { type: 'screen', label: 'Screen', Icon: MonitorIcon },
  { type: 'fullscreen', label: 'Full Screen', Icon: ExpandIcon },
  { type: 'song', label: 'Song Mode', Icon: MusicIcon },
  { type: 'cobrowser', label: 'Co-Browser', Icon: GlobeIcon },
  { type: 'leave', label: 'Leave', Icon: PhoneOffIcon }
];

export default function ModeBar(): JSX.Element {
  const {
    activeModeType,
    setActiveMode,
    room,
    audio,
    screen,
    fullscreen,
    song,
    cobrowser
  } = useRoomContext();

  const [screenPickerOpen, setScreenPickerOpen] = useState(false);
  const [fullscreenPickerOpen, setFullscreenPickerOpen] = useState(false);
  const [songPickerOpen, setSongPickerOpen] = useState(false);

  const onClick = async (type: ModeEntry['type']): Promise<void> => {
    if (type === 'leave') {
      room.leaveRoom();
      return;
    }
    if (type === 'audio') {
      if (activeModeType === 'audio') {
        audio.toggleMute();
      } else {
        await setActiveMode('audio');
      }
      return;
    }
    if (type === 'screen') {
      if (screen.isSharing) {
        screen.stopShare();
        await setActiveMode('none');
      } else {
        setScreenPickerOpen(true);
      }
      return;
    }
    if (type === 'fullscreen') {
      if (fullscreen.isSharing) {
        fullscreen.stopShare();
        await setActiveMode('none');
      } else {
        setFullscreenPickerOpen(true);
      }
      return;
    }
    if (type === 'song') {
      if (song.isBroadcasting) {
        song.stopSongMode();
        await setActiveMode('none');
      } else {
        setSongPickerOpen(true);
      }
      return;
    }
    if (type === 'cobrowser') {
      if (cobrowser.isActive) {
        cobrowser.stopCoBrowser();
        await setActiveMode('none');
      } else {
        await setActiveMode('cobrowser');
        cobrowser.startCoBrowser('https://duckduckgo.com');
      }
    }
  };

  return (
    <>
      <div
        style={{
          height: 56,
          flexShrink: 0,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '0 16px'
        }}
      >
        {ENTRIES.map((e) => {
          const isLeave = e.type === 'leave';
          const isActive =
            e.type === 'audio'
              ? audio.isMicActive
              : e.type === 'screen'
              ? screen.isSharing
              : e.type === 'fullscreen'
              ? fullscreen.isSharing
              : e.type === 'song'
              ? song.isBroadcasting
              : e.type === 'cobrowser'
              ? cobrowser.isActive
              : false;

          const isMuted = e.type === 'audio' && audio.isMuted;
          const bg = isLeave
            ? 'transparent'
            : isActive
            ? 'var(--accent)'
            : 'transparent';
          const color = isLeave
            ? 'var(--danger)'
            : isActive
            ? '#ffffff'
            : 'var(--text-muted)';

          return (
            <button
              key={e.type}
              onClick={() => void onClick(e.type)}
              style={{
                width: 80,
                height: 40,
                borderRadius: 8,
                background: bg,
                color,
                border: isLeave
                  ? '1px solid var(--danger)'
                  : '1px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                transition: 'background-color 120ms ease, color 120ms ease'
              }}
              onMouseEnter={(ev) => {
                if (!isActive && !isLeave) {
                  ev.currentTarget.style.background = 'var(--bg-elevated)';
                  ev.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(ev) => {
                if (!isActive && !isLeave) {
                  ev.currentTarget.style.background = 'transparent';
                  ev.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <e.Icon />
              <span style={{ fontSize: 11 }}>
                {e.type === 'audio' && isMuted ? 'Muted' : e.label}
              </span>
            </button>
          );
        })}
      </div>

      <ScreenSharePicker
        open={screenPickerOpen}
        onClose={() => setScreenPickerOpen(false)}
        onPickWindow={(id, name) => {
          setScreenPickerOpen(false);
          void setActiveMode('screen');
          void screen.startShare(id, name);
        }}
        onPickMonitor={(id, name) => {
          setScreenPickerOpen(false);
          void setActiveMode('screen');
          void screen.startShare(id, name);
        }}
      />
      <ScreenSharePicker
        open={fullscreenPickerOpen}
        onClose={() => setFullscreenPickerOpen(false)}
        onPickWindow={(id, name) => {
          setFullscreenPickerOpen(false);
          void setActiveMode('fullscreen');
          void fullscreen.startShare(id, name);
        }}
        onPickMonitor={(id, name) => {
          setFullscreenPickerOpen(false);
          void setActiveMode('fullscreen');
          void fullscreen.startShare(id, name);
        }}
      />
      <SongModePicker
        open={songPickerOpen}
        onClose={() => setSongPickerOpen(false)}
        onStart={(id, name) => {
          setSongPickerOpen(false);
          void setActiveMode('song');
          void song.startSongMode(id, name);
        }}
      />
    </>
  );
}

// ---------- inline SVG icon components ----------
function MicIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MonitorIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="4"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ExpandIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function MusicIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 18V5l12-2v13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function GlobeIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
function PhoneOffIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M22 16.92a15.7 15.7 0 0 1-4.44 2.14 3 3 0 0 1-3.13-.74l-1.27-1.27M2 2l20 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M5 5a2 2 0 0 1 2-2h2l2 5-2 2a11 11 0 0 0 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
