import { useEffect, useRef } from 'react';

interface RemoteAudioProps {
  remoteStream: MediaStream;
  volume?: number;
}

/**
 * Hidden <audio> element for a single remote peer. Chrome requires the
 * stream to be attached to an element that is actually in the DOM for the
 * remote track to be rendered through the default output device.
 */
export default function RemoteAudio({
  remoteStream,
  volume = 1
}: RemoteAudioProps): JSX.Element {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== remoteStream) {
      el.srcObject = remoteStream;
    }
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // Autoplay can be blocked on first page load — browser will retry
        // once any user interaction happens.
      });
    }
  }, [remoteStream]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);

  return <audio ref={ref} autoPlay playsInline style={{ display: 'none' }} />;
}
