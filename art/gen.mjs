// Draws art.html: the picture this entry ships, as inline SVG at 1024x1024.
// Everything is deterministic (a fixed-seed PRNG, no Date, no Math.random), so the
// same source always renders the same picture.
//
//   node gen.mjs
//   chrome --headless=new --screenshot=v4.png art.html
//
// What it aims at: one hero bowl, shot close, key light from the upper left, a dark
// warm room behind it, everything in the bowl wet enough to shine, and a shallow
// depth of field that leaves the egg sharp and the room soft.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1024;

// ---------- a deterministic PRNG (mulberry32) ----------
let seed = 0x9e3779b9;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (lo, hi) => lo + rnd() * (hi - lo);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const n2 = (v) => Math.round(v * 100) / 100;

// ---------- the bowl's geometry ----------
const B = { cx: 512, cy: 512, rimRx: 466, rimRy: 178, inRx: 430, inRy: 158 };
const backLip = B.cy - B.inRy;
const frontLip = B.cy + B.inRy;
const TILT = -3.2;

const inBowl = (x, y, k = 0.97) => {
  const dx = (x - B.cx) / B.inRx;
  const dy = (y - B.cy) / B.inRy;
  return dx * dx + dy * dy <= k;
};

// Where a thing meets the broth: it occludes a crescent of it, and the broth
// throws a warm bounce back at its underside. Both are what stop it reading
// as a sticker lying on a flat surface.
function groundIt(cx, cy, rx, ry) {
  add(`<ellipse cx="${n2(cx)}" cy="${n2(cy + ry * 0.5)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="#291103" opacity="0.5" filter="url(#blurMid)"/>`);
  add(`<path d="M${n2(cx - rx * 0.9)} ${n2(cy + ry)} C ${n2(cx - rx * 0.3)} ${n2(cy + ry * 1.5)}, ${n2(cx + rx * 0.35)} ${n2(cy + ry * 1.5)}, ${n2(cx + rx * 0.9)} ${n2(cy + ry)}" stroke="#ffc172" stroke-width="${n2(ry * 0.5)}" fill="none" opacity="0.28" filter="url(#blurSoft)"/>`);
}
function brothPoint() {
  for (let tries = 0; tries < 40; tries += 1) {
    const x = rr(B.cx - B.inRx * 0.94, B.cx + B.inRx * 0.94);
    const y = rr(backLip + 12, frontLip - 6);
    if (inBowl(x, y, 0.94)) return [x, y];
  }
  return [B.cx, B.cy];
}

