import type { Server as IoServer } from 'socket.io';
import type { Browser, Page, KeyInput } from 'puppeteer';

/**
 * Per-room headless Chromium instance controlled by all participants.
 *
 * Puppeteer downloads and caches its bundled Chromium on first install
 * (under ~/.cache/puppeteer on Windows for puppeteer >= 19, or
 * node_modules/puppeteer/.local-chromium on older versions). No extra
 * configuration is required on Windows once npm install has completed.
 */

const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const FRAME_INTERVAL_MS = 33; // ~30fps
const JPEG_QUALITY = 55;

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu'
];

export class CoBrowser {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private frameTimer: NodeJS.Timeout | null = null;
  private stopping = false;

  constructor(
    private readonly roomId: string,
    private readonly io: IoServer
  ) {}

  async start(url: string): Promise<void> {
    if (this.browser) return;
    // Dynamic import keeps puppeteer from loading its heavy Chromium path
    // resolution at Electron startup — only pay the cost on demand.
    const puppeteer = await import('puppeteer');
    this.browser = await puppeteer.default.launch({
      headless: true,
      args: LAUNCH_ARGS,
      defaultViewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT
    });

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch (err) {
      this.io
        .to(this.roomId)
        .emit('cobrowser:error', { message: (err as Error).message });
    }

    this.io.to(this.roomId).emit('cobrowser:ready', { url });
    this.startFrameLoop();
  }

  private startFrameLoop(): void {
    this.stopFrameLoop();
    this.frameTimer = setInterval(() => {
      void this.captureAndEmit();
    }, FRAME_INTERVAL_MS);
  }

  private stopFrameLoop(): void {
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private async captureAndEmit(): Promise<void> {
    if (!this.page || this.stopping) return;
    try {
      const buffer = await this.page.screenshot({
        type: 'jpeg',
        quality: JPEG_QUALITY,
        fullPage: false
      });
      const data =
        typeof buffer === 'string'
          ? buffer
          : Buffer.from(buffer).toString('base64');
      const [url, title] = await Promise.all([
        Promise.resolve(this.page.url()),
        this.page.title().catch(() => '')
      ]);
      this.io.to(this.roomId).emit('cobrowser:frame', { data, url, title });
    } catch (err) {
      // If the page is navigating or has crashed we may briefly fail here.
      if (!this.page || this.page.isClosed()) {
        this.stopFrameLoop();
        this.io.to(this.roomId).emit('cobrowser:crashed', {
          message: (err as Error).message
        });
      }
    }
  }

  async navigate(url: string): Promise<void> {
    if (!this.page) return;
    this.stopFrameLoop();
    this.io.to(this.roomId).emit('cobrowser:loading', { url });
    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch (err) {
      this.io
        .to(this.roomId)
        .emit('cobrowser:error', { message: (err as Error).message });
    }
    this.startFrameLoop();
  }

  async goBack(): Promise<void> {
    if (!this.page) return;
    this.stopFrameLoop();
    try {
      await this.page.goBack({ waitUntil: 'domcontentloaded' });
    } catch {
      /* no history to go back to */
    }
    this.startFrameLoop();
  }

  async goForward(): Promise<void> {
    if (!this.page) return;
    this.stopFrameLoop();
    try {
      await this.page.goForward({ waitUntil: 'domcontentloaded' });
    } catch {
      /* no forward history */
    }
    this.startFrameLoop();
  }

  async reload(): Promise<void> {
    if (!this.page) return;
    this.stopFrameLoop();
    try {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
    } catch {
      /* ignore */
    }
    this.startFrameLoop();
  }

  /** Fire-and-forget mouse move — awaiting kills interactive latency. */
  handleMouseMove(x: number, y: number, scaleX: number, scaleY: number): void {
    if (!this.page) return;
    void this.page.mouse.move(x * scaleX, y * scaleY).catch(() => undefined);
  }

  handleMouseClick(
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    button: 'left' | 'right'
  ): void {
    if (!this.page) return;
    void this.page.mouse
      .click(x * scaleX, y * scaleY, { button })
      .catch(() => undefined);
  }

  handleScroll(deltaX: number, deltaY: number): void {
    if (!this.page) return;
    void this.page.mouse.wheel({ deltaX, deltaY }).catch(() => undefined);
  }

  handleKeypress(key: string): void {
    if (!this.page) return;
    void this.page.keyboard.press(key as KeyInput).catch(() => undefined);
  }

  handleType(text: string): void {
    if (!this.page) return;
    void this.page.keyboard.type(text, { delay: 0 }).catch(() => undefined);
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.stopFrameLoop();
    try {
      if (this.browser) await this.browser.close();
    } catch {
      /* best effort */
    }
    this.browser = null;
    this.page = null;
    this.io.to(this.roomId).emit('cobrowser:stopped');
  }
}
