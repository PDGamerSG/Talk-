import WaveformVisualiser from './WaveformVisualiser';

interface SongModeBarProps {
  visible: boolean;
  broadcasterName: string;
  sourceName: string;
  isSelfBroadcaster: boolean;
  audioStream: MediaStream | null;
  onStop: () => void;
}

/**
 * Bottom bar shown to every participant while Song Mode is active.
 * Listener side receives audioStream = null (their AudioContext cannot
 * reach the encoded remote track here) and the waveform degrades to the
 * static fallback. The broadcaster side passes their loopback stream.
 */
export default function SongModeBar({
  visible,
  broadcasterName,
  sourceName,
  isSelfBroadcaster,
  audioStream,
  onStop
}: SongModeBarProps): JSX.Element | null {
  if (!visible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 52,
        padding: '0 16px',
        background: '#161618',
        borderTop: '1px solid #2a2a2e',
        color: '#f0f0f4',
        fontSize: 13
      }}
    >
      <style>
        {`@keyframes talk-eq-bounce {
            0%, 100% { transform: scaleY(0.3); }
            50%      { transform: scaleY(1); }
          }`}
      </style>

      <div
        aria-hidden="true"
        style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 3,
              height: 22,
              background: '#5b5bd6',
              borderRadius: 2,
              transformOrigin: 'bottom',
              animation: `talk-eq-bounce ${700 + i * 130}ms ease-in-out ${
                i * 80
              }ms infinite`
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>
          <strong>{broadcasterName}</strong> is sharing:{' '}
          <span style={{ color: '#b6baff' }}>{sourceName}</span>
        </span>
        <WaveformVisualiser audioStream={audioStream} />
      </div>

      {isSelfBroadcaster && (
        <button
          onClick={onStop}
          style={{
            padding: '6px 14px',
            background: '#e5534b',
            border: 'none',
            borderRadius: 6,
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          Stop
        </button>
      )}
    </div>
  );
}
