import { useMemo } from 'react';
import type { Member } from '../types/room';
import type { PeerManager } from '../lib/PeerManager';
import ConnectionQualityDot from './ConnectionQualityDot';

interface ParticipantTileProps {
  member: Member;
  isSelf: boolean;
  isSpeaking?: boolean;
  peerManager: PeerManager;
}

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
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % size;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function ParticipantTile({
  member,
  isSelf,
  isSpeaking,
  peerManager
}: ParticipantTileProps): JSX.Element {
  const avatarBg = useMemo(
    () => AVATAR_PALETTE[hashToIndex(member.userName, AVATAR_PALETTE.length)],
    [member.userName]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        background: 'transparent'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: avatarBg,
          color: '#1c1c21',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: isSpeaking
            ? '0 0 0 2px var(--accent), 0 0 0 4px rgba(91, 91, 214, 0.2)'
            : 'none',
          transition: 'box-shadow 100ms ease'
        }}
      >
        {initialsOf(member.userName)}
        {member.isMuted && (
          <span
            aria-label="Muted"
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              color: 'var(--danger)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10">
              <line
                x1="1"
                y1="1"
                x2="9"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {member.userName}
          {isSelf && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                color: 'var(--text-muted)'
              }}
            >
              (you)
            </span>
          )}
        </div>
      </div>

      {!isSelf && (
        <ConnectionQualityDot
          peerManager={peerManager}
          socketId={member.socketId}
        />
      )}
    </div>
  );
}
