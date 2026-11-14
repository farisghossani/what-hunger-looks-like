/* The drawing program: one bowl of ramen, 1024x1024, canvas 2D.
 *
 * This runs in the browser (art.html inlines it). gen.mjs never parses it, so it
 * is plain browser JavaScript: no imports, no modules, no network.
 *
 * Everything here is deterministic: one fixed-seed PRNG (mulberry32), no Date,
 * no Math.random, so the same source always draws the same picture.
 *
 * What it aims at: a close, warm picture of one bowl on a wooden table in a dark
 * room, key light from the upper left, and the egg as the hero.
 *
 * Four rules shape all of it.
 *
 * 1. Wet food is specular. Broth, a yolk, a strand of noodle and a slice of pork
 *    are all glossy, so the picture lives or dies on its small bright highlights
 *    -- but a highlight that clips to flat white loses its shape and reads as a
 *    sticker, so the tone curve at the end rolls the top off instead of blowing.
 *
 * 2. Nothing may be a clean geometric primitive. Every silhouette wobbles, every
 *    surface carries grain, and no two strands, droplets or ribbons repeat.
 *
 * 3. The sharpness is not uniform. Everything around the food is soft and
 *    everything that is food is crisp, and the gap between those two is the main
 *    thing that separates a photograph from a painting. So the focal subjects are
 *    drawn with almost no blur at all, the room is drawn drowned in it, and a
 *    depth-of-field pass and an unsharp pass fight over the difference at the end.
 *
 * 4. Everything sits *on* something. Every piece of food gets a tight dark
 *    contact shadow where it meets the broth or the food under it; without those
 *    the toppings float, which is the fastest way to look like clip art.
 *
 * The layers, back to front:
 *   1  the room   - a wall, a wooden table, warm bokeh, all of it out of focus
 *   2  the bowl   - cast shadow, body, cream stoneware rim with its own gleam
 *   3  the broth  - amber shoyu: mottled, rippled, with the window mirrored in it
 *   4  the surface- oil, bubbles and the meniscus, *under* the food, so that
 *                   nothing is ever scattered across the top of the pork
 *   5  noodles    - submerged ribbons, a film of broth over them, then the
 *                   ribbons above the surface drawn crisp
 *   6  chashu     - seared edge, fat and lean in soft bending bands, wet top
 *   7  the egg    - an elongated, lobed white, a browned ruffled edge, and a
 *                   jammy yolk set *into* the white with its light spread out
 *   8  garnish    - scallion slivers, chilli, sesame, resting on the food
 *   9  steam      - three low-opacity plumes, blurred by degrees, no hard edges
 *  10  the film   - bloom, depth of field, tone curve, unsharp, grain, vignette
 */

