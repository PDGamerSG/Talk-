import { useEffect, useRef } from 'react';

interface WaveformVisualiserProps {
  audioStream: MediaStream | null;
  width?: number;
  height?: number;
}

/**
 * Bar-style frequency visualiser. Falls back to a static flat line when no
 * stream is attached (listener side with no loopback access, etc.).
 */
export default function WaveformVisualiser({
  audioStream,
  width = 120,
  height = 28
}: WaveformVisualiserProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Static placeholder line.
    const drawFlat = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2a2a2e';
      const y = canvas.height / 2;
      ctx.fillRect(0, y - 1, canvas.width, 2);
    };

    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      drawFlat();
      return;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const audioCtx = new AudioCtx();
    const source = audioCtx.createMediaStreamSource(audioStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128; // 64 bins
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    let rafId = 0;
    let cancelled = false;

    const render = (): void => {
      if (cancelled) return;
      rafId = requestAnimationFrame(render);
      analyser.getByteFrequencyData(freqData);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bars = 32;
      const barWidth = canvas.width / bars;
      ctx.fillStyle = '#5b5bd6';
      for (let i = 0; i < bars; i++) {
        const binIdx = i * 2; // every other bin
        const v = freqData[binIdx] / 255;
        const h = Math.max(1, v * canvas.height);
        ctx.fillRect(
          i * barWidth + 0.5,
          canvas.height - h,
          Math.max(1, barWidth - 1.5),
          h
        );
      }
    };

    render();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      source.disconnect();
      void audioCtx.close();
    };
  }, [audioStream]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block' }}
    />
  );
}
