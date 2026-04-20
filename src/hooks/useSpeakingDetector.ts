import { useEffect, useRef, useState } from 'react';

interface UseSpeakingDetectorResult {
  isSpeaking: boolean;
  volume: number;
}

const SPEAKING_THRESHOLD = 0.02;
const POLL_INTERVAL_MS = 50;

/**
 * Derives a speaking flag + 0..1 volume from a MediaStream.
 *
 * Uses an AnalyserNode on the time-domain data (not frequency). RMS over
 * the buffer gives a clean amplitude proxy that is stable enough to power
 * a speaking ring without stuttering.
 */
export function useSpeakingDetector(
  stream: MediaStream | null
): UseSpeakingDetectorResult {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setIsSpeaking(false);
      setVolume(0);
      return;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let rafId = 0;
    let cancelled = false;

    const tick = (ts: number): void => {
      if (cancelled) return;
      rafId = requestAnimationFrame(tick);
      if (ts - lastTickRef.current < POLL_INTERVAL_MS) return;
      lastTickRef.current = ts;

      analyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        sumSquares += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const clipped = Math.min(1, rms * 4);
      setVolume(clipped);
      setIsSpeaking(rms > SPEAKING_THRESHOLD);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      source.disconnect();
      void ctx.close();
    };
  }, [stream]);

  return { isSpeaking, volume };
}
