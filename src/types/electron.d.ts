export type IpcListener = (...args: unknown[]) => void;

import type { SourceInfo } from './room';

export interface ElectronAPI {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: IpcListener): void;
  off(channel: string, callback: IpcListener): void;
  minimize(): void;
  maximize(): void;
  close(): void;
  requestMicPermission(): Promise<{ granted: boolean }>;
  getScreenSources(): Promise<SourceInfo[]>;
  getAudioSources(): Promise<SourceInfo[]>;
  openMicSettings(): Promise<void>;
  openScreenSettings(): Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
