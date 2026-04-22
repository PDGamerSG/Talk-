import { useState } from 'react';
import { useRoomContext } from '../context/RoomContext';
import ParticipantTile from './ParticipantTile';

export default function Sidebar(): JSX.Element {
  const { room, activeModeType } = useRoomContext();
  const [copied, setCopied] = useState(false);

  const onCopy = async (): Promise<void> => {
    if (!room.roomId) return;
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const activeLabel =
    activeModeType === 'none'
      ? null
      : activeModeType === 'audio'
      ? 'Audio Call'
      : activeModeType === 'screen'
      ? 'Screen Share'
      : activeModeType === 'fullscreen'
      ? 'Full Screen'
      : activeModeType === 'song'
      ? 'Song Mode'
      : 'Co-Browser';

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-muted)'
          }}
        >
          Room
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '8px 10px'
          }}
        >
          <span
            style={{
              fontSize: 16,
              letterSpacing: 3,
              fontFamily: 'Consolas, monospace',
              flex: 1
            }}
          >
            {room.roomId ?? '—'}
          </span>
          <button
            onClick={onCopy}
            title="Copy room code"
            aria-label="Copy room code"
            style={{
              background: 'transparent',
              border: 'none',
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 12px 0', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            padding: '0 6px 6px'
          }}
        >
          Participants ({room.members.length})
        </span>
        <div
          style={{
            overflowY: 'auto',
            maxHeight: 'calc(100% - 40px)'
          }}
        >
          {room.members.map((m) => (
            <ParticipantTile
              key={m.socketId}
              member={m}
              isSelf={m.socketId === room.selfSocketId}
              peerManager={room.peerManager}
            />
          ))}
        </div>
      </div>

      {activeLabel && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--warning)'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              background: 'rgba(240, 164, 41, 0.12)',
              borderRadius: 999,
              border: '1px solid rgba(240, 164, 41, 0.3)'
            }}
          >
            {activeLabel}
          </span>
        </div>
      )}

      <div
        style={{
          padding: 12,
          borderTop: '1px solid var(--border)'
        }}
      >
        <button
          className="button-outline"
          style={{
            width: '100%',
            borderColor: 'var(--danger)',
            color: 'var(--danger)'
          }}
          onClick={() => room.leaveRoom()}
        >
          Leave room
        </button>
      </div>
    </aside>
  );
}
