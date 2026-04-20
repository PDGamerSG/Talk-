export type IpcListener = (...args: unknown[]) => void;

export interface ElectronAPI {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, callback: IpcListener): void;
  off(channel: string, callback: IpcListener): void;
  minimize(): void;
  maximize(): void;
  close(): void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