// A run of points along an ellipse, so a highlight lies exactly on the ring it
// lights instead of floating beside it.
function arcOnEllipse(cx, cy, rx, ry, a0, a1, steps = 28) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${n2(p[0])} ${n2(p[1])}`).join(' ');
}

// An organic closed outline: an ellipse with jittered radii, so nothing in the
// bowl is a perfect mathematical oval.
function blobPath(cx, cy, rx, ry, jitter = 0.06, points = 26) {
  const pts = [];
  for (let i = 0; i < points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + rr(-jitter, jitter);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  let d = `M${n2(pts[0][0])} ${n2(pts[0][1])}`;
  for (let i = 0; i < points; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % points];
    d += ` Q${n2(p[0])} ${n2(p[1])} ${n2((p[0] + q[0]) / 2)} ${n2((p[1] + q[1]) / 2)}`;
  }
  return d + ' Z';
}

const out = [];
const add = (s) => out.push(s);

// =====================================================================
//  defs
// =====================================================================
const defs = `
  <linearGradient id="wood" x1="0.02" y1="0" x2="0.95" y2="1">
    <stop offset="0" stop-color="#6d4626"/>
    <stop offset="0.24" stop-color="#412813"/>
    <stop offset="0.58" stop-color="#22150a"/>
    <stop offset="0.84" stop-color="#130b04"/>
    <stop offset="1" stop-color="#0a0503"/>
  </linearGradient>
  <radialGradient id="keyLight" cx="0.12" cy="0.03" r="0.95">
    <stop offset="0" stop-color="#ffcd93" stop-opacity="0.60"/>
    <stop offset="0.28" stop-color="#e79b46" stop-opacity="0.24"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="cornerDark" cx="0.5" cy="0.5" r="0.52">
    <stop offset="0.52" stop-color="#000000" stop-opacity="0"/>
    <stop offset="0.86" stop-color="#150b03" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#080401" stop-opacity="0.85"/>
  </radialGradient>
  <radialGradient id="bokeh" cx="0.42" cy="0.38" r="0.7">
    <stop offset="0" stop-color="#ffe2ad" stop-opacity="0.92"/>
    <stop offset="0.58" stop-color="#ffa646" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/>
  </radialGradient>

  <filter id="blurFar" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="38"/></filter>
  <filter id="blurBig" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="blurMid" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation="12"/></filter>
  <filter id="blurSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="blurTiny" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="blurDepth" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="1.5"/></filter>
  <filter id="steamBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="steamSharp" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="1.1 0.03" numOctaves="2" seed="11"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
  </filter>
  <filter id="brothGrain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="3" seed="23"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope="0.3"/></feComponentTransfer>
  </filter>

  <linearGradient id="porcelain" x1="0.06" y1="0" x2="0.94" y2="1">
    <stop offset="0" stop-color="#fffdf9"/>
    <stop offset="0.14" stop-color="#f7eee2"/>
    <stop offset="0.38" stop-color="#ded0bc"/>
    <stop offset="0.64" stop-color="#b3a28b"/>
    <stop offset="0.86" stop-color="#857664"/>
    <stop offset="1" stop-color="#544a3e"/>
  </linearGradient>
  <linearGradient id="porcelainLit" x1="0.1" y1="0" x2="0.7" y2="1">
    <stop offset="0" stop-color="#fffdf8" stop-opacity="0.95"/>
    <stop offset="0.4" stop-color="#fff4e2" stop-opacity="0.45"/>
    <stop offset="1" stop-color="#e8d6bb" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="innerWall" x1="0.15" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#e6dac4"/>
    <stop offset="0.32" stop-color="#b3a28a"/>
    <stop offset="0.72" stop-color="#726656"/>
    <stop offset="1" stop-color="#3e372e"/>
  </linearGradient>
  <linearGradient id="wallShade" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0" stop-color="#2a1c0c" stop-opacity="0.05"/>
    <stop offset="0.55" stop-color="#2a1c0c" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#170d03" stop-opacity="0.8"/>
  </linearGradient>
  <filter id="dropSoft" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="22" dy="32" stdDeviation="32" flood-color="#0c0501" flood-opacity="0.82"/>
  </filter>

  <radialGradient id="broth" cx="0.3" cy="0.14" r="1.0">
    <stop offset="0" stop-color="#f2b76b"/>
    <stop offset="0.2" stop-color="#db9542"/>
    <stop offset="0.44" stop-color="#bd6c22"/>
    <stop offset="0.68" stop-color="#994a0e"/>
    <stop offset="0.88" stop-color="#6b3007"/>
    <stop offset="1" stop-color="#451d04"/>
  </radialGradient>
  <radialGradient id="sheen" cx="0.3" cy="0.18" r="0.6">
    <stop offset="0" stop-color="#ffe6b2" stop-opacity="0.8"/>
    <stop offset="0.5" stop-color="#ffc172" stop-opacity="0.28"/>
    <stop offset="1" stop-color="#ffab52" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="meniscus" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0.56" stop-color="#000000" stop-opacity="0"/>
    <stop offset="0.88" stop-color="#3a1904" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#1c0b02" stop-opacity="0.82"/>
  </radialGradient>

  <linearGradient id="strand" x1="0" y1="0" x2="0.25" y2="1">
    <stop offset="0" stop-color="#fffbe8"/>
    <stop offset="0.34" stop-color="#f9e2a0"/>
    <stop offset="0.72" stop-color="#e2b75c"/>
    <stop offset="1" stop-color="#bd8d34"/>
  </linearGradient>

  <radialGradient id="yolk" cx="0.3" cy="0.22" r="0.85">
    <stop offset="0" stop-color="#ffefac"/>
    <stop offset="0.24" stop-color="#ffc444"/>
    <stop offset="0.56" stop-color="#f68f12"/>
    <stop offset="0.84" stop-color="#cf5c05"/>
    <stop offset="1" stop-color="#9d3c08"/>
  </radialGradient>
  <linearGradient id="white" x1="0.12" y1="0" x2="0.88" y2="1">
    <stop offset="0" stop-color="#fffefa"/>
    <stop offset="0.42" stop-color="#f7ecdc"/>
    <stop offset="0.82" stop-color="#dccbb1"/>
    <stop offset="1" stop-color="#bda98c"/>
  </linearGradient>
  <radialGradient id="pork" cx="0.32" cy="0.24" r="0.95">
    <stop offset="0" stop-color="#f9d2a8"/>
    <stop offset="0.28" stop-color="#e5a06d"/>
    <stop offset="0.58" stop-color="#bc7539"/>
    <stop offset="0.84" stop-color="#8d4a1c"/>
    <stop offset="1" stop-color="#5f2c0b"/>
  </radialGradient>
  <linearGradient id="fatCap" x1="0" y1="0" x2="0.3" y2="1">
    <stop offset="0" stop-color="#ffeed6" stop-opacity="0.85"/>
    <stop offset="0.6" stop-color="#f7d6ae" stop-opacity="0.5"/>
    <stop offset="1" stop-color="#e0b184" stop-opacity="0.2"/>
  </linearGradient>
  <linearGradient id="nori" x1="0.05" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#6fb391"/>
    <stop offset="0.2" stop-color="#3c7b5f"/>
    <stop offset="0.5" stop-color="#235442"/>
    <stop offset="0.8" stop-color="#123227"/>
    <stop offset="1" stop-color="#071812"/>
  </linearGradient>
  <radialGradient id="oil" cx="0.34" cy="0.3" r="0.82">
    <stop offset="0" stop-color="#f7a05a"/>
    <stop offset="0.45" stop-color="#d9521a"/>
    <stop offset="1" stop-color="#8e2204"/>
  </radialGradient>
  <linearGradient id="oilFilm" x1="0.1" y1="0" x2="0.9" y2="1">
    <stop offset="0" stop-color="#e8621f" stop-opacity="0.55"/>
    <stop offset="0.5" stop-color="#c8390d" stop-opacity="0.42"/>
    <stop offset="1" stop-color="#8c1e03" stop-opacity="0.3"/>
  </linearGradient>

  <clipPath id="interior"><ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.inRx}" ry="${B.inRy}"/></clipPath>
  <clipPath id="bowlBody"><path d="M${B.cx - B.rimRx} ${B.cy} C ${B.cx - B.rimRx + 4} ${B.cy + 320},
     ${B.cx - 250} ${B.cy + 496}, ${B.cx} ${B.cy + 512} C ${B.cx + 250} ${B.cy + 496},
     ${B.cx + B.rimRx - 4} ${B.cy + 320}, ${B.cx + B.rimRx} ${B.cy} Z"/></clipPath>
  <clipPath id="aboveRim"><rect x="0" y="0" width="${W}" height="${B.cy + 40}"/></clipPath>
