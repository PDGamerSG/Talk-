import { useEffect, useMemo, useState } from 'react';
import type { SourceInfo } from '../types/room';

interface SongModePickerProps {
  open: boolean;
  onClose: () => void;
  onStart: (sourceId: string, sourceName: string) => void;
}

const MUSIC_APP_HINTS = [
  'brave',
  'chrome',
  'edge',
  'firefox',
  'spotify',
  'vlc',
  'foobar',
  'aimp',
  'winamp',
  'musicbee',
  'groove',
  'media player'
];

function isMusicApp(name: string): boolean {
  const lc = name.toLowerCase();
  return MUSIC_APP_HINTS.some((h) => lc.includes(h));
}

export default function SongModePicker({
  open,
  onClose,
  onStart
}: SongModePickerProps): JSX.Element | null {
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SourceInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    window.electronAPI
      .getAudioSources()
      .then((list) => {
        if (!cancelled) setSources(list as SourceInfo[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      sources.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [sources, query]
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
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Song Mode</h3>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 12,
                color: '#8b8b93'
              }}
            >
              Pick the app that is playing audio. Windows loopback captures
              the full system output.
            </p>
          </div>
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

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps…"
          style={{
            padding: '8px 10px',
            background: '#1e1e21',
            border: '1px solid #2a2a2e',
            borderRadius: 8,
            color: '#f0f0f4'
          }}
        />

        <div style={{ overflowY: 'auto', maxHeight: '50vh' }}>
          {loading && <p style={{ color: '#8b8b93' }}>Loading apps…</p>}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12
            }}
          >
            {filtered.map((s) => {
              const isSelected = selected?.id === s.id;
              const musicBadge = isMusicApp(s.name);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: 10,
                    background: '#1e1e21',
                    border: `1px solid ${
                      isSelected ? '#5b5bd6' : '#2a2a2e'
                    }`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    textAlign: 'left',
                    color: '#f0f0f4',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <img
                    src={s.thumbnailDataURL}
                    alt=""
                    style={{
                      width: '100%',
                      height: 68,
                      objectFit: 'cover',
                      borderRadius: 6,
                      background: '#0f0f10'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s.appIconDataURL && (
                      <img
                        src={s.appIconDataURL}
                        alt=""
                        style={{ width: 14, height: 14 }}
                      />
                    )}
                    <span style={{ fontSize: 12, flex: 1 }}>
                      {s.name.length > 20 ? `${s.name.slice(0, 19)}…` : s.name}
                    </span>
                    {musicBadge && (
                      <span
                        title="Likely music app"
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          background: '#2a2d52',
                          color: '#b6baff',
                          borderRadius: 10
                        }}
                      >
                        ♪
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && !loading && (
              <p style={{ color: '#8b8b93' }}>No matching apps.</p>
            )}
          </div>
        </div>

        <button
          onClick={() => selected && onStart(selected.id, selected.name)}
          disabled={!selected}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            background: selected ? '#5b5bd6' : '#2a2a2e',
            color: '#ffffff',
            border: 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            fontSize: 14
          }}
        >
          Start sharing
        </button>
      </div>
    </div>
  );
}
