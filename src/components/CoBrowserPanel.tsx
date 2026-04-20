import { useCallback, useEffect, useRef, useState } from 'react';

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const SPECIAL_KEYS = new Set([
  'Enter',
  'Backspace',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Escape',
  'F5',
  'Delete',
  'Home',
  'End',
  'PageUp',
  'PageDown'
]);
const MOUSE_MOVE_THROTTLE_MS = 40;

interface CoBrowserPanelProps {
  frameDataUrl: string | null;
  isActive: boolean;
  onStart: (url: string) => void;
  sendMouseMove: (x: number, y: number, scaleX: number, scaleY: number) => void;
  sendMouseClick: (
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    button: 'left' | 'right'
  ) => void;
  sendScroll: (deltaX: number, deltaY: number) => void;
  sendKeypress: (key: string) => void;
  sendType: (text: string) => void;
}

export default function CoBrowserPanel({
  frameDataUrl,
  isActive,
  onStart,
  sendMouseMove,
  sendMouseClick,
  sendScroll,
  sendKeypress,
  sendType
}: CoBrowserPanelProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastMoveRef = useRef(0);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Draw incoming frames onto the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !frameDataUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reuse the Image object across frames to avoid allocator churn.
    let img = imgRef.current;
    if (!img) {
      img = new Image();
      imgRef.current = img;
    }
    img.onload = () => {
      ctx.drawImage(img as HTMLImageElement, 0, 0, canvas.width, canvas.height);
    };
    img.src = frameDataUrl;
  }, [frameDataUrl]);

  // Keep canvas bitmap size synced to its client size for crisp rendering.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = (): void => {
      const { clientWidth, clientHeight } = canvas;
      if (canvas.width !== clientWidth) canvas.width = clientWidth;
      if (canvas.height !== clientHeight) canvas.height = clientHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const computeScale = useCallback((): { scaleX: number; scaleY: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { scaleX: 1, scaleY: 1 };
    return {
      scaleX: VIEWPORT_WIDTH / canvas.clientWidth,
      scaleY: VIEWPORT_HEIGHT / canvas.clientHeight
    };
  }, []);

  const handleMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement>
  ): void => {
    const now = performance.now();
    if (now - lastMoveRef.current < MOUSE_MOVE_THROTTLE_MS) return;
    lastMoveRef.current = now;
    const rect = e.currentTarget.getBoundingClientRect();
    const { scaleX, scaleY } = computeScale();
    sendMouseMove(e.clientX - rect.left, e.clientY - rect.top, scaleX, scaleY);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>): void => {
    setHasInteracted(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const { scaleX, scaleY } = computeScale();
    sendMouseClick(
      e.clientX - rect.left,
      e.clientY - rect.top,
      scaleX,
      scaleY,
      e.button === 2 ? 'right' : 'left'
    );
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>): void => {
    e.preventDefault();
    sendScroll(e.deltaX, e.deltaY * 3);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>): void => {
    if (SPECIAL_KEYS.has(e.key)) {
      e.preventDefault();
      sendKeypress(e.key);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLCanvasElement>): void => {
    if (e.key.length === 1) {
      e.preventDefault();
      sendType(e.key);
    }
  };

  if (!isActive) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          background: '#0f0f10',
          color: '#8b8b93',
          borderRadius: 10,
          border: '1px dashed #2a2a2e'
        }}
      >
        <p>Co-browser not started.</p>
        <button
          onClick={() => onStart('https://duckduckgo.com')}
          style={{
            padding: '8px 18px',
            background: '#5b5bd6',
            border: 'none',
            borderRadius: 8,
            color: '#ffffff',
            cursor: 'pointer'
          }}
        >
          Start co-browser
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, background: '#000' }}>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onKeyPress={handleKeyPress}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'crosshair',
          outline: 'none'
        }}
      />
      {!hasInteracted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f0f0f4',
            background: 'rgba(0, 0, 0, 0.35)',
            pointerEvents: 'none',
            fontSize: 14,
            animation: 'talk-fade 300ms ease-out both'
          }}
        >
          Click to control
        </div>
      )}
    </div>
  );
}