`;

// =====================================================================
//  the room, out of focus behind the bowl
// =====================================================================
add(`<rect width="${W}" height="${W}" fill="url(#wood)"/>`);
add(`<rect width="${W}" height="${W}" fill="#000" filter="url(#grain)" opacity="0.08"/>`);
for (let i = 0; i < 10; i += 1) {
  const r = rr(40, 120);
  add(`<circle cx="${n2(rr(30, 1000))}" cy="${n2(rr(20, 980))}" r="${n2(r)}" fill="url(#bokeh)" opacity="${n2(rr(0.2, 0.55))}" filter="url(#${r > 82 ? 'blurFar' : 'blurBig'})"/>`);
}
for (let i = 0; i < 7; i += 1) {
  add(`<circle cx="${n2(rr(50, 970))}" cy="${n2(rr(20, 300))}" r="${n2(rr(2, 5))}" fill="#ffe6bb" opacity="0.45" filter="url(#blurTiny)"/>`);
}

// ---- steam on the far side: a soft dark shape, then light wisps over it ----
const wisps = [];
for (let i = 0; i < 6; i += 1) {
  const x0 = rr(300, 730);
  const y0 = rr(300, 400);
  wisps.push({ x0, y0, a: rr(60, 120), b: rr(50, 110), c: rr(20, 80), h: rr(200, 300), w: rr(18, 44) });
}
const wispPath = (s) =>
  `M${n2(s.x0)} ${n2(s.y0)} C ${n2(s.x0 - s.a)} ${n2(s.y0 - s.h * 0.35)}, ${n2(s.x0 + s.b)} ${n2(s.y0 - s.h * 0.65)}, ${n2(s.x0 - s.c)} ${n2(s.y0 - s.h)}`;
add('<g filter="url(#steamBlur)" fill="none" stroke="#5a3a1c" stroke-linecap="round" opacity="0.35">');
for (const s of wisps) add(`<path d="${wispPath(s)}" stroke-width="${n2(s.w + 14)}"/>`);
add('</g>');
add('<g filter="url(#steamBlur)" fill="none" stroke="#ffe9cd" stroke-linecap="round" opacity="0.3">');
for (const s of wisps) add(`<path d="${wispPath(s)}" stroke-width="${n2(s.w)}"/>`);
add('</g>');
add(`<ellipse cx="330" cy="240" rx="330" ry="200" fill="#ffb86a" opacity="0.09" filter="url(#blurFar)"/>`);

// =====================================================================
//  the bowl
// =====================================================================
add(`<ellipse cx="${B.cx + 10}" cy="${B.cy + 430}" rx="${B.rimRx - 26}" ry="108" fill="#060200" opacity="0.88" filter="url(#blurFar)"/>`);
add(`<g transform="rotate(${TILT} ${B.cx} ${B.cy}) scale(1.1) translate(${n2(-B.cx * 0.1)} ${n2(-B.cy * 0.1 - 14)})">`);
add(`<g filter="url(#dropSoft)"><path d="M${B.cx - B.rimRx} ${B.cy} C ${B.cx - B.rimRx + 4} ${B.cy + 320}, ${B.cx - 250} ${B.cy + 496}, ${B.cx} ${B.cy + 512} C ${B.cx + 250} ${B.cy + 496}, ${B.cx + B.rimRx - 4} ${B.cy + 320}, ${B.cx + B.rimRx} ${B.cy} Z" fill="url(#porcelain)"/></g>`);
add('<g clip-path="url(#bowlBody)">');
add(`<path d="M${B.cx - B.rimRx} ${B.cy} C ${B.cx - B.rimRx + 2} ${B.cy + 210}, ${B.cx - 330} ${B.cy + 400}, ${B.cx - 110} ${B.cy + 494} C ${B.cx - 262} ${B.cy + 380}, ${B.cx - 348} ${B.cy + 190}, ${B.cx - 336} ${B.cy} Z" fill="url(#porcelainLit)"/>`);
add(`<path d="M${B.cx + B.rimRx} ${B.cy} C ${B.cx + B.rimRx - 4} ${B.cy + 280}, ${B.cx + 320} ${B.cy + 440}, ${B.cx + 130} ${B.cy + 506} C ${B.cx + 322} ${B.cy + 420}, ${B.cx + 430} ${B.cy + 230}, ${B.cx + 430} ${B.cy} Z" fill="#130902" opacity="0.58"/>`);
add(`<ellipse cx="${B.cx - 60}" cy="${B.cy + 492}" rx="340" ry="74" fill="#ffb15e" opacity="0.20" filter="url(#blurBig)"/>`);
add(`<path d="M${B.cx - 150} ${B.cy + 480} C ${B.cx - 80} ${B.cy + 434}, ${B.cx + 40} ${B.cy + 432}, ${B.cx + 100} ${B.cy + 474}" stroke="#fff3dc" stroke-width="18" fill="none" opacity="0.30" filter="url(#blurMid)"/>`);
add(`<ellipse cx="${B.cx - 258}" cy="${B.cy + 210}" rx="64" ry="140" fill="#fff" opacity="0.14" filter="url(#blurBig)"/>`);
add('</g>');

add(`<ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.rimRx - 18}" ry="${B.rimRy - 8}" fill="none" stroke="url(#porcelain)" stroke-width="36"/>`);
add(`<ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.rimRx - 18}" ry="${B.rimRy - 8}" fill="none" stroke="#fffdf6" stroke-width="7" opacity="0.45" filter="url(#blurTiny)"/>`);
add(`<path d="${arcOnEllipse(B.cx, B.cy, B.rimRx - 18, B.rimRy - 8, 166, 284)}" stroke="#fffdf6" stroke-width="11" fill="none" opacity="0.55" filter="url(#blurSoft)" stroke-linecap="round"/>`);
add(`<path d="${arcOnEllipse(B.cx, B.cy, B.rimRx - 18, B.rimRy - 8, 10, 120)}" stroke="#241505" stroke-width="13" fill="none" opacity="0.4" filter="url(#blurSoft)" stroke-linecap="round"/>`);

add(`<ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.inRx}" ry="${B.inRy}" fill="url(#innerWall)"/>`);

// =====================================================================
//  inside the rim
// =====================================================================
add('<g clip-path="url(#interior)">');
add(`<rect x="${B.cx - B.inRx}" y="${backLip}" width="${B.inRx * 2}" height="${B.inRy * 2 + 12}" fill="url(#broth)"/>`);
add(`<rect x="${B.cx - B.inRx}" y="${backLip}" width="${B.inRx * 2}" height="${B.inRy * 2 + 12}" filter="url(#brothGrain)" opacity="0.2"/>`);

// the window the broth is mirroring: a big soft pane of light, and its sharp edge
add(`<ellipse cx="${B.cx - 150}" cy="${B.cy - 44}" rx="264" ry="74" fill="#fff2d6" opacity="0.16" filter="url(#blurBig)"/>`);
add(`<path d="M${B.cx - 386} ${B.cy - 52} C ${B.cx - 300} ${B.cy - 84}, ${B.cx - 150} ${B.cy - 88}, ${B.cx - 20} ${B.cy - 66}" stroke="#ffeed2" stroke-width="14" fill="none" opacity="0.30" filter="url(#blurSoft)"/>`);
add(`<path d="M${B.cx - 340} ${B.cy - 20} C ${B.cx - 270} ${B.cy - 42}, ${B.cx - 170} ${B.cy - 44}, ${B.cx - 96} ${B.cy - 28}" stroke="#ffe6bd" stroke-width="7" fill="none" opacity="0.22" filter="url(#blurSoft)"/>`);
add(`<ellipse cx="${B.cx - 100}" cy="${B.cy - 66}" rx="300" ry="84" fill="url(#sheen)"/>`);

// ---- what the broth mirrors: a dark blurred copy of what stands above it ----
add('<g opacity="0.30" filter="url(#blurBig)">');
add(`<ellipse cx="${B.cx - 152}" cy="${B.cy + 214}" rx="150" ry="52" fill="#f2e3c6"/>`);
add(`<ellipse cx="${B.cx + 258}" cy="${B.cy + 218}" rx="120" ry="44" fill="#d99a63"/>`);
add(`<path d="M${B.cx - 250} ${B.cy + 150} C ${B.cx - 190} ${B.cy + 196}, ${B.cx - 40} ${B.cy + 200}, ${B.cx + 110} ${B.cy + 168} L ${B.cx + 96} ${B.cy + 130} C ${B.cx - 40} ${B.cy + 160}, ${B.cx - 190} ${B.cy + 156}, ${B.cx - 244} ${B.cy + 118} Z" fill="#0b1a12"/>`);
add('</g>');

// ---- the nori: a sheet standing at the back, wet, curling, softly out of focus ----
add('<g filter="url(#blurDepth)" transform="translate(-46 4)">');
add(`<path d="M${B.cx - 262} ${B.cy - 66} C ${B.cx - 260} ${B.cy - 176}, ${B.cx - 248} ${B.cy - 274}, ${B.cx - 224} ${B.cy - 348}
   C ${B.cx - 200} ${B.cy - 366}, ${B.cx - 176} ${B.cy - 338}, ${B.cx - 158} ${B.cy - 364}
   C ${B.cx - 78} ${B.cy - 392}, ${B.cx + 24} ${B.cy - 388}, ${B.cx + 118} ${B.cy - 352}
   C ${B.cx + 130} ${B.cy - 376}, ${B.cx + 156} ${B.cy - 384}, ${B.cx + 168} ${B.cy - 358}
   C ${B.cx + 160} ${B.cy - 266}, ${B.cx + 148} ${B.cy - 174}, ${B.cx + 140} ${B.cy - 70} Z" fill="url(#nori)"/>`);
// the sheet's lit left edge, its ribbed grain, and the gloss a wet nori holds
add(`<path d="M${B.cx - 262} ${B.cy - 66} C ${B.cx - 260} ${B.cy - 176}, ${B.cx - 248} ${B.cy - 274}, ${B.cx - 224} ${B.cy - 348} C ${B.cx - 246} ${B.cy - 318}, ${B.cx - 258} ${B.cy - 218}, ${B.cx - 262} ${B.cy - 120} Z" fill="#9ad9b7" opacity="0.5"/>`);
for (let i = 0; i < 8; i += 1) {
  const x = B.cx - 232 + i * 48;
  add(`<path d="M${n2(x)} ${n2(B.cy - 344 + i * 3)} C ${n2(x - 8)} ${n2(B.cy - 264)}, ${n2(x - 6)} ${n2(B.cy - 168)}, ${n2(x + 3)} ${n2(B.cy - 72)}" stroke="#5c9c7a" stroke-width="2.2" fill="none" opacity="0.24"/>`);
}
// the wet sheen across the sheet, and its lit top edge
add(`<path d="M${B.cx - 200} ${B.cy - 300} C ${B.cx - 100} ${B.cy - 330}, ${B.cx + 20} ${B.cy - 326}, ${B.cx + 110} ${B.cy - 296} C ${B.cx + 20} ${B.cy - 306}, ${B.cx - 100} ${B.cy - 308}, ${B.cx - 200} ${B.cy - 286} Z" fill="#b4f0d2" opacity="0.45"/>`);
add(`<path d="M${B.cx - 224} ${B.cy - 348} C ${B.cx - 170} ${B.cy - 370}, ${B.cx + 60} ${B.cy - 390}, ${B.cx + 118} ${B.cy - 352} C ${B.cx + 40} ${B.cy - 368}, ${B.cx - 150} ${B.cy - 358}, ${B.cx - 224} ${B.cy - 344} Z" fill="#d6fbe6" opacity="0.75"/>`);
add(`<ellipse cx="${B.cx - 60}" cy="${B.cy - 300}" rx="150" ry="60" fill="#8fe0bb" opacity="0.18" filter="url(#blurMid)"/>`);
add(`<path d="M${B.cx + 140} ${B.cy - 70} C ${B.cx + 132} ${B.cy - 176}, ${B.cx + 130} ${B.cy - 268}, ${B.cx + 146} ${B.cy - 344} C ${B.cx + 168} ${B.cy - 300}, ${B.cx + 172} ${B.cy - 170}, ${B.cx + 160} ${B.cy - 62} Z" fill="#010605" opacity="0.7"/>`);
add(`<ellipse cx="${B.cx - 60}" cy="${B.cy - 58}" rx="190" ry="24" fill="#0d0601" opacity="0.5" filter="url(#blurMid)"/>`);
add('</g>');

// ---- the noodles: a nest of strands, right of centre ----
const nest = { cx: B.cx + 116, cy: B.cy + 46, rx: 224, ry: 90 };
const strands = [];
for (let i = 0; i < 46; i += 1) {
  const y = nest.cy + rr(-nest.ry, nest.ry);
  // a mound, not a rectangle: strands near the top of the pile are shorter
  const mound = Math.sqrt(Math.max(0.04, 1 - Math.pow((y - nest.cy) / (nest.ry * 1.02), 2)));
  const half = nest.rx * Math.pow(mound, 0.55) * rr(0.82, 1.04);
  const x0 = nest.cx - half;
  const x1 = nest.cx + half;
  const w = x1 - x0;
  const a1 = rr(14, 40);
  const a2 = rr(10, 34);
  const a3 = rr(12, 38);
  const rise = rr(-10, 10);
  // two opposed curves in one strand: the S a cooked noodle falls into
  strands.push({
    y,
    d:
      `M${n2(x0)} ${n2(y + rise)}` +
      ` C ${n2(x0 + w * 0.22)} ${n2(y - a1)} ${n2(x0 + w * 0.34)} ${n2(y + a1)} ${n2(x0 + w * 0.5)} ${n2(y - rise)}` +
      ` C ${n2(x0 + w * 0.68)} ${n2(y - a2)} ${n2(x0 + w * 0.8)} ${n2(y + a2)} ${n2(x1)} ${n2(y + rr(-9, 9))}`,
    w: rr(6, 15),
  });
}
// a few coiled strands lying flat on the pile
for (let i = 0; i < 4; i += 1) {
  const cx = nest.cx + rr(-nest.rx * 0.6, nest.rx * 0.6);
  const cy = nest.cy + rr(-nest.ry * 0.6, nest.ry * 0.6);
  const r = rr(24, 46);
  strands.push({
    y: cy,
    d: `M${n2(cx)} ${n2(cy)} a ${n2(r)} ${n2(r * 0.62)} 0 1 1 ${n2(r * 1.5)} ${n2(r * 0.12)} a ${n2(r * 0.78)} ${n2(r * 0.5)} 0 1 1 ${n2(-r * 1.4)} ${n2(r * 0.06)}`,
    w: rr(7, 11),
  });
}
strands.sort((a, b) => a.y - b.y);
// a darker bed under the pile, so pale strands have something to be pale against
add(`<ellipse cx="${nest.cx - 6}" cy="${nest.cy + 34}" rx="${n2(nest.rx * 0.96)}" ry="${n2(nest.ry * 0.86)}" fill="#4a2205" opacity="0.55" filter="url(#blurMid)"/>`);
add('<g fill="none" stroke-linecap="round">');
for (const s of strands) add(`<path d="${s.d}" stroke="#532c04" stroke-width="${n2(s.w + 7)}" opacity="0.55" transform="translate(2.5 7)"/>`);
for (const s of strands) add(`<path d="${s.d}" stroke="#4a2703" stroke-width="${n2(s.w + 3)}" opacity="0.5"/>`);
for (const s of strands) add(`<path d="${s.d}" stroke="url(#strand)" stroke-width="${n2(s.w)}"/>`);
// the broth coating the lower strands: a translucent amber skin over each
for (const s of strands) {
  if (s.y > nest.cy - 40 && rnd() < 0.6) {
    add(`<path d="${s.d}" stroke="#b8640f" stroke-width="${n2(s.w * 1.1)}" opacity="${n2(rr(0.18, 0.34))}"/>`);
  }
}
for (const s of strands) {
  if (rnd() < 0.8) add(`<path d="${s.d}" stroke="#fffbe9" stroke-width="${n2(Math.max(1.3, s.w * 0.24))}" opacity="0.5" transform="translate(-1.4 -${n2(s.w * 0.32)})"/>`);
}
// a few strands lifted clear of the pile and left to trail into the broth
const lifted = [
  `M${n2(nest.cx - 214)} ${n2(nest.cy + 58)} C ${n2(nest.cx - 90)} ${n2(nest.cy - 62)}, ${n2(nest.cx + 80)} ${n2(nest.cy + 66)}, ${n2(nest.cx + 208)} ${n2(nest.cy - 34)}`,
  `M${n2(nest.cx - 190)} ${n2(nest.cy + 92)} C ${n2(nest.cx - 40)} ${n2(nest.cy + 96)}, ${n2(nest.cx + 90)} ${n2(nest.cy + 20)}, ${n2(nest.cx + 236)} ${n2(nest.cy + 34)}`,
  `M${n2(nest.cx - 150)} ${n2(nest.cy - 44)} C ${n2(nest.cx - 20)} ${n2(nest.cy - 78)}, ${n2(nest.cx + 90)} ${n2(nest.cy - 30)}, ${n2(nest.cx + 250)} ${n2(nest.cy - 62)}`,
];
for (const d of lifted) {
  add(`<path d="${d}" stroke="#4a2703" stroke-width="16" opacity="0.45" transform="translate(3 8)"/>`);
  add(`<path d="${d}" stroke="url(#strand)" stroke-width="12"/>`);
  add(`<path d="${d}" stroke="#fffdf0" stroke-width="3.4" opacity="0.6" transform="translate(-1.5 -4)"/>`);
}
// and one strand falling off the front of the pile into the broth
add(`<path d="M${n2(nest.cx + 60)} ${n2(nest.cy + 96)} C ${n2(nest.cx + 120)} ${n2(nest.cy + 132)}, ${n2(nest.cx - 20)} ${n2(nest.cy + 150)}, ${n2(nest.cx - 120)} ${n2(nest.cy + 138)}" stroke="#4a2703" stroke-width="15" opacity="0.4" transform="translate(2 6)"/>`);
add(`<path d="M${n2(nest.cx + 60)} ${n2(nest.cy + 96)} C ${n2(nest.cx + 120)} ${n2(nest.cy + 132)}, ${n2(nest.cx - 20)} ${n2(nest.cy + 150)}, ${n2(nest.cx - 120)} ${n2(nest.cy + 138)}" stroke="url(#strand)" stroke-width="11" opacity="0.9"/>`);
add(`<path d="M${n2(nest.cx + 60)} ${n2(nest.cy + 96)} C ${n2(nest.cx + 120)} ${n2(nest.cy + 132)}, ${n2(nest.cx - 20)} ${n2(nest.cy + 150)}, ${n2(nest.cx - 120)} ${n2(nest.cy + 138)}" stroke="#fffdf0" stroke-width="3" opacity="0.5" transform="translate(-1 -3)"/>`);
add('</g>');
// the broth laps over the lowest strands, so they sit in it and not on it
add(`<ellipse cx="${nest.cx - 6}" cy="${nest.cy + 80}" rx="258" ry="52" fill="url(#broth)" opacity="0.6" filter="url(#blurSoft)"/>`);
add(`<ellipse cx="${nest.cx - 70}" cy="${nest.cy + 54}" rx="150" ry="22" fill="#f3b163" opacity="0.22" filter="url(#blurSoft)"/>`);
add(`<path d="M${nest.cx - 226} ${nest.cy + 62} C ${nest.cx - 120} ${nest.cy + 96}, ${nest.cx + 80} ${nest.cy + 96}, ${nest.cx + 208} ${nest.cy + 56}" stroke="#5d2a06" stroke-width="5" fill="none" opacity="0.5" filter="url(#blurSoft)"/>`);

// ---- the chashu: two braised pork slices, right of centre ----
function porkSlice(cx, cy, rx, ry, rot, fade) {
  add(`<g transform="rotate(${rot} ${n2(cx)} ${n2(cy)})" opacity="${fade}">`);
  add(`<path d="${blobPath(cx, cy, rx, ry, 0.05)}" fill="url(#pork)"/>`);
  // a thin dark rim where the braise caught, thicker along the lower edge
  add(`<path d="${blobPath(cx, cy, rx, ry, 0.05)}" fill="none" stroke="#6a2c08" stroke-width="6" opacity="0.8"/>`);
  add(`<path d="M${n2(cx - rx * 0.9)} ${n2(cy + ry * 0.45)} C ${n2(cx - rx * 0.3)} ${n2(cy + ry * 0.95)}, ${n2(cx + rx * 0.4)} ${n2(cy + ry * 0.9)}, ${n2(cx + rx * 0.92)} ${n2(cy + ry * 0.4)}" stroke="#3d1603" stroke-width="9" fill="none" opacity="0.6" filter="url(#blurTiny)"/>`);
  // a rolled belly, sliced: bands of fat and lean running across it
  for (let i = 0; i < 7; i += 1) {
    const y = cy + (-0.72 + (i / 6) * 1.44) * ry;
    const thick = rr(7, 16);
    const bow = rr(-16, 16);
    const lean = i % 2 === 0;
    add(`<path d="M${n2(cx - rx * 0.84)} ${n2(y)} Q ${n2(cx)} ${n2(y + bow)} ${n2(cx + rx * 0.84)} ${n2(y + rr(-5, 5))}"
       stroke="${lean ? pick(['#b0703c', '#9a5a28', '#7d4520']) : 'url(#fatCap)'}" stroke-width="${n2(thick)}" fill="none" opacity="${n2(lean ? rr(0.3, 0.5) : rr(0.45, 0.7))}"/>`);
  }
  // the grain of the lean, and the wet braise sitting on top of it
  for (let i = 0; i < 9; i += 1) {
    const y = cy + rr(-0.8, 0.8) * ry;
    const bend = rr(-8, 8);
    add(`<path d="M${n2(cx - rx * 0.8)} ${n2(y)} C ${n2(cx - rx * 0.25)} ${n2(y + bend)}, ${n2(cx + rx * 0.3)} ${n2(y - bend)}, ${n2(cx + rx * 0.8)} ${n2(y + rr(-4, 4))}"
       stroke="${pick(['#ffdcbb', '#e8b184', '#c88a52'])}" stroke-width="${n2(rr(1.4, 3.4))}" fill="none" opacity="${n2(rr(0.18, 0.4))}"/>`);
  }
  add(`<ellipse cx="${n2(cx - rx * 0.3)}" cy="${n2(cy - ry * 0.42)}" rx="${n2(rx * 0.4)}" ry="${n2(ry * 0.16)}" fill="#fff8ec" opacity="0.55" filter="url(#blurSoft)"/>`);
  add(`<ellipse cx="${n2(cx + rx * 0.34)}" cy="${n2(cy - ry * 0.18)}" rx="${n2(rx * 0.2)}" ry="${n2(ry * 0.1)}" fill="#ffe9d2" opacity="0.4" filter="url(#blurTiny)"/>`);
  add(`<ellipse cx="${n2(cx + rx * 0.08)}" cy="${n2(cy + ry * 0.72)}" rx="${n2(rx * 0.8)}" ry="${n2(ry * 0.18)}" fill="#4d1d05" opacity="0.4" filter="url(#blurMid)"/>`);
  add('</g>');
}
add(`<ellipse cx="${B.cx + 274}" cy="${B.cy + 108}" rx="132" ry="56" fill="#2b1002" opacity="0.62" filter="url(#blurMid)"/>`);
porkSlice(B.cx + 262, B.cy + 92, 128, 58, -7, 1);
porkSlice(B.cx + 372, B.cy - 22, 106, 48, 12, 0.97);
groundIt(B.cx + 262, B.cy + 136, 118, 18);
groundIt(B.cx + 372, B.cy + 22, 98, 14);

// ---- the egg: one soft-boiled half, cut side up, centre left ----
add('<g>');
add(`<ellipse cx="${B.cx - 136}" cy="${B.cy + 82}" rx="156" ry="78" fill="#200c01" opacity="0.62" filter="url(#blurMid)"/>`);
add(`<path d="${blobPath(B.cx - 152, B.cy + 56, 152, 90, 0.022, 30)}" fill="url(#white)"/>`);
add(`<path d="${blobPath(B.cx - 152, B.cy + 56, 152, 90, 0.022, 30)}" fill="none" stroke="#9d8763" stroke-width="5" opacity="0.4"/>`);
// the white's surface: a few pale ribbons of set albumen, and a soft edge
for (let i = 0; i < 5; i += 1) {
  add(`<ellipse cx="${n2(B.cx - 152 + rr(-90, 90))}" cy="${n2(B.cy + 56 + rr(-46, 46))}" rx="${n2(rr(28, 62))}" ry="${n2(rr(10, 22))}" fill="#fffdf6" opacity="${n2(rr(0.12, 0.26))}" filter="url(#blurMid)"/>`);
}
add(`<path d="M${B.cx - 292} ${B.cy + 20} C ${B.cx - 274} ${B.cy - 26}, ${B.cx - 176} ${B.cy - 44}, ${B.cx - 88} ${B.cy - 26} C ${B.cx - 190} ${B.cy - 8}, ${B.cx - 264} ${B.cy + 16}, ${B.cx - 292} ${B.cy + 20} Z" fill="#fffdf8" opacity="0.8" filter="url(#blurSoft)"/>`);
add(`<path d="M${B.cx - 286} ${B.cy + 88} C ${B.cx - 200} ${B.cy + 140}, ${B.cx - 60} ${B.cy + 142}, ${B.cx - 22} ${B.cy + 92} C ${B.cx - 120} ${B.cy + 118}, ${B.cx - 220} ${B.cy + 116}, ${B.cx - 286} ${B.cy + 88} Z" fill="#e8912f" opacity="0.5" filter="url(#blurSoft)"/>`);
add(`<ellipse cx="${B.cx - 118}" cy="${B.cy + 130}" rx="150" ry="26" fill="#a3906c" opacity="0.33" filter="url(#blurMid)"/>`);
// the far shell, rising behind the cut face: what a fried egg never has
add(`<ellipse cx="${B.cx - 146}" cy="${B.cy + 20}" rx="134" ry="82" fill="url(#white)"/>`);
add(`<path d="M${B.cx - 268} ${B.cy + 34} C ${B.cx - 254} ${B.cy - 22}, ${B.cx - 150} ${B.cy - 52}, ${B.cx - 40} ${B.cy - 34} C ${B.cx - 150} ${B.cy - 14}, ${B.cx - 244} ${B.cy + 12}, ${B.cx - 268} ${B.cy + 34} Z" fill="#fffdf8" opacity="0.85" filter="url(#blurSoft)"/>`);
add(`<ellipse cx="${B.cx - 146}" cy="${B.cy + 62}" rx="130" ry="42" fill="#c6b291" opacity="0.45" filter="url(#blurMid)"/>`);
// the cut face, then the yolk dome rising out of it: the yolk fills most of
// the face, which is what tells a halved egg from a fried one
add(`<path d="${blobPath(B.cx - 152, B.cy + 52, 138, 82, 0.022, 28)}" fill="#f2e5cf"/>`);
add(`<path d="${blobPath(B.cx - 152, B.cy + 52, 138, 82, 0.022, 28)}" fill="none" stroke="#c9b491" stroke-width="4" opacity="0.5"/>`);
add(`<ellipse cx="${B.cx - 152}" cy="${B.cy + 46}" rx="118" ry="74" fill="#f7d9a8" opacity="0.5" filter="url(#blurSoft)"/>`);
add(`<path d="${blobPath(B.cx - 152, B.cy + 46, 116, 70, 0.035, 30)}" fill="url(#yolk)"/>`);
// a jammy yolk is not one flat colour: pools of a deeper, wetter orange
for (let i = 0; i < 7; i += 1) {
  add(`<ellipse cx="${n2(B.cx - 152 + rr(-54, 54))}" cy="${n2(B.cy + 46 + rr(-30, 30))}" rx="${n2(rr(14, 34))}" ry="${n2(rr(9, 20))}" fill="${pick(['#e2760a', '#f29a1e', '#d9680c'])}" opacity="${n2(rr(0.2, 0.4))}" filter="url(#blurSoft)"/>`);
}
add(`<path d="${blobPath(B.cx - 152, B.cy + 44, 84, 50, 0.06, 24)}" fill="#ffd873" opacity="0.4" filter="url(#blurSoft)"/>`);
add(`<path d="${blobPath(B.cx - 152, B.cy + 46, 116, 70, 0.035, 30)}" fill="none" stroke="#a4450a" stroke-width="3.5" opacity="0.45"/>`);
// the shine that matters most: the key light, broken into two speculars
add(`<ellipse cx="${B.cx - 192}" cy="${B.cy + 18}" rx="36" ry="18" fill="#fffbe0" opacity="0.9" filter="url(#blurSoft)" transform="rotate(-18 ${B.cx - 192} ${B.cy + 18})"/>`);
add(`<ellipse cx="${B.cx - 206}" cy="${B.cy + 10}" rx="16" ry="8" fill="#ffffff" opacity="0.95" filter="url(#blurTiny)" transform="rotate(-18 ${B.cx - 206} ${B.cy + 10})"/>`);
add(`<ellipse cx="${B.cx - 104}" cy="${B.cy + 72}" rx="28" ry="13" fill="#b8480a" opacity="0.45" filter="url(#blurSoft)"/>`);
// one drip of yolk running over the white, thick and wet
add(`<path d="M${B.cx - 108} ${B.cy + 84} C ${B.cx - 96} ${B.cy + 106}, ${B.cx - 100} ${B.cy + 124}, ${B.cx - 118} ${B.cy + 130} C ${B.cx - 132} ${B.cy + 118}, ${B.cx - 134} ${B.cy + 98}, ${B.cx - 128} ${B.cy + 80} Z" fill="url(#yolk)"/>`);
add(`<ellipse cx="${B.cx - 116}" cy="${B.cy + 104}" rx="8" ry="11" fill="#fff4cd" opacity="0.8" filter="url(#blurTiny)"/>`);
add('</g>');
groundIt(B.cx - 152, B.cy + 134, 140, 20);

// ---- scallions: chopped rings, seen from above, with the broth showing through ----
add('<g>');
for (let i = 0; i < 30; i += 1) {
  const [x0, y0] = brothPoint();
  const r = rr(8, 21);
  const rot = rr(-70, 70);
  const green = pick(['#5ea534', '#4b8b27', '#6fb540', '#3d7a1b', '#529629']);
  const thin = rnd() < 0.28;
  const ry = r * (thin ? 0.42 : 0.62);
  add(`<g transform="rotate(${n2(rot)} ${n2(x0)} ${n2(y0)})">`);
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0 + r * 0.55)}" rx="${n2(r)}" ry="${n2(ry)}" fill="#163407" opacity="0.45" filter="url(#blurTiny)"/>`);
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0)}" rx="${n2(r)}" ry="${n2(ry)}" fill="${green}"/>`);
  // the pale inner wall of the ring, then the broth seen through its middle
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0)}" rx="${n2(r * 0.66)}" ry="${n2(ry * 0.66)}" fill="#dcefb8"/>`);
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0)}" rx="${n2(r * 0.42)}" ry="${n2(ry * 0.46)}" fill="#8a4a12" opacity="0.85"/>`);
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0 + ry * 0.2)}" rx="${n2(r * 0.3)}" ry="${n2(ry * 0.25)}" fill="#ffd9a0" opacity="0.3"/>`);
  add(`<ellipse cx="${n2(x0 - r * 0.3)}" cy="${n2(y0 - ry * 0.35)}" rx="${n2(r * 0.34)}" ry="${n2(ry * 0.16)}" fill="#f4ffe4" opacity="0.65"/>`);
  add('</g>');
}
add('</g>');

