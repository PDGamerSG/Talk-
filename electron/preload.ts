import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from './ipc';

type Listener = (...args: unknown[]) => void;

// Keep a map of user callback -> wrapped IPC listener so we can remove the
// correct wrapper when `off` is called.
const listenerRegistry = new WeakMap<Listener, (event: IpcRendererEvent, ...args: unknown[]) => void>();

const electronAPI = {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    return ipcRenderer.invoke(channel, ...args);
  },

  on(channel: string, callback: Listener): void {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => {
      callback(...args);
    };
    listenerRegistry.set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);
  },

  off(channel: string, callback: Listener): void {
    const wrapped = listenerRegistry.get(callback);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      listenerRegistry.delete(callback);
    }
  },

  minimize(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE);
  },

  maximize(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE);
  },

  close(): void {
    ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE);
  },

  requestMicPermission(): Promise<{ granted: boolean }> {
    return ipcRenderer.invoke(IPC_CHANNELS.CALL_MIC_PERMISSION) as Promise<{
      granted: boolean;
    }>;
  },

  getScreenSources(): Promise<unknown> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SCREEN_SOURCES);
  },

  getAudioSources(): Promise<unknown> {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_AUDIO_SOURCES);
  },

  openMicSettings(): Promise<void> {
    return ipcRenderer.invoke('open:mic-settings') as Promise<void>;
  },

  openScreenSettings(): Promise<void> {
    return ipcRenderer.invoke('open:screen-settings') as Promise<void>;
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
