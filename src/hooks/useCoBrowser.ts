import { useCallback, useEffect, useState } from 'react';
import { socketClient } from '../lib/socketClient';

interface UseCoBrowserResult {
  frameDataUrl: string | null;
  currentUrl: string;
  pageTitle: string;
  isLoading: boolean;
  isActive: boolean;
  error: string | null;
  startCoBrowser: (url: string) => void;
  stopCoBrowser: () => void;
  navigate: (url: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
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

export function useCoBrowser(): UseCoBrowserResult {
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socketClient.isConnected()) return;
    const socket = socketClient.getSocket();

    const onReady = (p: { url: string }): void => {
      setIsActive(true);
      setIsLoading(false);
      setCurrentUrl(p.url);
      setError(null);
    };
    const onFrame = (p: { data: string; url: string; title: string }): void => {
      setIsLoading(false);
      setFrameDataUrl(`data:image/jpeg;base64,${p.data}`);
      setCurrentUrl(p.url);
      setPageTitle(p.title);
    };
    const onLoading = (): void => setIsLoading(true);
    const onStopped = (): void => {
      setIsActive(false);
      setFrameDataUrl(null);
      setPageTitle('');
    };
    const onCrashed = (p: { message?: string }): void => {
      setError(p.message ?? 'Co-browser crashed — try restarting');
      setIsActive(false);
    };

    socket.on('cobrowser:ready', onReady);
    socket.on('cobrowser:frame', onFrame);
    socket.on('cobrowser:loading', onLoading);
    socket.on('cobrowser:stopped', onStopped);
    socket.on('cobrowser:crashed', onCrashed);

    return () => {
      socket.off('cobrowser:ready', onReady);
      socket.off('cobrowser:frame', onFrame);
      socket.off('cobrowser:loading', onLoading);
      socket.off('cobrowser:stopped', onStopped);
      socket.off('cobrowser:crashed', onCrashed);
    };
  }, []);

  const emit = useCallback((event: string, payload?: unknown): void => {
    if (!socketClient.isConnected()) return;
    socketClient.getSocket().emit(event, payload);
  }, []);

  return {
    frameDataUrl,
    currentUrl,
    pageTitle,
    isLoading,
    isActive,
    error,
    startCoBrowser: (url: string) => emit('cobrowser:start', { url }),
    stopCoBrowser: () => emit('cobrowser:stop'),
    navigate: (url: string) => emit('cobrowser:navigate', { url }),
    back: () => emit('cobrowser:back'),
    forward: () => emit('cobrowser:forward'),
    reload: () => emit('cobrowser:reload'),
    sendMouseMove: (x, y, scaleX, scaleY) =>
      emit('cobrowser:mouse-move', { x, y, scaleX, scaleY }),
    sendMouseClick: (x, y, scaleX, scaleY, button) =>
      emit('cobrowser:mouse-click', { x, y, scaleX, scaleY, button }),
    sendScroll: (deltaX, deltaY) =>
      emit('cobrowser:scroll', { deltaX, deltaY }),
    sendKeypress: (key) => emit('cobrowser:keypress', { key }),
    sendType: (text) => emit('cobrowser:type', { text })
  };
}
