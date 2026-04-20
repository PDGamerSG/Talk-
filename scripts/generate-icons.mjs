/**
 * Generates Talk+ app icons as BMP-in-ICO files.
 *   - electron/assets/icons/icon.ico : 256x256 + 48x48 + 16x16
 *   - electron/assets/icons/tray.ico : 16x16
 *
 * Visual: dark #0f0f10 rounded-square background, white signal-wave glyph.
 * Output is a valid multi-size ICO (BMP entries) readable by Windows / Electron.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'electron', 'assets', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ---------- pixel generation ----------
const BG = [0x10, 0x0f, 0x0f, 0xff]; // #0f0f10 BGRA
const FG = [0xff, 0xff, 0xff, 0xff]; // white
const TRANSPARENT = [0, 0, 0, 0];

function makePixels(size) {
  const px = new Array(size * size);
  const radius = Math.max(2, Math.round(size * 0.18));
  const inset = Math.max(1, Math.round(size * 0.06));
  const waveTop = Math.round(size * 0.38);
  const waveBot = Math.round(size * 0.62);

  // 3 vertical signal bars of varying height, centered
  const barCount = 3;
  const barW = Math.max(1, Math.round(size * 0.1));
  const gap = Math.max(1, Math.round(size * 0.08));
  const totalW = barCount * barW + (barCount - 1) * gap;
  const startX = Math.round((size - totalW) / 2);
  const heights = [0.55, 0.95, 0.7];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;

      // rounded-square background mask
      const inBody =
        x >= inset &&
        x < size - inset &&
        y >= inset &&
        y < size - inset &&
        !isOutsideRoundedCorner(x, y, size, inset, radius);

      if (!inBody) {
        px[idx] = TRANSPARENT;
        continue;
      }

      // check bars
      let onBar = false;
      for (let b = 0; b < barCount; b++) {
        const bx = startX + b * (barW + gap);
        if (x >= bx && x < bx + barW) {
          const barH = Math.round(size * heights[b] * 0.45);
          const cy = Math.round(size / 2);
          if (y >= cy - barH / 2 && y <= cy + barH / 2) {
            onBar = true;
            break;
          }
        }
      }

      // subtle wave line across middle (thin)
      const midY = Math.round(size / 2);
      const waveAmp = Math.max(1, Math.round(size * 0.04));
      const wavePhase = Math.sin((x / size) * Math.PI * 2) * waveAmp;
      const onWave =
        !onBar &&
        size >= 32 &&
        Math.abs(y - (midY + wavePhase)) < 0.8 &&
        x > inset + 2 &&
        x < size - inset - 2 &&
        y > waveTop &&
        y < waveBot;

      px[idx] = onBar || onWave ? FG : BG;
    }
  }
  return px;
}

function isOutsideRoundedCorner(x, y, size, inset, radius) {
  const corners = [
    [inset + radius, inset + radius],
    [size - inset - radius - 1, inset + radius],
    [inset + radius, size - inset - radius - 1],
    [size - inset - radius - 1, size - inset - radius - 1]
  ];
  for (const [cx, cy] of corners) {
    const dx = x - cx;
    const dy = y - cy;
    // only test in the corner quadrant
    const inCornerQuadrant =
      (cx < size / 2 ? x < cx : x > cx) && (cy < size / 2 ? y < cy : y > cy);
    if (inCornerQuadrant && dx * dx + dy * dy > radius * radius) {
      return true;
    }
  }
  return false;
}

// ---------- BMP-in-ICO encoder ----------
function encodeIconImage(size) {
  const pixels = makePixels(size);
  const width = size;
  const height = size;

  // BITMAPINFOHEADER: biHeight = 2 * height (XOR + AND mask)
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);         // biSize
  header.writeInt32LE(width, 4);       // biWidth
  header.writeInt32LE(height * 2, 8);  // biHeight (doubled for AND mask)
  header.writeUInt16LE(1, 12);         // biPlanes
  header.writeUInt16LE(32, 14);        // biBitCount
  header.writeUInt32LE(0, 16);         // biCompression (BI_RGB)
  header.writeUInt32LE(0, 20);         // biSizeImage
  header.writeUInt32LE(0, 24);
  header.writeUInt32LE(0, 28);
  header.writeUInt32LE(0, 32);
  header.writeUInt32LE(0, 36);

  // XOR mask: BGRA, bottom-up
  const xor = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = pixels[(height - 1 - y) * width + x];
      const off = (y * width + x) * 4;
      xor[off] = src[0];
      xor[off + 1] = src[1];
      xor[off + 2] = src[2];
      xor[off + 3] = src[3];
    }
  }

  // AND mask: 1 bit per pixel, rows padded to 4 bytes, bottom-up
  const rowBytes = Math.ceil(width / 32) * 4;
  const andMask = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = pixels[(height - 1 - y) * width + x];
      if (src[3] === 0) {
        // transparent — set AND bit to 1
        const byteIdx = y * rowBytes + Math.floor(x / 8);
        andMask[byteIdx] |= 0x80 >> (x % 8);
      }
    }
  }

  return Buffer.concat([header, xor, andMask]);
}

function buildIco(sizes) {
  const images = sizes.map((s) => ({ size: s, data: encodeIconImage(s) }));
  const dirSize = 6 + 16 * images.length;

  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); // reserved
  head.writeUInt16LE(1, 2); // type = icon
  head.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(16 * images.length);
  let offset = dirSize;
  images.forEach((img, i) => {
    const e = entries.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width (0 == 256)
    e.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height
    e.writeUInt8(0, 2); // color palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bit count
    e.writeUInt32LE(img.data.length, 8); // size
    e.writeUInt32LE(offset, 12); // offset
    offset += img.data.length;
  });

  return Buffer.concat([head, entries, ...images.map((i) => i.data)]);
}

// ---------- write files ----------
const appIco = buildIco([16, 48, 256]);
const trayIco = buildIco([16]);

writeFileSync(resolve(OUT_DIR, 'icon.ico'), appIco);
writeFileSync(resolve(OUT_DIR, 'tray.ico'), trayIco);

console.log(`Wrote icon.ico (${appIco.length} bytes) and tray.ico (${trayIco.length} bytes) -> ${OUT_DIR}`);