// ---- sesame ----
add('<g>');
for (let i = 0; i < 40; i += 1) {
  const [x0, y0] = brothPoint();
  const rot = rr(-80, 80);
  const rx = rr(4, 6);
  add(`<g transform="rotate(${n2(rot)} ${n2(x0)} ${n2(y0)})"><ellipse cx="${n2(x0)}" cy="${n2(y0)}" rx="${n2(rx)}" ry="${n2(rx * 0.62)}" fill="#f6e9c4"/>` +
      `<ellipse cx="${n2(x0)}" cy="${n2(y0 + rx * 0.4)}" rx="${n2(rx)}" ry="${n2(rx * 0.2)}" fill="#8a6a2c" opacity="0.4"/>` +
      `<ellipse cx="${n2(x0 - rx * 0.2)}" cy="${n2(y0 - rx * 0.3)}" rx="${n2(rx * 0.42)}" ry="${n2(rx * 0.24)}" fill="#fffdf2" opacity="0.85"/></g>`);
}
add('</g>');

// ---- chilli oil: a film on the broth, not discs floating in it ----
add('<g>');
// a few wide sheets of oil that follow the surface, softly edged
for (let i = 0; i < 6; i += 1) {
  const [x0, y0] = brothPoint();
  const rx = rr(70, 150);
  const ry = rx * rr(0.22, 0.34);
  const rot = rr(-22, 22);
  add(`<g transform="rotate(${n2(rot)} ${n2(x0)} ${n2(y0)})">`);
  add(`<path d="${blobPath(x0, y0, rx, ry, 0.16, 22)}" fill="url(#oilFilm)" filter="url(#blurTiny)"/>`);
  add(`<path d="${blobPath(x0, y0, rx * 0.94, ry * 0.9, 0.16, 22)}" fill="none" stroke="#ff9d55" stroke-width="2" opacity="0.28"/>`);
  // the pin-sharp glints an oil film throws back at the light
  for (let g = 0; g < 5; g += 1) {
    const gx = x0 + rr(-rx * 0.7, rx * 0.7);
    const gy = y0 + rr(-ry * 0.6, ry * 0.6);
    add(`<ellipse cx="${n2(gx)}" cy="${n2(gy)}" rx="${n2(rr(6, 20))}" ry="${n2(rr(1.6, 4))}" fill="#ffe9c4" opacity="${n2(rr(0.3, 0.6))}" filter="url(#blurTiny)"/>`);
  }
  add('</g>');
}
// and the beads of it that break away
for (let i = 0; i < 30; i += 1) {
  const [x0, y0] = brothPoint();
  const rx = rr(5, 16);
  const ry = rx * rr(0.5, 0.8);
  const rot = rr(-40, 40);
  add(`<g transform="rotate(${n2(rot)} ${n2(x0)} ${n2(y0)})">`);
  add(`<ellipse cx="${n2(x0)}" cy="${n2(y0)}" rx="${n2(rx)}" ry="${n2(ry)}" fill="url(#oil)" opacity="${n2(rr(0.55, 0.85))}"/>`);
  add(`<ellipse cx="${n2(x0 - rx * 0.28)}" cy="${n2(y0 - ry * 0.3)}" rx="${n2(rx * 0.34)}" ry="${n2(ry * 0.3)}" fill="#ffe3ba" opacity="0.6" filter="url(#blurTiny)"/>`);
  add('</g>');
}
add('</g>');

