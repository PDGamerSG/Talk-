import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'path';
import { IPC_CHANNELS } from './ipc';
import {
  startSignalingServer,
  type SignalingServerHandle
} from './server/index';

const isDev = !app.isPackaged;
const SIGNALING_PORT = 45671;

let serverHandle: SignalingServerHandle | null = null;

function createMainWindow(): BrowserWindow {
  const preloadPath = join(__dirname, '../preload/index.js');
  const iconPath = join(__dirname, '../../electron/assets/icons/icon.ico');

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#0f0f10',
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // Open external links in the OS default browser rather than a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url).catch(() => undefined);
    return { action: 'deny' };
  });

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function registerWindowIpc(): void {
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });
}

function registerAppIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SERVER_PORT, () => SIGNALING_PORT);

  // Windows: no OS-level mic permission API — the Chromium getUserMedia
  // prompt is authoritative. This handler exists so renderer code has a
  // single consistent entry point.
  ipcMain.handle(IPC_CHANNELS.CALL_MIC_PERMISSION, () => ({ granted: true }));

  ipcMain.handle('open:mic-settings', async () => {
    await shell.openExternal('ms-settings:privacy-microphone');
  });
  ipcMain.handle('open:screen-settings', async () => {
    await shell.openExternal('ms-settings:privacy-screenrecording');
  });
}

app.whenReady().then(async () => {
  registerWindowIpc();
  registerAppIpc();
  try {
    serverHandle = await startSignalingServer(SIGNALING_PORT);
  } catch (err) {
    console.error('[main] signaling server failed to start', err);
  }
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (serverHandle) {
    await serverHandle.close().catch(() => undefined);
    serverHandle = null;
  }
});
