/**
 * Renders the app icon to PNG files in public/.
 *
 * The mark is the same geofence the UI uses: a dashed radius ring, a solid
 * boundary ring, and the place at the centre. Drawn here with plain arithmetic
 * and encoded with Node's own zlib, so the icons need no image toolchain and
 * regenerate identically on any machine.
 *
 *   npm run icons
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type Rgba = [number, number, number, number];

const INK: Rgba = [0x0c, 0x1f, 0x26, 255];
const SIGNAL: Rgba = [0x2b, 0xc3, 0xa6, 255];
const SIGNAL_FAINT: Rgba = [0x2b, 0xc3, 0xa6, 115];

/** Coverage of a pixel by a ring, antialiased over one pixel of edge. */
function ringCoverage(
  distance: number,
  radius: number,
  halfWidth: number,
): number {
  const edge = Math.abs(distance - radius);
  return Math.min(1, Math.max(0, halfWidth + 0.5 - edge));
}

function over(base: Rgba, top: Rgba, alpha: number): Rgba {
  const a = (top[3] / 255) * alpha;
  return [
    Math.round(base[0] * (1 - a) + top[0] * a),
    Math.round(base[1] * (1 - a) + top[1] * a),
    Math.round(base[2] * (1 - a) + top[2] * a),
    255,
  ];
}

function renderIcon(size: number): Buffer {
  const pixels = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  const unit = size / 32;

  // Radii and stroke widths, in the same 32-unit grid as the SVG brand mark.
  const outerRadius = 13 * unit;
  const outerHalf = 0.8 * unit;
  const innerRadius = 8 * unit;
  const innerHalf = 1.1 * unit;
  const dotRadius = 3 * unit;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - centre;
      const dy = y - centre;
      const distance = Math.hypot(dx, dy);

      let colour: Rgba = INK;

      // Dashed outer ring: 16 segments around the circle.
      const outer = ringCoverage(distance, outerRadius, outerHalf);
      if (outer > 0) {
        const angle = Math.atan2(dy, dx) + Math.PI;
        const onDash = Math.floor((angle / (Math.PI * 2)) * 32) % 2 === 0;
        if (onDash) colour = over(colour, SIGNAL_FAINT, outer);
      }

      const inner = ringCoverage(distance, innerRadius, innerHalf);
      if (inner > 0) colour = over(colour, SIGNAL, inner);

      const dot = Math.min(1, Math.max(0, dotRadius + 0.5 - distance));
      if (dot > 0) colour = over(colour, SIGNAL, dot);

      const offset = (y * size + x) * 4;
      pixels[offset] = colour[0];
      pixels[offset + 1] = colour[1];
      pixels[offset + 2] = colour[2];
      pixels[offset + 3] = colour[3];
    }
  }

  return encodePng(pixels, size, size);
}

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, crc]);
}

function encodePng(pixels: Buffer, width: number, height: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type; 0 means "none".
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-icon.png", size: 180 },
  { file: "favicon-32.png", size: 32 },
];

const outDir = path.join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });

for (const target of targets) {
  const png = renderIcon(target.size);
  writeFileSync(path.join(outDir, target.file), png);
  console.log(`${target.file}  ${target.size}x${target.size}  ${png.length} bytes`);
}