(function () {
  'use strict';

  var W = 1024;
  var cv = document.getElementById('c');
  var ctx = cv.getContext('2d', { alpha: false, willReadFrequently: true });

  /* ---------- a deterministic PRNG ---------- */
  var _s = 0x9e3779b9;
  function rnd() {
    _s |= 0;
    _s = (_s + 0x6d2b79f5) | 0;
    var t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rr(a, b) { return a + rnd() * (b - a); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  /* ---------- drawing helpers ---------- */

  function blurred(px, fn) {
    ctx.save();
    if (px > 0) ctx.filter = 'blur(' + px + 'px)';
    fn();
    ctx.restore();
  }

  // A closed organic blob: a circle whose radius wobbles with sine harmonics, so
  // the outline stays smooth and can be re-used for a shadow or a rim.
  function blobPath(cx, cy, rx, ry, amp, ph, steps, rot) {
    var n = steps || 110;
    var ca = Math.cos(rot || 0), sa = Math.sin(rot || 0);
    ctx.beginPath();
    for (var i = 0; i <= n; i++) {
      var t = (i / n) * Math.PI * 2;
      var w = 1 + amp * (Math.sin(3 * t + ph[0]) * 0.5 +
                         Math.sin(5 * t + ph[1]) * 0.32 +
                         Math.sin(8 * t + ph[2]) * 0.22 +
                         Math.sin(13 * t + ph[3]) * 0.14);
      var px = Math.cos(t) * rx * w, py = Math.sin(t) * ry * w;
      var x = cx + px * ca - py * sa, y = cy + px * sa + py * ca;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function phases() { return [rr(0, 6.28), rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)]; }

  function softEllipse(x, y, rx, ry, style, alpha, blur) {
    blurred(blur, function () {
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = style;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // The occlusion shadow that holds a piece of food down onto what is under it:
  // tight, dark, and offset away from the key light.
  function contact(x, y, rx, ry, alpha) {
    blurred(3.5, function () {
      ctx.globalAlpha = alpha === undefined ? 0.62 : alpha;
      ctx.beginPath();
      ctx.ellipse(x + 5, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a0b02';
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // The waterline. Where a piece of food crosses the surface of the broth, three
  // things happen at once: the part below the surface is dimmed by the broth in
  // front of it, the surface catches a bright line where it meets the food, and
  // the surface casts a thin dark line just under that. Without them the food
  // reads as a decal pasted onto the picture instead of sitting in the bowl.
  function waterline(rx, ry, level, dim) {
    var y = ry * (level === undefined ? 0.35 : level);
    ctx.save();
    ctx.beginPath();
    ctx.rect(-rx * 2, y, rx * 4, ry * 5);
    ctx.clip();
    blurred(1.6, function () {
      ctx.globalAlpha = dim === undefined ? 0.30 : dim;
      var g = ctx.createLinearGradient(0, y, 0, y + ry * 0.9);
      g.addColorStop(0, 'rgba(150,84,28,0.55)');
      g.addColorStop(1, 'rgba(150,84,28,1)');
      ctx.fillStyle = g;
      ctx.fillRect(-rx * 2, y, rx * 4, ry * 5);
      ctx.globalAlpha = 1;
    });
    ctx.restore();

    // the bright line where the surface climbs onto the food
    blurred(2, function () {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffe3b4';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.9, y - 2);
      ctx.quadraticCurveTo(0, y + 6, rx * 0.9, y - 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // and the thin shadow the surface throws under it
    blurred(3, function () {
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = '#2a1405';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.88, y + 7);
      ctx.quadraticCurveTo(0, y + 14, rx * 0.88, y + 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  function glow(x, y, r, c, a0, blur) {
    blurred(blur, function () {
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a0 + ')');
      g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }

  // The wet gleam that lies along a direction: on meat, on a rim, on a strand.
  function sheen(x, y, len, thick, rot, c, alpha, blur) {
    blurred(blur, function () {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, len);
      g.addColorStop(0, rgb(c));
      g.addColorStop(0.5, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0.3)');
      g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
      ctx.beginPath();
      ctx.ellipse(0, 0, len, thick, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    });
  }

  function noiseCanvas(size, seedVal, mono) {
    var n = document.createElement('canvas');
    n.width = size; n.height = size;
    var c = n.getContext('2d');
    var img = c.createImageData(size, size);
    var s = seedVal >>> 0;
    for (var i = 0; i < size * size; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      var v = (s >>> 16) & 255;
      var o = i * 4;
      img.data[o] = v;
      img.data[o + 1] = mono ? v : ((s >>> 8) & 255);
      img.data[o + 2] = mono ? v : ((s >>> 24) & 255);
      img.data[o + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    return n;
  }

  // grain over a region: the tooth that makes a surface a material
  function tooth(amount, blur, seedV, x0, y0, x1, y1) {
    var t = noiseCanvas(160, seedV, true);
    blurred(blur, function () {
      ctx.globalAlpha = amount;
      ctx.globalCompositeOperation = 'overlay';
      ctx.drawImage(t, x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  /* ---------- geometry ---------- */
  var HORIZON = 246;
  var BOWL = { cx: 512, cy: 500, rx: 392, ry: 222 };
  var BROTH = { cx: 512, cy: 500, rx: 351, ry: 191 };

  // what the food covers, so that nothing is scattered on top of it later
  var EGG = { x: 378, y: 498, rx: 126, ry: 96 };
  var PORK = [{ x: 712, y: 600, rx: 132, ry: 78 }, { x: 800, y: 520, rx: 118, ry: 70 }];

  function inBroth(x, y, k) {
    var dx = (x - BROTH.cx) / BROTH.rx;
    var dy = (y - BROTH.cy) / BROTH.ry;
    return dx * dx + dy * dy <= (k || 1);
  }

  // clear of the egg, the pork and the noodle nest: open broth, where a droplet
  // or a bubble can sit without appearing to float on the food
  function inOpenBroth(x, y) {
    if (!inBroth(x, y, 0.9)) return false;
    var i, ex = (x - EGG.x) / (EGG.rx + 20), ey = (y - EGG.y) / (EGG.ry + 20);
    if (ex * ex + ey * ey < 1) return false;
    for (i = 0; i < PORK.length; i++) {
      var p = PORK[i];
      var px = (x - p.x) / (p.rx + 18), py = (y - p.y) / (p.ry + 18);
      if (px * px + py * py < 1) return false;
    }
    if (x > 330 && x < 850 && y > 400 && y < 610) return false;
    return true;
  }

  function brothBoundary(inset) {
    ctx.beginPath();
    var n = 150;
    for (var i = 0; i <= n; i++) {
      var t = (i / n) * Math.PI * 2;
      var w = 1 + 0.006 * Math.sin(4 * t + 0.7) + 0.004 * Math.sin(9 * t + 2.1);
      var x = BROTH.cx + Math.cos(t) * (BROTH.rx - inset) * w;
      var y = BROTH.cy + Math.sin(t) * (BROTH.ry - inset * 0.55) * w;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  /* =====================================================================
     1. THE ROOM: a wall, and a wooden table the bowl stands on
     ===================================================================== */
  function drawRoom() {
    var wg = ctx.createLinearGradient(120, -80, 900, HORIZON + 120);
    wg.addColorStop(0, '#402610');
    wg.addColorStop(0.45, '#251405');
    wg.addColorStop(1, '#130a03');
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, W, HORIZON + 40);

    glow(110, 30, 540, [255, 204, 136], 0.34, 70);
    glow(900, 80, 400, [255, 168, 98], 0.14, 80);
    var i;
    for (i = 0; i < 9; i++) {
      glow(rr(-40, 1080), rr(-40, 240), rr(28, 82), [255, 218, 162], rr(0.08, 0.17), rr(10, 22));
    }

    // the table: planks running left to right, legible near the bowl and blurring
    // out as they come towards the camera
    var tg = ctx.createLinearGradient(0, HORIZON, 0, W);
    tg.addColorStop(0, '#6d471f');
    tg.addColorStop(0.12, '#4a2c12');
    tg.addColorStop(0.5, '#2a1809');
    tg.addColorStop(1, '#150c04');
    ctx.fillStyle = tg;
    ctx.fillRect(0, HORIZON, W, W - HORIZON);

    // the seam where the wall meets the table: a dark line, and the table's
    // leading edge catching the same light as the bowl
    blurred(7, function () {
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#140b03';
      ctx.beginPath();
      ctx.moveTo(0, HORIZON - 4);
      ctx.bezierCurveTo(300, HORIZON - 11, 700, HORIZON + 9, W, HORIZON - 1);
      ctx.lineTo(W, HORIZON + 18);
      ctx.bezierCurveTo(700, HORIZON + 28, 300, HORIZON + 8, 0, HORIZON + 13);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    blurred(4, function () {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#d8a468';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, HORIZON + 2);
      ctx.bezierCurveTo(300, HORIZON - 4, 700, HORIZON + 15, W, HORIZON + 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    for (var k = 0; k < 30; k++) {
      (function () {
        var y0 = rr(HORIZON + 6, W + 60);
        var isDark = rnd() < 0.55;
        var blurAmt = 1.5 + 15 * Math.max(0, (y0 - HORIZON) / (W - HORIZON));
        blurred(blurAmt, function () {
          ctx.globalAlpha = rr(0.06, 0.22);
          ctx.strokeStyle = isDark ? '#000000' : '#d09a52';
          ctx.lineWidth = rr(2, 13);
          ctx.beginPath();
          ctx.moveTo(-80, y0);
          ctx.bezierCurveTo(300, y0 + rr(-16, 16), 700, y0 + rr(-16, 16), 1120, y0 + rr(-12, 12));
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      })();
    }
    blurred(36, function () {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffcf94';
      ctx.beginPath();
      ctx.ellipse(230, HORIZON + 150, 330, 88, -0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  /* =====================================================================
     2. THE BOWL
     ===================================================================== */
  function drawBowl() {
    softEllipse(BOWL.cx + 34, BOWL.cy + BOWL.ry + 66, BOWL.rx, BOWL.ry * 0.46, '#000000', 0.68, 30);
    softEllipse(BOWL.cx + 56, BOWL.cy + BOWL.ry + 84, BOWL.rx * 0.8, BOWL.ry * 0.3, '#000000', 0.48, 20);

    var bodyG = ctx.createLinearGradient(120, BOWL.cy - 40, 880, BOWL.cy + BOWL.ry * 1.9);
    bodyG.addColorStop(0, '#fff9ee');
    bodyG.addColorStop(0.2, '#f0e1c6');
    bodyG.addColorStop(0.46, '#cbb493');
    bodyG.addColorStop(0.74, '#8a7758');
    bodyG.addColorStop(1, '#54452f');
    ctx.beginPath();
    ctx.moveTo(BOWL.cx - BOWL.rx, BOWL.cy);
    ctx.bezierCurveTo(BOWL.cx - BOWL.rx * 0.97, BOWL.cy + BOWL.ry * 1.28,
                      BOWL.cx - BOWL.rx * 0.55, BOWL.cy + BOWL.ry * 1.74,
                      BOWL.cx, BOWL.cy + BOWL.ry * 1.74);
    ctx.bezierCurveTo(BOWL.cx + BOWL.rx * 0.55, BOWL.cy + BOWL.ry * 1.74,
                      BOWL.cx + BOWL.rx * 0.97, BOWL.cy + BOWL.ry * 1.28,
                      BOWL.cx + BOWL.rx, BOWL.cy);
    ctx.closePath();
    ctx.fillStyle = bodyG;
    ctx.fill();

    blurred(22, function () {
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(BOWL.cx + BOWL.rx * 0.26, BOWL.cy + 14);
      ctx.bezierCurveTo(BOWL.cx + BOWL.rx * 0.7, BOWL.cy + BOWL.ry * 1.22,
                        BOWL.cx + BOWL.rx * 0.28, BOWL.cy + BOWL.ry * 1.66,
                        BOWL.cx - BOWL.rx * 0.1, BOWL.cy + BOWL.ry * 1.62);
      ctx.lineWidth = 92;
      ctx.strokeStyle = 'rgba(38,20,8,0.8)';
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    blurred(28, function () {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = '#d18f46';
      ctx.beginPath();
      ctx.ellipse(BOWL.cx - BOWL.rx * 0.42, BOWL.cy + BOWL.ry * 1.52, 96, 40, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    softEllipse(BOWL.cx + 8, BOWL.cy + BOWL.ry * 1.7, BOWL.rx * 0.5, BOWL.ry * 0.16, '#2a1808', 0.55, 12);

    // the rim: a thin cream band. A thick grey ring is what makes a bowl look
    // like a cartoon; most of what is visible is the wall inside, not the lip.
    var rimG = ctx.createLinearGradient(BOWL.cx - BOWL.rx, BOWL.cy - BOWL.ry,
                                        BOWL.cx + BOWL.rx * 0.8, BOWL.cy + BOWL.ry);
    rimG.addColorStop(0, '#fffefa');
    rimG.addColorStop(0.22, '#f6ecd9');
    rimG.addColorStop(0.48, '#d4c4a6');
    rimG.addColorStop(0.76, '#9c8b6c');
    rimG.addColorStop(1, '#6c5a42');
    ctx.beginPath();
    ctx.ellipse(BOWL.cx, BOWL.cy, BOWL.rx, BOWL.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = rimG;
    ctx.fill();

    var wallG = ctx.createLinearGradient(BOWL.cx, BOWL.cy + BROTH.ry * 0.5,
                                         BOWL.cx, BOWL.cy + BOWL.ry);
    wallG.addColorStop(0, 'rgba(50,33,15,0.95)');
    wallG.addColorStop(0.5, 'rgba(124,99,68,0.72)');
    wallG.addColorStop(1, 'rgba(236,222,196,0.58)');
    ctx.beginPath();
    ctx.ellipse(BOWL.cx, BOWL.cy, BOWL.rx, BOWL.ry, 0, 0, Math.PI * 2);
    ctx.ellipse(BOWL.cx, BOWL.cy, BROTH.rx, BROTH.ry, 0, 0, Math.PI * 2, true);
    ctx.fillStyle = wallG;
    ctx.fill();

    // the lip's lit edge: crisp, because it is in focus, but warm and subdued --
    // a bright white line on a rim reads as metal
    blurred(1.1, function () {
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#fff2dc';
      ctx.beginPath();
      ctx.ellipse(BOWL.cx, BOWL.cy, BOWL.rx - 1.5, BOWL.ry - 1.5, 0, Math.PI * 1.0, Math.PI * 1.88);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    // the lip's inner edge, where it turns down into the bowl
    blurred(1.6, function () {
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#7d6746';
      ctx.ellipse(BOWL.cx, BOWL.cy, BROTH.rx + 3, BROTH.ry + 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    sheen(BOWL.cx - 190, BOWL.cy - 140, 206, 22, -0.44, [255, 255, 255], 0.4, 11);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(BOWL.cx, BOWL.cy, BOWL.rx, BOWL.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    tooth(0.12, 0.6, 77271, BOWL.cx - BOWL.rx, BOWL.cy - BOWL.ry, BOWL.cx + BOWL.rx, BOWL.cy + BOWL.ry);
    ctx.restore();
  }

  /* =====================================================================
     3. THE BROTH
     ===================================================================== */
  function drawBroth() {
    ctx.save();
    brothBoundary(0);
    ctx.clip();
    var g = ctx.createLinearGradient(0, BROTH.cy - BROTH.ry, 0, BROTH.cy + BROTH.ry);
    g.addColorStop(0, '#5e3012');
    g.addColorStop(0.24, '#84461a');
    g.addColorStop(0.54, '#ab6524');
    g.addColorStop(0.8, '#8c4b1a');
    g.addColorStop(1, '#56290e');
    ctx.fillStyle = g;
    ctx.fillRect(BROTH.cx - BROTH.rx, BROTH.cy - BROTH.ry, BROTH.rx * 2, BROTH.ry * 2);
    var rg = ctx.createRadialGradient(BROTH.cx, BROTH.cy, BROTH.rx * 0.25,
                                      BROTH.cx, BROTH.cy, BROTH.rx);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(0.7, 'rgba(28,11,2,0.22)');
    rg.addColorStop(1, 'rgba(14,5,1,0.6)');
    ctx.fillStyle = rg;
    ctx.fillRect(BROTH.cx - BROTH.rx, BROTH.cy - BROTH.ry, BROTH.rx * 2, BROTH.ry * 2);
    ctx.restore();
    tooth(0.14, 5, 31337, BROTH.cx - BROTH.rx, BROTH.cy - BROTH.ry, BROTH.cx + BROTH.rx, BROTH.cy + BROTH.ry);
  }

  // The window the bowl stands in front of, mirrored in the surface: the
  // strongest single cue that the broth is a liquid. Large and soft, then cut
  // into ripples, because what sells it is that the reflection is *broken*.
  function brothReflections() {
    ctx.save();
    brothBoundary(0);
    ctx.clip();
    function pane(cx, cy, rx, ry, rot, c, a, blur) {
      blurred(blur, function () {
        ctx.globalAlpha = a;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    // the window itself, mirrored: a soft wide glow, then the pane, then the
    // glazing bars cutting the reflection into panes. A window with a frame in
    // it is what the eye reads as a room reflected on liquid.
    pane(BROTH.cx - 106, BROTH.cy - 88, 186, 92, -0.3, '#ffe9c6', 0.34, 26);
    pane(BROTH.cx - 124, BROTH.cy - 100, 128, 60, -0.3, '#fff6e0', 0.4, 11);
    blurred(3.5, function () {
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = '#3d1c07';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(BROTH.cx - 176, BROTH.cy - 72);
      ctx.lineTo(BROTH.cx - 58, BROTH.cy - 126);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(BROTH.cx - 194, BROTH.cy - 126);
      ctx.lineTo(BROTH.cx - 94, BROTH.cy - 60);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    pane(BROTH.cx - 154, BROTH.cy - 116, 32, 21, -0.3, '#fffefa', 0.42, 4);
    pane(BROTH.cx - 92, BROTH.cy - 78, 29, 19, -0.3, '#fffefa', 0.32, 4);

    for (var i = 0; i < 9; i++) {
      (function () {
        var y = BROTH.cy - 158 + i * 22 + rr(-5, 5);
        blurred(rr(2.5, 7), function () {
          ctx.globalAlpha = rr(0.14, 0.34);
          ctx.strokeStyle = '#fff3d6';
          ctx.lineWidth = rr(2, 5.5);
          ctx.beginPath();
          ctx.moveTo(BROTH.cx - 320, y);
          ctx.bezierCurveTo(BROTH.cx - 200, y - rr(4, 13), BROTH.cx - 90, y + rr(4, 13), BROTH.cx + 40, y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      })();
    }
    pane(BROTH.cx + 176, BROTH.cy + 84, 92, 34, 0.2, '#ffd9a8', 0.1, 30);
    ctx.restore();
  }

  function brothFilm() {
    ctx.save();
    brothBoundary(4);
    ctx.clip();
    var g = ctx.createLinearGradient(0, BROTH.cy - BROTH.ry, 0, BROTH.cy + BROTH.ry);
    g.addColorStop(0, 'rgba(104,54,18,0.52)');
    g.addColorStop(0.42, 'rgba(160,90,32,0.40)');
    g.addColorStop(0.8, 'rgba(170,98,36,0.34)');
    g.addColorStop(1, 'rgba(108,56,19,0.48)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);
    ctx.restore();
  }

  /* =====================================================================
     4. THE SURFACE -- oil, bubbles and the meniscus, under the food
     ===================================================================== */
  function droplet(x, y, r) {
    var dph = phases();
    var squash = rr(0.62, 1);
    // the shadow it drops on the surface, then the body, then the gleam
    blurred(2.4, function () {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2c1204';
      blobPath(x + 2, y + 3, r * 1.12, r * squash * 1.12, 0.18, dph, 60);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    blurred(0.7, function () {
      var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255,224,162,1)');
      g.addColorStop(0.42, 'rgba(250,158,58,0.96)');
      g.addColorStop(1, 'rgba(184,68,10,0.95)');
      ctx.fillStyle = g;
      blobPath(x, y, r, r * squash, 0.18, dph, 60);
      ctx.fill();
    });
    blurred(0.7, function () {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.3, y - r * 0.34, r * 0.32, r * 0.2, rr(0, 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function bubble(x, y, r) {
    blurred(1.2, function () {
      var bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.15, x, y, r);
      bg.addColorStop(0, 'rgba(152,96,46,0.6)');
      bg.addColorStop(0.7, 'rgba(74,34,10,0.72)');
      bg.addColorStop(1, 'rgba(255,220,170,0.85)');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    blurred(0.5, function () {
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath();
      ctx.arc(x - r * 0.34, y - r * 0.36, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // the ring where the broth climbs the wall, brightest on the lit side
  function meniscus() {
    ctx.save();
    brothBoundary(0);
    ctx.clip();
    blurred(6, function () {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#1f0d02';
      ctx.lineWidth = 16;
      brothBoundary(2);
      ctx.stroke();
    });
    var n = 120, i, t;
    for (i = 0; i < n; i++) {
      t = (i / n) * Math.PI * 2;
      var lit = 0.5 + 0.5 * Math.cos(t - Math.PI * 1.15);
      ctx.globalAlpha = 0.12 + 0.72 * Math.pow(lit, 1.6);
      ctx.strokeStyle = '#ffe0ae';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(BROTH.cx + Math.cos(t) * (BROTH.rx - 8), BROTH.cy + Math.sin(t) * (BROTH.ry - 5));
      ctx.lineTo(BROTH.cx + Math.cos(t + 0.06) * (BROTH.rx - 8), BROTH.cy + Math.sin(t + 0.06) * (BROTH.ry - 5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function oilAndBubbles() {
    var i, x, y;
    for (i = 0; i < 90; i++) {
      x = rr(BROTH.cx - BROTH.rx, BROTH.cx + BROTH.rx);
      y = rr(BROTH.cy - BROTH.ry, BROTH.cy + BROTH.ry);
      if (!inOpenBroth(x, y)) continue;
      droplet(x, y, rr(5, 13));
    }
    for (i = 0; i < 30; i++) {
      x = rr(BROTH.cx - BROTH.rx, BROTH.cx + BROTH.rx);
      y = rr(BROTH.cy - BROTH.ry, BROTH.cy + BROTH.ry);
      if (!inOpenBroth(x, y)) continue;
      bubble(x, y, rr(4, 9));
    }
    ctx.save();
    brothBoundary(0);
    ctx.clip();
    blurred(30, function () {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#ffeccd';
      ctx.beginPath();
      ctx.ellipse(BROTH.cx - 116, BROTH.cy - 86, 206, 98, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  /* =====================================================================
     5. NOODLES
     ===================================================================== */
  // A strand is a *ribbon*, not a stroke: a polygon whose half-width varies along
  // its length, filled with a gradient across its own axis and then given a
  // thinner, lighter band along its top edge. A stroke of one width and one
  // colour, however often it is repeated, is what makes noodles read as cable.
  function sampleCurve(pts, per) {
    var P = [pts[0]].concat(pts).concat([pts[pts.length - 1]]);
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
      for (var j = 0; j < per; j++) {
        var t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                 (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                 (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function ribbonPath(samples, hwFn, dy) {
    var L = [], R = [], i;
    var off = dy || 0;
    for (i = 0; i < samples.length; i++) {
      var a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1];
      var len = Math.sqrt(tx * tx + ty * ty) || 1;
      var nx = -ty / len, ny = tx / len;
      var hw = hwFn(i / (samples.length - 1));
      L.push([samples[i][0] + nx * hw, samples[i][1] + ny * hw + off]);
      R.push([samples[i][0] - nx * hw, samples[i][1] - ny * hw + off]);
    }
    var p = new Path2D();
    p.moveTo(L[0][0], L[0][1]);
    for (i = 1; i < L.length; i++) p.lineTo(L[i][0], L[i][1]);
    for (i = R.length - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
    p.closePath();
    return p;
  }

  function strand(pts, hw, tone) {
    var samples = sampleCurve(pts, 12);
    var ph = rr(0, 6.28), ph2 = rr(0, 6.28);
    function hwFn(t) {
      var ends = 1 - 0.34 * Math.pow(Math.abs(t - 0.5) * 2, 3);
      return hw * (0.62 + 0.5 * Math.sin(t * 4.3 + ph) + 0.22 * Math.sin(t * 9.1 + ph2)) * ends;
    }
    var body = ribbonPath(samples, hwFn, 0);

    // the shadow it drops into the broth: what separates one strand from the next
    blurred(2.4, function () {
      ctx.globalAlpha = 0.52;
      ctx.fillStyle = '#1c0d03';
      ctx.fill(ribbonPath(samples, function (t) { return hwFn(t) * 1.12; }, 8));
      ctx.globalAlpha = 1;
    });

    var ys = samples.map(function (p) { return p[1]; });
    var yTop = Math.min.apply(null, ys) - hw * 1.4;
    var yBot = Math.max.apply(null, ys) + hw * 1.4;
    var bases = [[196, 134, 62], [216, 154, 78], [178, 118, 52], [224, 168, 92], [186, 128, 60]];

    ctx.save();
    ctx.clip(body);
    var g = ctx.createLinearGradient(0, yTop, 0, yBot);
    var b = bases[tone % bases.length];
    g.addColorStop(0, 'rgb(' + Math.round(b[0] * 1.34) + ',' + Math.round(b[1] * 1.34) + ',' + Math.round(b[2] * 1.3) + ')');
    g.addColorStop(0.28, rgb(b));
    g.addColorStop(0.68, 'rgb(' + Math.round(b[0] * 0.56) + ',' + Math.round(b[1] * 0.53) + ',' + Math.round(b[2] * 0.5) + ')');
    g.addColorStop(1, 'rgb(' + Math.round(b[0] * 0.30) + ',' + Math.round(b[1] * 0.28) + ',' + Math.round(b[2] * 0.26) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);
    tooth(0.24, 1.4, 900 + tone * 137, 0, 0, W, W);
    ctx.restore();

    // a narrow glint along the top: a wide white band is a painted stripe, a
    // narrow one is a wet highlight
    ctx.save();
    ctx.clip(body);
    blurred(0.6, function () {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fffdf4';
      ctx.fill(ribbonPath(samples, function (t) { return hwFn(t) * 0.17; }, -hw * 0.46));
      ctx.globalAlpha = 1;
    });
    // a core shadow along its underside, which is what makes it round
    blurred(1.8, function () {
      ctx.globalAlpha = 0.34;
      ctx.fillStyle = '#c8792c';
      ctx.fill(ribbonPath(samples, function (t) { return hwFn(t) * 0.3; }, hw * 0.62));
      ctx.globalAlpha = 1;
    });
    // and broth clinging to it, so the strand came out of the pot
    blurred(2.4, function () {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#96551d';
      ctx.fill(ribbonPath(samples, function (t) { return hwFn(t) * 0.5; }, hw * 0.92));
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function strandPoints(x0, y0, x1, y1, bow, jitter) {
    var pts = [];
    var n = 5;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push([
        x0 + (x1 - x0) * t + rr(-jitter, jitter),
        y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * bow + rr(-jitter, jitter)
      ]);
    }
    return pts;
  }

  function drawSubmergedNoodles() {
    ctx.save();
    brothBoundary(-4);
    ctx.clip();
    for (var i = 0; i < 10; i++) {
      strand(strandPoints(rr(220, 520), rr(560, 640), rr(460, 800), rr(420, 530), rr(-60, 60), 16), rr(6, 9), i);
    }
    ctx.restore();
  }

  function drawEmergedNoodles() {
    ctx.save();
    brothBoundary(-4);
    ctx.clip();
    // the nest: each strand separated from the next by its own shadow, so they
    // read one at a time instead of as one mass, and spread wide enough that the
    // bowl reads as full of noodles rather than topped with a clump
    var specs = [
      [300, 566, 720, 470, -34], [340, 616, 770, 500, -22], [380, 638, 806, 542, 26],
      [300, 508, 700, 440, 38], [420, 650, 828, 562, 48], [500, 626, 842, 466, -36],
      [352, 492, 742, 446, 18], [460, 640, 830, 518, -18], [320, 590, 610, 420, 34],
      [560, 646, 828, 528, 40], [370, 536, 800, 484, -44], [480, 604, 840, 598, 4],
      [516, 468, 828, 568, -30], [600, 436, 852, 502, 22], [268, 606, 560, 512, -14],
      [430, 574, 690, 412, 30], [540, 560, 852, 620, -26], [330, 640, 660, 622, 16],
      [620, 520, 846, 440, -20], [392, 452, 640, 402, 12], [470, 660, 760, 640, -10]
    ];
    for (var i = 0; i < specs.length; i++) {
      var s = specs[i];
      strand(strandPoints(s[0], s[1], s[2], s[3], s[4], 13), rr(7, 11), i);
    }
    ctx.restore();
  }

  /* =====================================================================
     6. CHASHU (braised pork belly)
     ===================================================================== */
  function chashu(cx, cy, rx, ry, rot, ph) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    contact(4, ry * 0.9, rx * 0.98, ry * 0.42, 0.66);

    ctx.save();
    blobPath(0, 0, rx, ry, 0.09, ph, 120);
    ctx.clip();

    ctx.fillStyle = '#5a2a0e';
    ctx.fillRect(-rx * 1.4, -ry * 1.4, rx * 2.8, ry * 2.8);

    // Braised belly is layers: dark lean, pale fat, over and over. Bands, not
    // stripes -- they bend with the shape of the slice.
    var bands = [
      [-1.1, -0.68, [240, 208, 164], 1], [-0.68, -0.42, [128, 62, 24], 1],
      [-0.42, -0.14, [250, 230, 194], 0.98], [-0.14, 0.12, [112, 54, 18], 1],
      [0.12, 0.28, [232, 196, 150], 0.95], [0.28, 0.6, [98, 44, 15], 1],
      [0.6, 0.86, [216, 176, 128], 0.92], [0.86, 1.15, [84, 36, 11], 1]
    ];
    for (var i = 0; i < bands.length; i++) {
      (function () {
        var b = bands[i];
        var yA = b[0] * ry, yB = b[1] * ry;
        var w1 = rr(-0.2, 0.2) * ry, w2 = rr(-0.2, 0.2) * ry;
        var w3 = rr(-0.18, 0.18) * ry, w4 = rr(-0.18, 0.18) * ry;
        blurred(2.4, function () {
          ctx.globalAlpha = b[3];
          ctx.fillStyle = rgb(b[2]);
          ctx.beginPath();
          ctx.moveTo(-rx * 1.3, yA + w1);
          ctx.bezierCurveTo(-rx * 0.5, yA + w2, rx * 0.4, yA + w3, rx * 1.3, yA + w4);
          ctx.lineTo(rx * 1.3, yB + w4);
          ctx.bezierCurveTo(rx * 0.4, yB + w3, -rx * 0.5, yB + w2, -rx * 1.3, yB + w1);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        });
        // the band breaks up: the fat in a slice of belly does not run clean
        // edge to edge, and stripes that do are what make it look printed
        var segs = 2 + Math.floor(rnd() * 2);
        for (var sgi = 0; sgi < segs; sgi++) {
          (function () {
            var x0 = rr(-rx * 1.1, rx * 0.5);
            var x1 = x0 + rr(rx * 0.3, rx * 0.8);
            var yy = rr(yA, yB) + rr(-ry * 0.05, ry * 0.05);
            blurred(3.5, function () {
              ctx.globalAlpha = 0.5;
              ctx.fillStyle = '#7b3a12';
              ctx.fillRect(x0, yy, x1 - x0, rr(ry * 0.06, ry * 0.16));
              ctx.globalAlpha = 1;
            });
          })();
        }
      })();
    }

    tooth(0.3, 1.1, 5150, -rx * 1.3, -ry * 1.3, rx * 1.3, ry * 1.3);
    // the fibre of the lean: long, fine, and running *along* the slice. Short
    // strokes laid across the stripes are what make a slice of pork look like
    // sausage with a pattern printed on it.
    for (var f = 0; f < 70; f++) {
      (function () {
        var y = rr(-ry, ry);
        var x0 = rr(-rx * 1.15, -rx * 0.15);
        var len = rr(rx * 0.7, rx * 1.9);
        var bow = rr(-ry * 0.11, ry * 0.11);
        blurred(rr(0.6, 1.4), function () {
          ctx.globalAlpha = rr(0.05, 0.19);
          ctx.strokeStyle = rnd() < 0.55 ? '#2b1105' : '#ffe8c0';
          ctx.lineWidth = rr(0.6, 1.6);
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.quadraticCurveTo(x0 + len * 0.5, y + bow, x0 + len, y + bow * 0.4);
          ctx.stroke();
          ctx.globalAlpha = 1;
        });
      })();
    }

    // the sear: caramelised and uneven, darkest where it lay on the pan
    blurred(5, function () {
      ctx.globalAlpha = 0.72;
      ctx.strokeStyle = '#381806';
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    blurred(4, function () {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = '#8f4a12';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(rx * 0.03, ry * 0.05, rx * 0.94, ry * 0.92, 0, Math.PI * 0.15, Math.PI * 1.25);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // char: the sear is not a uniform ring, it is blotchy, and it is darkest
    // where the slice sat longest against the pan
    for (var ch = 0; ch < 24; ch++) {
      (function () {
        var t = rr(0, 6.28);
        var d = rr(0.84, 1.0);
        var px = Math.cos(t) * rx * d, py = Math.sin(t) * ry * d;
        blurred(rr(3, 8), function () {
          ctx.globalAlpha = rr(0.16, 0.5);
          ctx.fillStyle = pick(['#2a1204', '#3a1a06', '#4a2408']);
          ctx.beginPath();
          ctx.ellipse(px, py, rr(10, 26), rr(5, 13), t, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      })();
    }

    // it is wet: one long highlight across the top, and a smaller one below
    blurred(4, function () {
      ctx.globalAlpha = 0.62;
      var hg = ctx.createLinearGradient(-rx, 0, rx, 0);
      hg.addColorStop(0, 'rgba(255,244,224,0)');
      hg.addColorStop(0.4, 'rgba(255,251,242,1)');
      hg.addColorStop(1, 'rgba(255,244,224,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(-rx * 0.06, -ry * 0.46, rx * 0.58, ry * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    blurred(2, function () {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#fffdf6';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.34, ry * 0.38, rx * 0.2, ry * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.restore(); // clip

    blurred(2, function () {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffdda8';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.99, ry * 0.99, 0, Math.PI * 1.02, Math.PI * 1.88);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // half in the broth: dimmed below the surface, a bright line where the
    // surface climbs onto it
    ctx.save();
    blobPath(0, 0, rx, ry, 0.09, ph, 120);
    ctx.clip();
    waterline(rx, ry, 0.34, 0.42);
    ctx.restore();

    ctx.restore(); // transform
  }

  /* =====================================================================
     7. THE EGG: the hero of the picture
     ===================================================================== */
  // A halved soft-boiled egg. What keeps it from reading as an emoji is that the
  // white is an *elongated, lobed* shape rather than a disc, that its edge is
  // browned and ragged, and that the yolk is set into a cavity in it, off centre.
  function egg(cx, cy, rx, ry, rot) {
    var ph = phases();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    contact(6, ry * 0.82, rx * 0.96, ry * 0.36, 0.68);

    ctx.save();
    blobPath(0, 0, rx, ry, 0.052, ph, 130);
    ctx.clip();

    var wg = ctx.createLinearGradient(-rx, -ry, rx * 0.7, ry);
    wg.addColorStop(0, '#fffefa');
    wg.addColorStop(0.32, '#fdf7ec');
    wg.addColorStop(0.66, '#f0e5d0');
    wg.addColorStop(1, '#d9c9ab');
    ctx.fillStyle = wg;
    ctx.fillRect(-rx * 1.4, -ry * 1.4, rx * 2.8, ry * 2.8);

    // light travelling through the thin edge: the white's own glow
    blurred(13, function () {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffd9a2';
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.88, ry * 0.88, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // the set curd of the white: not a smooth surface
    tooth(0.24, 1.6, 8811, -rx, -ry, rx, ry);
    for (var w2 = 0; w2 < 34; w2++) {
      (function () {
        var a = rr(0, 6.28), d = rr(0.3, 0.98);
        var x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d;
        blurred(rr(1.4, 4), function () {
          ctx.globalAlpha = rr(0.06, 0.17);
          ctx.fillStyle = rnd() < 0.5 ? '#ffffff' : '#cbb894';
          ctx.beginPath();
          ctx.ellipse(x, y, rr(6, 22), rr(5, 15), a, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      })();
    }

    // The cavity the yolk sits in: shadow across its top, lit lip below. This is
    // what stops the yolk reading as a ball dropped on top of the white.
    blurred(10, function () {
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = '#c2ab88';
      ctx.beginPath();
      ctx.ellipse(0, -ry * 0.24, rx * 0.56, ry * 0.3, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    blurred(6, function () {
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, ry * 0.28, rx * 0.58, ry * 0.24, 0, 0, Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    sheen(-rx * 0.46, -ry * 0.44, rx * 0.56, ry * 0.19, -0.4, [255, 255, 255], 0.45, 8);

    ctx.restore(); // clip

    // ---- the warm tinge the white picks up at its edge. Kept low: a heavy
    // brown fringe turns a halved egg into a fried one.
    for (var i = 0; i < 22; i++) {
      (function () {
        var t = (i / 22) * Math.PI * 2 + rr(-0.08, 0.08);
        var px = Math.cos(t) * rx * rr(0.95, 1.01);
        var py = Math.sin(t) * ry * rr(0.95, 1.01);
        var big = rr(0.3, 1);
        blurred(rr(2, 5), function () {
          ctx.globalAlpha = rr(0.1, 0.3);
          ctx.fillStyle = pick(['#cfa055', '#bb8340', '#a8712c', '#dcb673']);
          ctx.beginPath();
          ctx.ellipse(px, py, rr(4, 11) * big, rr(3, 8) * big, t, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      })();
    }
    blurred(1.2, function () {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#a8702c';
      ctx.lineWidth = 1.8;
      blobPath(0, 0, rx, ry, 0.052, ph, 130);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    /* ---- the yolk ---- */
    var yrx = rx * 0.44, yry = ry * 0.5;
    var yx = -rx * 0.16, yy = ry * 0.08;
    var yph = phases();

    blurred(2, function () {
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = '#b85f0e';
      blobPath(yx, yy + 1.5, yrx * 1.07, yry * 1.07, 0.035, yph, 90);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // the yolk: a volume, so its light sits off centre and falls away
    blurred(0.8, function () {
      var yg = ctx.createRadialGradient(yx - yrx * 0.3, yy - yry * 0.34, yrx * 0.05,
                                        yx, yy, yrx * 1.14);
      yg.addColorStop(0, '#ffe6a6');
      yg.addColorStop(0.22, '#ffc94f');
      yg.addColorStop(0.5, '#f59c17');
      yg.addColorStop(0.76, '#dd7c0c');
      yg.addColorStop(1, '#a85a08');
      ctx.fillStyle = yg;
      blobPath(yx, yy, yrx, yry, 0.035, yph, 90);
      ctx.fill();
    });

    // the jammy rim, catching light along its lower right
    blurred(3, function () {
      ctx.globalAlpha = 0.42;
      ctx.strokeStyle = '#8c3c04';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(yx, yy, yrx * 0.99, yry * 0.99, 0, -0.3, Math.PI * 1.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // The highlight: wide, soft, off centre, and deliberately not allowed to clip.
    // A small hard white dot is exactly what makes a yolk look like a marble.
    blurred(14, function () {
      var hg = ctx.createRadialGradient(yx - yrx * 0.24, yy - yry * 0.26, 0,
                                        yx - yrx * 0.24, yy - yry * 0.26, yrx * 1.15);
      hg.addColorStop(0, 'rgba(255,253,244,0.72)');
      hg.addColorStop(0.32, 'rgba(255,246,220,0.4)');
      hg.addColorStop(0.68, 'rgba(255,234,184,0.14)');
      hg.addColorStop(1, 'rgba(255,226,164,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.ellipse(yx - yrx * 0.24, yy - yry * 0.26, yrx * 1.15, yry, -0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // its foot, where it meets the broth: subtle, because most of the egg is
    // above the surface, but enough that it is in the bowl and not on it
    ctx.save();
    blobPath(0, 0, rx, ry, 0.052, ph, 130);
    ctx.clip();
    waterline(rx, ry, 0.66, 0.20);
    ctx.restore();

    ctx.restore(); // transform
  }

  /* =====================================================================
     8. GARNISH
     ===================================================================== */
  // A sliver of spring onion: a short, curved, tapering piece, not a ring. A
  // perfect ring is a graphic, not a vegetable.
  function scallion(x, y, len, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    var w = rr(4, 7.5);
    function outline(m) {
      ctx.beginPath();
      ctx.moveTo(0, -w * m);
      ctx.quadraticCurveTo(len * 0.5, -w * m * rr(0.8, 1.4), len, -w * m * 0.5);
      ctx.lineTo(len, w * m * 0.5);
      ctx.quadraticCurveTo(len * 0.5, w * m * rr(0.8, 1.4), 0, w * m);
      ctx.closePath();
    }
    blurred(2.6, function () {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#24120 4'.split(' ').join('');
      ctx.save();
      ctx.translate(2, 4);
      outline(1.3);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    });
    var g = ctx.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, '#dcefa4');
    g.addColorStop(0.42, '#9dc957');
    g.addColorStop(1, '#48761f');
    blurred(0.6, function () {
      outline(1);
      ctx.fillStyle = g;
      ctx.fill();
    });
    blurred(0.6, function () {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#f4fccb';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(1, -w * 0.5);
      ctx.quadraticCurveTo(len * 0.5, -w * 0.75, len - 1, -w * 0.28);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function sesame(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    blurred(1.2, function () {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#20100 4'.split(' ').join('');
      ctx.beginPath();
      ctx.ellipse(1.4, 2.2, r * 1.15, r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    blurred(0.6, function () {
      var g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, '#fffdf2');
      g.addColorStop(0.55, '#eddfbc');
      g.addColorStop(1, '#ab9b78');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.66, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    blurred(1, function () {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, -r * 0.22, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function drawGarnish() {
    var i, x, y;
    for (i = 0; i < 26; i++) {
      x = rr(380, 880);
      y = rr(400, 600);
      if (!inBroth(x, y, 0.86)) continue;
      scallion(x, y, rr(24, 52), rr(-3.14, 3.14));
    }
    for (i = 0; i < 26; i++) {
      (function () {
        var cx = rr(170, 480), cy = rr(560, 680);
        if (!inOpenBroth(cx, cy)) return;
        blurred(1, function () {
          ctx.globalAlpha = rr(0.55, 0.95);
          ctx.fillStyle = pick(['#e2541a', '#c04210', '#f0701f']);
          ctx.beginPath();
          ctx.ellipse(cx, cy, rr(5, 16), rr(2, 5), rr(0, 3.14), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      })();
    }
    for (i = 0; i < 18; i++) {
      x = rr(200, 860);
      y = rr(390, 680);
      if (!inBroth(x, y, 0.86)) continue;
      sesame(x, y, rr(4, 6.5), rr(0, 3.14));
    }
  }

  /* =====================================================================
     9. STEAM
     ===================================================================== */
  function drawSteam() {
    // Three plumes, each drawn in three passes of widening blur and falling
    // opacity, tapered to nothing at both ends so that no pass leaves a cap. A
    // plume with a flat end is a rectangle of fog.
    function plume(x0, y0, h, w, alpha, drift) {
      function column(scale, phase) {
        var steps = 30, i, t, x, y, hw, taper;
        var down = [], up = [];
        for (i = 0; i <= steps; i++) {
          t = i / steps;
          taper = Math.pow(Math.sin(Math.PI * t), 0.55);
          y = y0 - h * t;
          x = x0 + Math.sin(t * 3.1 + phase) * drift * t + t * t * drift * 0.7;
          hw = w * scale * (1 - t * 0.3) * (0.6 + 0.5 * Math.sin(t * 5.4 + phase + 1.2)) * taper;
          down.push([x - hw, y]);
          up.push([x + hw, y]);
        }
        ctx.beginPath();
        ctx.moveTo(down[0][0], down[0][1]);
        for (i = 1; i < down.length; i++) ctx.lineTo(down[i][0], down[i][1]);
        for (i = up.length - 1; i >= 0; i--) ctx.lineTo(up[i][0], up[i][1]);
        ctx.closePath();
      }
      var widths = [2.5, 1.4, 0.85];
      var blurs = [40, 22, 11];
      for (var p = 0; p < 3; p++) {
        (function () {
          var pp = p;
          blurred(blurs[pp], function () {
            ctx.globalAlpha = alpha * widths[pp] * 0.5;
            column(widths[pp], 0.6 + pp * 1.9);
            ctx.fillStyle = '#fffaf0';
            ctx.fill();
            ctx.globalAlpha = 1;
          });
        })();
      }
    }

    plume(384, 398, 540, 76, 0.24, 44);
    plume(504, 378, 600, 86, 0.19, -30);
    plume(624, 414, 480, 64, 0.17, 36);

    // a fourth, finer wisp: the thin curl of steam that gives the plume an edge
    // without giving it a hard one
    function wisp(x0, y0, h, drift) {
      blurred(5, function () {
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = '#fffaf0';
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        var steps = 24, i, t, x, y;
        for (i = 0; i <= steps; i++) {
          t = i / steps;
          y = y0 - h * t;
          x = x0 + Math.sin(t * 4.2 + 1.1) * drift * t;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }
    wisp(462, 372, 430, 30);
    wisp(586, 390, 360, -22);

    // a low haze on the broth, where the steam starts
    blurred(48, function () {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#fff6e2';
      ctx.beginPath();
      ctx.ellipse(500, 378, 320, 66, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  /* =====================================================================
     10. THE FILM
     ===================================================================== */
  function finish() {
    // bloom: highlights bleed a little, the way a lens does
    var soft = document.createElement('canvas');
    soft.width = W; soft.height = W;
    var sc = soft.getContext('2d');
    sc.filter = 'blur(18px) brightness(1.6)';
    sc.drawImage(cv, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighten';
    ctx.globalAlpha = 0.13;
    ctx.drawImage(soft, 0, 0);
    ctx.restore();

    // Depth of field: the food is the plane in focus and the room falls away
    // either side of it. A picture sharp everywhere at once is a drawing.
    var dof = document.createElement('canvas');
    dof.width = W; dof.height = W;
    var dc = dof.getContext('2d');
    dc.filter = 'blur(6px)';
    dc.drawImage(cv, 0, 0);
    dc.globalCompositeOperation = 'destination-in';
    var m = dc.createRadialGradient(452, 492, 150, 452, 492, 620);
    m.addColorStop(0, 'rgba(0,0,0,0)');
    m.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    m.addColorStop(1, 'rgba(0,0,0,1)');
    dc.fillStyle = m;
    dc.fillRect(0, 0, W, W);
    ctx.drawImage(dof, 0, 0);

    // The tone curve, per pixel: a lift so the mids come out of the mud, a soft S
    // for contrast, a shoulder so the highlights roll off instead of clipping,
    // and a little chroma, because the palette of a warm bowl is half the
    // appetite.
    var img = ctx.getImageData(0, 0, W, W);
    var d = img.data, i;
    var lut = new Uint8ClampedArray(256);
    for (var v = 0; v < 256; v++) {
      var x = v / 255;
      x = Math.pow(x, 0.88) * 1.06;
      x = x + 0.28 * (x * x * (3 - 2 * x) - x);
      var knee = 0.86;
      if (x > knee) {
        var t = (x - knee) / (1 - knee);
        x = knee + (t / (1 + t * 0.85)) * (1 - knee);
      }
      lut[v] = Math.max(0, Math.min(255, Math.round(x * 255)));
    }
    for (i = 0; i < d.length; i += 4) {
      var r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]];
      var lum = 0.299 * r + 0.587 * g + 0.114 * b;
      var k = 1.16;
      d[i] = lum + (r - lum) * k;
      d[i + 1] = lum + (g - lum) * k;
      d[i + 2] = lum + (b - lum) * k * 0.95;
    }
    ctx.putImageData(img, 0, 0);

    // Unsharp: a little micro-contrast, which is what a lens does and a painting
    // does not. Without it every soft edge reads as airbrush.
    var blurCv = document.createElement('canvas');
    blurCv.width = W; blurCv.height = W;
    var bc = blurCv.getContext('2d');
    bc.filter = 'blur(2px)';
    bc.drawImage(cv, 0, 0);
    var bi = bc.getImageData(0, 0, W, W).data;
    var sharp = ctx.getImageData(0, 0, W, W);
    var sd = sharp.data;
    for (i = 0; i < sd.length; i += 4) {
      sd[i] = sd[i] + 0.5 * (sd[i] - bi[i]);
      sd[i + 1] = sd[i + 1] + 0.5 * (sd[i + 1] - bi[i + 1]);
      sd[i + 2] = sd[i + 2] + 0.5 * (sd[i + 2] - bi[i + 2]);
    }
    ctx.putImageData(sharp, 0, 0);

    // Sensor grain: the strongest single cue that separates a photograph from a
    // drawing. Invisible at 300 pixels, and it stops every gradient reading as
    // machine-made.
    var grain = noiseCanvas(1024, 20261114, true);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.09;
    ctx.drawImage(grain, 0, 0);
    ctx.restore();

    var grain2 = noiseCanvas(1024, 777001, false);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.06;
    ctx.drawImage(grain2, 0, 0);
    ctx.restore();

    var vg = ctx.createRadialGradient(470, 440, 320, 512, 512, 790);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.68, 'rgba(28,12,3,0.1)');
    vg.addColorStop(1, 'rgba(14,6,2,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, W);
  }

  /* ---------- paint it, back to front ---------- */
  drawRoom();
  drawBowl();
  drawBroth();
  brothReflections();
  meniscus();
  oilAndBubbles();
  drawSubmergedNoodles();
  brothFilm();
  drawEmergedNoodles();
  chashu(PORK[0].x, PORK[0].y, PORK[0].rx, PORK[0].ry, -0.22, phases());
  chashu(PORK[1].x, PORK[1].y, PORK[1].rx, PORK[1].ry, -0.42, phases());
  egg(EGG.x, EGG.y, EGG.rx, EGG.ry, -0.20);
  drawGarnish();
  drawSteam();
  finish();

  document.title = 'ready';
})();
