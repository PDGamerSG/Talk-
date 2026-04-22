import { useState } from 'react';
import { useRoomContext } from '../context/RoomContext';

export default function LobbyScreen(): JSX.Element {
  const { room } = useRoomContext();
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const disabled = name.trim().length === 0;

  return (
    <div
      className="lobby-bg"
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
          width: 440,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--accent)',
              letterSpacing: -0.5
            }}
          >
            Talk+
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 14,
              color: 'var(--text-muted)'
            }}
          >
            Talk, share, browse — together.
          </p>
        </div>

        <input
          className="input-field"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
        />

        <button
          className="button-primary"
          disabled={disabled}
          onClick={() => room.createRoom(name.trim())}
        >
          Create room
        </button>

        <div className="divider">or join existing</div>

        <input
          className="input-field"
          placeholder="ABC123"
          value={joinCode}
          maxLength={6}
          onChange={(e) =>
            setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
          }
          style={{
            textAlign: 'center',
            fontSize: 18,
            letterSpacing: 4,
            fontFamily: 'Consolas, "Cascadia Mono", monospace',
            textTransform: 'uppercase'
          }}
        />

        <button
          className="button-outline"
          disabled={disabled || joinCode.length !== 6}
          onClick={() => room.joinRoom(joinCode, name.trim())}
        >
          Join room
        </button>

        {room.error && (
          <p
            role="alert"
            style={{
              margin: 0,
              color: 'var(--danger)',
              fontSize: 12,
              textAlign: 'center'
            }}
          >
            {room.error}
          </p>
        )}
        {room.connectionStatus === 'joining' && (
          <p
            style={{
              margin: 0,
              color: 'var(--text-muted)',
              fontSize: 12,
              textAlign: 'center'
            }}
          >
            Connecting…
          </p>
        )}
      </div>
    </div>
  );
}
