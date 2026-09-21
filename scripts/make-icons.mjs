/*
 * Generates the PWA icon set from a tiny vector description, so the icons can be
 * regenerated without adding an image dependency:  bun run icons
 *
 * Writes public/icon-192.png, public/icon-512.png and public/apple-touch-icon.png,
 * then prints the silhouette to the terminal so the shape can be eyeballed.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = [0x24, 0x81, 0xcc];      // --color-tg-accent
const FG = [0xff, 0xff, 0xff];

// Paper plane drawn in a 32x32 space.
const RAW_ART = [
  [[27.5, 4.5], [4, 15], [13.5, 18.5]],
  [[13.5, 18.5], [16.5, 27], [20, 11]],
];

// Shrink it so nothing reaches the corners: adaptive/maskable icons crop to the
// middle 80% circle, and iOS rounds the corners just as aggressively.
const SAFE_ZONE = 0.72;
const ART = RAW_ART.map(tri =>
  tri.map(([x, y]) => [16 + (x - 16) * SAFE_ZONE, 16 + (y - 16) * SAFE_ZONE])
);

/** Area-weighted coverage of the plane at pixel centres, with 4x4 supersampling. */
function coverage(px, py, scale, offset, samples = 4) {
  let hits = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = (px + (sx + 0.5) / samples - offset) / scale;
      const y = (py + (sy + 0.5) / samples - offset) / scale;
      if (ART.some(tri => inside(x, y, tri))) hits++;
    }
  }
  return hits / (samples * samples);
}

function inside(x, y, [[x1, y1], [x2, y2], [x3, y3]]) {
  const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  const d1 = sign(x, y, x1, y1, x2, y2);
  const d2 = sign(x, y, x2, y2, x3, y3);
  const d3 = sign(x, y, x3, y3, x1, y1);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** Raw RGBA rows for one icon: rounded-square background with the white plane on top. */
function render(size) {
  const rows = [];
  const scale = size / 32;
  const offset = (size - 32 * scale) / 2;
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const a = coverage(x, y, scale, offset);
      const i = 1 + x * 4;
      for (let c = 0; c < 3; c++) row[i + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
      row[i + 3] = 255;
    }
    rows.push(row);
  }
  return Buffer.concat(rows);
}

// ── Minimal PNG writer ──────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const file = png(size);
  writeFileSync(join(outDir, name), file);
  console.log(`${name} — ${size}x${size}, ${file.length} bytes`);
}

// Terminal preview of the silhouette (one character per 32-unit cell).
let preview = '';
for (let y = 0; y < 32; y++) {
  for (let x = 0; x < 32; x++) {
    const a = coverage(x, y, 1, 0, 6);
    preview += a > 0.6 ? '#' : a > 0.15 ? '+' : '.';
  }
  preview += '\n';
}
console.log(preview);
