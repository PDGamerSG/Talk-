import { useEffect, useState } from 'react';

interface CoBrowserControlsProps {
  currentUrl: string;
  pageTitle: string;
  isLoading: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function CoBrowserControls({
  currentUrl,
  pageTitle,
  isLoading,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStop
}: CoBrowserControlsProps): JSX.Element {
  const [value, setValue] = useState(currentUrl);

  useEffect(() => {
    setValue(currentUrl);
  }, [currentUrl]);

  const submit = (): void => {
    const url = normaliseUrl(value);
    if (url) onNavigate(url);
  };

  return (
    <div
      style={{
        position: 'relative',
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        background: '#161618',
        borderBottom: '1px solid #2a2a2e',
        color: '#f0f0f4'
      }}
    >
      <style>
        {`@keyframes talk-progress {
            0%   { width: 0%; }
            70%  { width: 70%; }
            100% { width: 90%; }
          }
          @keyframes talk-fade {
            from { opacity: 1; }
            to   { opacity: 0; }
          }`}
      </style>

      <IconButton onClick={onBack} label="Back">
        ←
      </IconButton>
      <IconButton onClick={onForward} label="Forward">
        →
      </IconButton>
      <IconButton onClick={onReload} label="Reload">
        ↺
      </IconButton>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Enter URL…"
        style={{
          flex: 1,
          height: 28,
          padding: '0 10px',
          background: '#1e1e21',
          border: '1px solid #2a2a2e',
          borderRadius: 6,
          color: '#f0f0f4',
          fontSize: 13
        }}
      />
      <button
        onClick={submit}
        style={{
          height: 28,
          padding: '0 12px',
          background: '#5b5bd6',
          border: 'none',
          borderRadius: 6,
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: 12
        }}
      >
        Go
      </button>

      {pageTitle && (
        <span
          title={pageTitle}
          style={{
            fontSize: 11,
            color: '#8b8b93',
            maxWidth: 180,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {pageTitle}
        </span>
      )}

      <IconButton onClick={onStop} label="Stop co-browser" danger>
        ×
      </IconButton>

      {isLoading && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 2,
            background: '#5b5bd6',
            animation: 'talk-progress 1.2s ease-out forwards'
          }}
        />
      )}
    </div>
  );
}

function IconButton({
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
      style={{
        width: 28,
        height: 28,
        background: '#1e1e21',
        border: '1px solid #2a2a2e',
        borderRadius: 6,
        color: danger ? '#e5534b' : '#f0f0f4',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14
      }}
    >
      {children}
    </button>
  );
}