// ---- bubbles ----
add('<g>');
for (let i = 0; i < 26; i += 1) {
  const [x0, y0] = brothPoint();
  const r = rr(3.5, 11);
  add(`<circle cx="${n2(x0)}" cy="${n2(y0)}" r="${n2(r)}" fill="#3f1c02" opacity="${n2(rr(0.2, 0.4))}"/>`);
  add(`<circle cx="${n2(x0)}" cy="${n2(y0)}" r="${n2(r * 0.9)}" fill="#ffdfae" opacity="${n2(rr(0.14, 0.3))}"/>`);
  add(`<circle cx="${n2(x0 - r * 0.3)}" cy="${n2(y0 - r * 0.34)}" r="${n2(r * 0.32)}" fill="#fff6dd" opacity="0.6"/>`);
}
add('</g>');

// ---- the surface settles: meniscus at the wall, far wall in shadow ----
add(`<ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.inRx}" ry="${B.inRy}" fill="url(#meniscus)"/>`);
add(`<path d="M${B.cx - B.inRx} ${B.cy} C ${B.cx - B.inRx} ${B.cy - 132}, ${B.cx - 250} ${B.cy - 170}, ${B.cx} ${B.cy - 170} C ${B.cx + 250} ${B.cy - 170}, ${B.cx + B.inRx} ${B.cy - 132}, ${B.cx + B.inRx} ${B.cy} C ${B.cx + B.inRx} ${B.cy - 58}, ${B.cx + 200} ${B.cy - 96}, ${B.cx} ${B.cy - 96} C ${B.cx - 200} ${B.cy - 96}, ${B.cx - B.inRx} ${B.cy - 58}, ${B.cx - B.inRx} ${B.cy} Z" fill="#1b0c02" opacity="0.45"/>`);
add(`<ellipse cx="${B.cx}" cy="${B.cy}" rx="${B.inRx}" ry="${B.inRy}" fill="none" stroke="url(#wallShade)" stroke-width="26" opacity="0.55"/>`);
// the broth is not one flat tone: broad slow patches of light and shadow
add(`<ellipse cx="${B.cx + 150}" cy="${B.cy + 40}" rx="180" ry="60" fill="#7a3a08" opacity="0.22" filter="url(#blurBig)"/>`);
add(`<ellipse cx="${B.cx - 300}" cy="${B.cy + 60}" rx="140" ry="46" fill="#5c2703" opacity="0.26" filter="url(#blurBig)"/>`);
add(`<ellipse cx="${B.cx - 40}" cy="${B.cy + 96}" rx="220" ry="40" fill="#ffd08a" opacity="0.10" filter="url(#blurBig)"/>`);
add('</g>');

