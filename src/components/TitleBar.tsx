/**
 * Windows-11 style custom title bar for the frameless BrowserWindow.
 * Drag behaviour is CSS-driven; buttons opt out with `no-drag`.
 */
export default function TitleBar(): JSX.Element {
  const api = window.electronAPI;

  return (
    <header
      style={{
        WebkitAppRegion: 'drag',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 32,
        background: 'var(--bg-base)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0
      } as React.CSSProperties}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.2
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: 4,
            background:
              'linear-gradient(135deg, #6aa9ff 0%, #5b5bd6 60%, #b06aff 100%)'
          }}
        />
        <span>Talk+</span>
      </div>

      <div
        style={{
          WebkitAppRegion: 'no-drag',
          display: 'flex',
          height: '100%'
        } as React.CSSProperties}
      >
        <TitleBarButton onClick={() => api.minimize()} label="Minimize">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" />
          </svg>
        </TitleBarButton>
        <TitleBarButton onClick={() => api.maximize()} label="Maximize">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
            />
          </svg>
        </TitleBarButton>
        <TitleBarButton onClick={() => api.close()} label="Close" danger>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" />
          </svg>
        </TitleBarButton>
      </div>
    </header>
  );
}

function TitleBarButton({
  onClick,
  label,
  danger,
  children
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? 'var(--danger)'
          : 'rgba(255, 255, 255, 0.08)';
        e.currentTarget.style.color = danger ? '#ffffff' : 'inherit';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = '';
      }}
      style={{
        width: 46,
        height: 32,
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 120ms ease'
      }}
    >
      {children}
    </button>
  );
}
