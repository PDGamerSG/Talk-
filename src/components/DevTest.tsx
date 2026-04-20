import { useState } from 'react';
import { useRoom } from '../hooks/useRoom';

/**
 * Phase 2 developer scratchpad. Replaced by the real UI in Phase 7.
 */
export default function DevTest(): JSX.Element {
  const room = useRoom();
  const [name, setName] = useState('tester');
  const [joinId, setJoinId] = useState('');

  return (
    <div style={{ padding: 24, color: '#f0f0f4' }}>
      <h2>Talk+ Dev Test (Phase 2)</h2>
      <p>Status: {room.connectionStatus}</p>
      <p>Room: {room.roomId ?? '(none)'}</p>
      <p>Self socket: {room.selfSocketId ?? '(not connected)'}</p>
      <p>Members ({room.members.length}):</p>
      <ul>
        {room.members.map((m) => (
          <li key={m.socketId}>
            {m.userName} — {m.socketId}
          </li>
        ))}
      </ul>
      {room.error && (
        <p style={{ color: '#e5534b' }}>Error: {room.error}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
        <button onClick={() => room.createRoom(name)}>Create room</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          value={joinId}
          onChange={(e) => setJoinId(e.target.value.toUpperCase())}
          placeholder="Room code"
        />
        <button onClick={() => room.joinRoom(joinId, name)}>Join</button>
      </div>

      {room.roomId && (
        <button onClick={room.leaveRoom} style={{ marginTop: 16 }}>
          Leave
        </button>
      )}
    </div>
  );
}
