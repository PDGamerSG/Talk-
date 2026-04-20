interface ShareBannerProps {
  sourceName: string;
  onStop: () => void;
}

export default function ShareBanner({
  sourceName,
  onStop
}: ShareBannerProps): JSX.Element {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#2d1a1a',
        color: '#ff6b6b',
        borderBottom: '1px solid #3a1f1f',
        animation: 'talk-banner-slide 220ms ease-out both',
        fontSize: 13
      }}
    >
      <style>
        {`@keyframes talk-banner-slide {
            from { transform: translateY(-100%); opacity: 0; }
            to   { transform: translateY(0);     opacity: 1; }
          }`}
      </style>
      <span>
        <strong style={{ marginRight: 6 }}>Sharing:</strong>
        {sourceName}
      </span>
      <button
        onClick={onStop}
        style={{
          padding: '4px 12px',
          background: 'transparent',
          border: '1px solid #ff6b6b',
          borderRadius: 6,
          color: '#ff6b6b',
          cursor: 'pointer'
        }}
      >
        Stop sharing
      </button>
    </div>
  );
}
