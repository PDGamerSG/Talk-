import { useEffect, useRef } from 'react';

interface ScreenShareViewerProps {
  videoStream: MediaStream | null;
  presenterName?: string;
}

export default function ScreenShareViewer({
  videoStream,
  presenterName
}: ScreenShareViewerProps): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== videoStream) {
      el.srcObject = videoStream;
    }
  }, [videoStream]);

  if (!videoStream) {
    return (
      <div
        style={{
          flex: 1,
          border: '1px dashed #2a2a2e',
          borderRadius: 10,
          background: '#0f0f10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8b8b93',
          minHeight: 240
        }}
      >
        Waiting for screen share…
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        background: '#000',
        borderRadius: 10,
        overflow: 'hidden',
        minHeight: 240
      }}
    >
      <video
        ref={ref}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#000'
        }}
      />
      {presenterName && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '4px 10px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#f0f0f4',
            fontSize: 12,
            borderRadius: 6
          }}
        >
          {presenterName}
        </div>
      )}
    </div>
  );
}