// =====================================================================
//  steam in front, and the light on top of it all
// =====================================================================
const frontWisps = [];
for (let i = 0; i < 9; i += 1) {
  const x0 = rr(300, 730);
  const y0 = rr(350, 460);
  frontWisps.push({ x0, y0, a: rr(50, 110), b: rr(40, 100), c: rr(20, 70), h: rr(190, 300), w: rr(16, 38) });
}
// the halo first, then a tighter core inside it, so the plume reads at 300 px
add(`<g clip-path="url(#aboveRim)" filter="url(#steamBlur)" fill="none" stroke="#fff2dd" stroke-linecap="round" opacity="0.34">`);
for (const s of frontWisps) add(`<path d="${wispPath(s)}" stroke-width="${n2(s.w * 1.7)}"/>`);
add('</g>');
add(`<g clip-path="url(#aboveRim)" filter="url(#steamSharp)" fill="none" stroke="#fffaf0" stroke-linecap="round" opacity="0.5">`);
for (const s of frontWisps) add(`<path d="${wispPath(s)}" stroke-width="${n2(s.w * 0.55)}"/>`);
add('</g>');
add(`<ellipse cx="360" cy="230" rx="320" ry="200" fill="#ffbc72" opacity="0.10" filter="url(#blurFar)"/>`);
add('</g>');

add(`<rect width="${W}" height="${W}" fill="url(#keyLight)" style="mix-blend-mode:screen"/>`);
add(`<rect width="${W}" height="${W}" fill="url(#cornerDark)" opacity="0.92"/>`);

// =====================================================================
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>steam, gloss and one perfect bowl</title>
<style>
  html, body { margin: 0; padding: 0; background: #0d0704; }
  svg { display: block; width: ${W}px; height: ${W}px; }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>${defs}</defs>
${out.join('\n')}
</svg>
</body>
</html>
`;
writeFileSync(join(HERE, 'art.html'), html);
console.log(`art.html written: ${html.length} bytes, ${out.length} elements`);
