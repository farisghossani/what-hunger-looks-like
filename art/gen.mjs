// Writes art.html: the picture this entry ships, as one HTML page with the
// drawing inlined. Deterministic — it only reads a fixed file and concatenates.
//
//   node gen.mjs
//   chrome --headless=new --screenshot=out.png art.html
//
// draw.js is the drawing itself, kept as its own file so it stays ordinary
// browser JavaScript (no escaping, no module resolution, no network): gen.mjs
// reads it and puts it inside a <script> tag, and the browser paints it on load.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const draw = readFileSync(join(HERE, 'draw.js'), 'utf8');

if (draw.includes('</script')) {
  throw new Error('draw.js contains a closing script tag and cannot be inlined');
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>steam, gloss and one perfect bowl</title>
<style>
  html, body { margin: 0; padding: 0; background: #0d0704; }
  canvas { display: block; width: 1024px; height: 1024px; }
</style>
</head>
<body>
<canvas id="c" width="1024" height="1024"></canvas>
<script>
${draw}
</script>
</body>
</html>
`;

writeFileSync(join(HERE, 'art.html'), page);
console.log(`art.html: ${page.length} bytes, drawing inlined from draw.js`);
