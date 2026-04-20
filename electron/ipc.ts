/**
 * Centralised IPC channel names shared between main and renderer processes.
 * Importing the same constants on both sides prevents string-typo drift.
 */
export const IPC_CHANNELS = {
  // Room / session lifecycle
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',

  // Server discovery
  SERVER_PORT: 'server:port',

  // Window controls (frameless window needs manual wiring)
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',

  // Media source enumeration
  GET_SCREEN_SOURCES: 'media:getScreenSources',
  GET_AUDIO_SOURCES: 'media:getAudioSources',

  // Permissions
  CALL_MIC_PERMISSION: 'permission:mic',
  PERMISSION_SCREEN_DENIED: 'permission:screenDenied'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
