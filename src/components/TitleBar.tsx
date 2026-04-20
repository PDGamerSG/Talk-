/**
 * Custom Windows-11-style title bar for the frameless BrowserWindow.
 * Drag behavior is driven by `-webkit-app-region: drag` on .titlebar
 * (buttons opt back out with `.titlebar__controls`).
 */
export default function TitleBar(): JSX.Element {
  const api = window.electronAPI;

  return (
    <header className="titlebar">
      <div className="titlebar__brand">
        <span className="titlebar__brand-dot" aria-hidden="true" />
        <span>Talk+</span>
      </div>

      <div className="titlebar__controls" aria-label="Window controls">
        <button
          className="titlebar__btn"
          onClick={() => api.minimize()}
          aria-label="Minimize"
          title="Minimize"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="0" y1="5" x2="10" y2="5" />
          </svg>
        </button>
        <button
          className="titlebar__btn"
          onClick={() => api.maximize()}
          aria-label="Maximize"
          title="Maximize"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="9" height="9" />
          </svg>
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={() => api.close()}
          aria-label="Close"
          title="Close"
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </header>
  );
}
