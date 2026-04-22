import { useEffect, useState } from 'react';
import type { PeerManager, PeerStats } from '../lib/PeerManager';

interface ConnectionQualityDotProps {
  peerManager: PeerManager;
  socketId: string;
}

type Quality = 'good' | 'ok' | 'bad';

function classifyQuality(stats: PeerStats): Quality {
  const lossRatio = stats.packetsLost / Math.max(100, stats.packetsLost + 100);
  if (lossRatio > 0.1 || stats.roundTripTime > 300) return 'bad';
  if (lossRatio > 0.02 || stats.roundTripTime > 100) return 'ok';
  return 'good';
}

export default function ConnectionQualityDot({
  peerManager,
  socketId
}: ConnectionQualityDotProps): JSX.Element {
  const [stats, setStats] = useState<PeerStats>({
    packetsLost: 0,
    roundTripTime: 0
  });

  useEffect(() => {
    let cancelled = false;
    const tick = async (): Promise<void> => {
      const s = await peerManager.getStats(socketId);
      if (!cancelled) setStats(s);
    };
    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [peerManager, socketId]);

  const quality = classifyQuality(stats);
  const color =
    quality === 'good'
      ? 'var(--success)'
      : quality === 'ok'
      ? 'var(--warning)'
      : 'var(--danger)';

  const lossPct = (
    (stats.packetsLost / Math.max(1, stats.packetsLost + 100)) *
    100
  ).toFixed(1);

  return (
    <span
      title={`RTT: ${Math.round(stats.roundTripTime)}ms, loss: ${lossPct}%`}
      aria-label={`Connection quality ${quality}`}
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        flexShrink: 0
      }}
    />
  );
}
