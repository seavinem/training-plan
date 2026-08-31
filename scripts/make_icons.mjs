import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../app/public");

function crc32png(data) {
  let c = ~0;
  for (const b of data) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(tag, data) {
  const tagBuf = Buffer.from(tag);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32png(Buffer.concat([tagBuf, data])));
  return Buffer.concat([len, tagBuf, data, crcBuf]);
}

function png(size, file) {
  const bg = [12, 13, 15];
  const bar = [232, 163, 23];
  const sleeve = [242, 243, 245];
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      let color = bg;
      if (ny > 0.42 && ny < 0.58 && nx > 0.17 && nx < 0.83) color = bar;
      if (ny > 0.37 && ny < 0.63 && ((nx > 0.1 && nx < 0.21) || (nx > 0.79 && nx < 0.9))) {
        color = sleeve;
      }
      row.push(...color);
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const body = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(join(dir, file), body);
}

png(180, "apple-touch-icon.png");
png(192, "pwa-192x192.png");
png(512, "pwa-512x512.png");
