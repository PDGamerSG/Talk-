import { useMemo } from 'react';

interface AudioControlsProps {
  isMicActive: boolean;
  isMuted: boolean;
  volume: number;
  deviceList: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  onToggleMute: () => void;
  onEndCall: () => void;
  onSelectDevice: (deviceId: string) => void;
}

/**
 * Primary audio call controls: mute toggle, end call, input device picker,
 * and a speaking ring that scales with local volume.
 */
export default function AudioControls({
  isMicActive,
  isMuted,
  volume,
  deviceList,
  selectedDeviceId,
  onToggleMute,
  onEndCall,
  onSelectDevice
}: AudioControlsProps): JSX.Element {
  const ringStyle = useMemo<React.CSSProperties>(
    () =>
      ({
        '--vol': volume.toFixed(3),
        outline: isMuted
          ? '2px solid #3a3a44'
          : `calc(2px + var(--vol) * 6px) solid #5b5bd6`,
        transition: 'outline 80ms ease',
        borderRadius: '50%'
      }) as React.CSSProperties & Record<'--vol', string>,
    [volume, isMuted]
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        background: '#161618',
        border: '1px solid #2a2a2e',
        borderRadius: 10
      }}
    >
      <div
        aria-label="Speaking indicator"
        style={{
          width: 40,
          height: 40,
          background: '#1e1e21',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...ringStyle
        }}
      >
        <MicIcon muted={isMuted} />
      </div>

      <button
        onClick={onToggleMute}
        disabled={!isMicActive}
        aria-pressed={isMuted}
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 8,
          background: isMuted ? '#e5534b' : '#1e1e21',
          color: '#f0f0f4',
          border: '1px solid #2a2a2e',
          cursor: isMicActive ? 'pointer' : 'not-allowed',
          opacity: isMicActive ? 1 : 0.6
        }}
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      <select
        value={selectedDeviceId ?? ''}
        onChange={(e) => onSelectDevice(e.target.value)}
        style={{
          height: 36,
          padding: '0 10px',
          borderRadius: 8,
          background: '#1e1e21',
          color: '#f0f0f4',
          border: '1px solid #2a2a2e',
          maxWidth: 220
        }}
      >
        <option value="">Default mic</option>
        {deviceList.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>

      <button
        onClick={onEndCall}
        disabled={!isMicActive}
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 8,
          background: '#e5534b',
          color: '#ffffff',
          border: 'none',
          cursor: isMicActive ? 'pointer' : 'not-allowed',
          marginLeft: 'auto',
          opacity: isMicActive ? 1 : 0.6
        }}
      >
        End call
      </button>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill={muted ? 'none' : 'currentColor'}
        fillOpacity={muted ? 0 : 0.18}
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {muted && (
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke="#e5534b"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
