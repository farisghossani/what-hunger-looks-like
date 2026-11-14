// food-picture-01 entry program (Node 22, standard library only, no network).
//
// The picture is the file entry.png beside this program. Before anything leaves the
// repository this program proves the file satisfies the competition's gate —
// a whole PNG or JPEG, at most 1 MiB, at most 1024 by 1024 pixels, every chunk or
// segment intact through to its end marker — and then copies its bytes unchanged to
// ${MAKEFUN_OUTPUT_DIR ?? "/output"}/entry.png. Nothing is decoded, resized or
// re-encoded: the judge sees exactly the bytes that were checked.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// A file that fails any check is refused: the reason is printed and nothing is written.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

const HERE = dirname(fileURLToPath(import.meta.url));
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// The gate as the rules state it: a broken file must never reach the output.
class Refused extends Error {}

function refuse(why) {
  throw new Refused(why);
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// A PNG: signature, then chunks each carrying its checksum, to IEND and no further.
function checkPng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) refuse('bad PNG signature');

  // bit depth by colour type, as the format allows
  const LEGAL_DEPTHS = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };

  let at = 8;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawData = false;
  let sawEnd = false;

  while (!sawEnd) {
    if (at + 12 > buf.length) refuse('a PNG chunk header runs past the end of the file');
    const length = buf.readUInt32BE(at);
    if (length > 0x7fffffff) refuse('a PNG chunk length is not a legal length');
    const end = at + 12 + length;
    if (end > buf.length) refuse('a PNG chunk extends past the end of the file');
    const type = buf.toString('latin1', at + 4, at + 8);
    if (!/^[A-Za-z]{4}$/.test(type)) refuse(`PNG chunk type ${JSON.stringify(type)} is not four letters`);
    const stated = buf.readUInt32BE(at + 8 + length);
    const actual = crc32(buf.subarray(at + 4, at + 8 + length));
    if (stated !== actual) refuse(`PNG chunk ${type} fails its checksum`);

    if (type === 'IHDR') {
      if (sawHeader) refuse('the PNG carries a second IHDR');
      if (at !== 8) refuse('IHDR is not the first PNG chunk');
      if (length !== 13) refuse('IHDR is not 13 bytes');
      width = buf.readUInt32BE(at + 8);
      height = buf.readUInt32BE(at + 12);
      if (width < 1 || height < 1) refuse('IHDR names no pixels');
      const bitDepth = buf[at + 16];
      const colourType = buf[at + 17];
      if (!LEGAL_DEPTHS[colourType]) refuse(`IHDR names an illegal colour type (${colourType})`);
      if (!LEGAL_DEPTHS[colourType].includes(bitDepth)) {
        refuse(`IHDR names bit depth ${bitDepth} with colour type ${colourType}, which the format forbids`);
      }
      if (buf[at + 18] !== 0 || buf[at + 19] !== 0) refuse('IHDR names an unknown compression or filter method');
      if (buf[at + 20] > 1) refuse('IHDR names an unknown interlace method');
      sawHeader = true;
    } else if (type === 'IDAT') {
      sawData = true;
    } else if (type === 'IEND') {
      if (!sawHeader) refuse('the PNG reaches IEND with no header');
      if (length !== 0) refuse('IEND is not empty');
      sawEnd = true;
    }

    at = end;
  }

  if (!sawData) refuse('the PNG carries no image data');
  if (at !== buf.length) refuse(`${buf.length - at} trailing byte(s) after IEND`);
  return { format: 'PNG', width, height };
}

// The markers whose segments carry a frame header — the only ones naming a size.
function isStartOfFrame(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

// A JPEG: SOI, segments each with its length, a frame, a scan, an end marker, no trailing bytes.
function checkJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) refuse('bad JPEG start of image');

  let at = 2;
  let width = 0;
  let height = 0;
  let sawFrame = false;
  let sawScan = false;

  for (;;) {
    if (at >= buf.length) refuse('the JPEG ends with no end-of-image marker');
    if (buf[at] !== 0xff) refuse('a JPEG segment does not begin with 0xFF');

    let marker = buf[at + 1];
    at += 2;
    while (marker === 0xff) {
      // fill bytes: more than one 0xFF before a marker is legal but unusual
      if (at >= buf.length) refuse('the JPEG ends inside a marker');
      marker = buf[at];
      at += 1;
    }

    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) {
      if (at !== buf.length) refuse(`${buf.length - at} trailing byte(s) after the JPEG end marker`);
      break;
    }

    if (at + 2 > buf.length) refuse('a JPEG segment length runs past the end of the file');
    const length = buf.readUInt16BE(at);
    if (length < 2 || at + length > buf.length) refuse('a JPEG segment length is out of range');

    if (isStartOfFrame(marker)) {
      if (sawScan) refuse('the JPEG names its frame after its first scan');
      if (length < 8) refuse('a JPEG frame header is too short to name a size');
      const precision = buf[at + 2];
      if (precision !== 8 && precision !== 12) refuse(`a JPEG frame names sample precision ${precision}`);
      height = buf.readUInt16BE(at + 3);
      width = buf.readUInt16BE(at + 5);
      if (width < 1 || height < 1) refuse('the JPEG frame names no pixels');
      sawFrame = true;
    }

    at += length;

    if (marker === 0xda) {
      // the entropy-coded scan follows, with 0xFF bytes stuffed as 0xFF00
      sawScan = true;
      while (at < buf.length) {
        if (buf[at] !== 0xff) {
          at += 1;
          continue;
        }
        const next = buf[at + 1];
        if (next === undefined) refuse('the JPEG ends inside a scan');
        if (next === 0x00 || next === 0xff || (next >= 0xd0 && next <= 0xd7)) {
          at += 2;
          continue;
        }
        break;
      }
    }
  }

  if (!sawFrame) refuse('the JPEG names no frame size');
  if (!sawScan) refuse('the JPEG carries no image data');
  return { format: 'JPEG', width, height };
}

function main() {
  const source = join(HERE, 'entry.png');
  const bytes = readFileSync(source);

  if (bytes.length === 0) refuse('the file is empty');
  if (bytes.length > MAX_BYTES) refuse(`${bytes.length} bytes is over the ${MAX_BYTES} byte cap`);

  let shape;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) shape = checkPng(bytes);
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) shape = checkJpeg(bytes);
  else refuse('neither a PNG nor a JPEG by its first bytes');

  if (shape.width > MAX_SIDE || shape.height > MAX_SIDE) {
    refuse(`${shape.width}x${shape.height} is over the ${MAX_SIDE} pixel cap`);
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const target = join(outDir, 'entry.png');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(target, bytes);

  console.log(
    `entry.png: ${shape.format} ${shape.width}x${shape.height}, ${bytes.length} bytes, ` +
      `copied unchanged to ${target}`,
  );
}

try {
  main();
} catch (error) {
  if (error instanceof Refused) {
    console.error(`entry.png refused by the gate: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
