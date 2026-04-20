import { useEffect, useMemo, useState } from 'react';
import type { SourceInfo } from '../types/room';

interface ScreenSharePickerProps {
  open: boolean;
  onClose: () => void;
  onPickWindow: (sourceId: string, sourceName: string) => void;
  onPickMonitor: (sourceId: string, sourceName: string) => void;
}

type Tab = 'windows' | 'monitors';

function truncate(name: string, max = 28): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export default function ScreenSharePicker({
  open,
  onClose,
  onPickWindow,
  onPickMonitor
}: ScreenSharePickerProps): JSX.Element | null {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [tab, setTab] = useState<Tab>('windows');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.electronAPI
      .getScreenSources()
      .then((list) => {
        if (cancelled) return;
        setSources(list as SourceInfo[]);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Failed to enumerate sources.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const windows = useMemo(
    () =>
      sources
        .filter((s) => s.type === 'window')
        .filter((s) =>
          s.name.toLowerCase().includes(query.trim().toLowerCase())
        ),
    [sources, query]
  );

  const monitors = useMemo(
    () =>
      sources
        .filter((s) => s.type === 'screen')
        .map((s, idx) => ({ ...s, label: `Monitor ${idx + 1}` })),
    [sources]
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxHeight: '80vh',
          background: '#161618',
          border: '1px solid #2a2a2e',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          color: '#f0f0f4'
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Share your screen</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8b8b93',
              fontSize: 20,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </header>

        <div style={{ display: 'flex', gap: 4 }}>
          {(['windows', 'monitors'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: tab === t ? '#5b5bd6' : '#1e1e21',
                border: '1px solid #2a2a2e',
                borderRadius: 8,
                color: tab === t ? '#ffffff' : '#8b8b93',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'windows' && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search windows…"
            style={{
              padding: '8px 10px',
              background: '#1e1e21',
              border: '1px solid #2a2a2e',
              borderRadius: 8,
              color: '#f0f0f4'
            }}
          />
        )}

        <div style={{ overflowY: 'auto', maxHeight: '50vh' }}>
          {loading && (
            <p style={{ color: '#8b8b93' }}>Loading sources…</p>
          )}
          {error && <p style={{ color: '#e5534b' }}>{error}</p>}

          {!loading && tab === 'windows' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12
              }}
            >
              {windows.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPickWindow(s.id, s.name)}
                  style={{
                    padding: 10,
                    background: '#1e1e21',
                    border: '1px solid #2a2a2e',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#f0f0f4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <img
                    src={s.thumbnailDataURL}
                    alt=""
                    style={{
                      width: '100%',
                      height: 110,
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#0f0f10'
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    {s.appIconDataURL && (
                      <img
                        src={s.appIconDataURL}
                        alt=""
                        style={{ width: 16, height: 16 }}
                      />
                    )}
                    <span style={{ fontSize: 13 }}>{truncate(s.name)}</span>
                  </div>
                </button>
              ))}
              {windows.length === 0 && (
                <p style={{ color: '#8b8b93' }}>No matching windows.</p>
              )}
            </div>
          )}

          {!loading && tab === 'monitors' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12
              }}
            >
              {monitors.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPickMonitor(s.id, s.label)}
                  style={{
                    padding: 10,
                    background: '#1e1e21',
                    border: '1px solid #2a2a2e',
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#f0f0f4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <img
                    src={s.thumbnailDataURL}
                    alt=""
                    style={{
                      width: '100%',
                      height: 110,
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#0f0f10'
                    }}
                  />
                  <span style={{ fontSize: 13 }}>{s.label}</span>
                </button>
              ))}
              {monitors.length === 0 && (
                <p style={{ color: '#8b8b93' }}>No monitors detected.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
