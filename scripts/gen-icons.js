const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PAPER = [7, 10, 9];     // #070A09 background
const ACC = [0, 209, 143];    // #00D18F brand mark

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function writePng(file, size, draw) {
  const w = size, h = size;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = draw(x, y, w, h);
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(file, png);
  console.log('wrote', file, size + 'x' + size);
}

// Rotated rounded square brand mark, matches the in-app logo (24deg, radius ~30%).
function markPixel(x, y, w, h, squareFrac, radiusFrac, angleDeg) {
  const cx = w / 2, cy = h / 2;
  const half = (w * squareFrac) / 2;
  const rad = (-angleDeg * Math.PI) / 180;
  const dx = x - cx, dy = y - cy;
  const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
  const r = half * radiusFrac;
  const qx = Math.abs(rx) - (half - r);
  const qy = Math.abs(ry) - (half - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
  return outside <= 0;
}

function baseIcon(size, squareFrac, radiusFrac) {
  return (x, y, w, h) => {
    if (markPixel(x, y, w, h, squareFrac, radiusFrac, 24)) return [...ACC, 255];
    return [...PAPER, 255];
  };
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

writePng(path.join(outDir, 'icon-192.png'), 192, baseIcon(192, 0.56, 0.26));
writePng(path.join(outDir, 'icon-512.png'), 512, baseIcon(512, 0.56, 0.26));
writePng(path.join(outDir, 'icon-maskable-512.png'), 512, baseIcon(512, 0.42, 0.26)); // extra safe-zone padding
writePng(path.join(outDir, 'apple-touch-icon.png'), 180, baseIcon(180, 0.62, 0.24));
