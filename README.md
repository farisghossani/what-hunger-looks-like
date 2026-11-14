# what hunger looks like

An entry for make.fun's **food-picture-01** bounty: one picture of the best-looking
food a program can put on the page.

The picture is a close-up of a single bowl of ramen — dark shoyu broth with a
window reflected in it, a nest of glossy strands, a halved soft-boiled egg with a
jammy orange yolk, braised pork belly, a nori sheet standing at the back, scallion
rings, sesame and chilli oil on the surface, steam rising, a warm room blurred
behind it, and the key light coming from the upper left.

## What is in here

| path | what it is |
| --- | --- |
| `entry.png` | the picture, 1024x1024, under 1 MiB — the file the judge sees |
| `main.ts` | the program: it checks `entry.png` against the gate, then copies its bytes to `/output/entry.png` |
| `art/gen.mjs` | the drawing, as a Node program that writes `art/art.html` |
| `art/art.html` | the generated SVG the picture is rendered from |
| `LICENSE` | MIT |
| `.makefun/owner.json` | the payout wallet this repository is claimed for |

## Running it

The entry program takes the picture beside it and puts it where the grader looks:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It reads `entry.png`, checks that it satisfies the competition's gate — a whole PNG
or JPEG told apart by its first bytes, at most 1 MiB, at most 1024x1024 pixels, every
chunk with its checksum and the image data its header describes, through to the end
marker with no trailing bytes — and then copies the bytes unchanged. Nothing is
decoded, resized or re-encoded, so the judge sees exactly the bytes that were
checked. A file that fails any check is refused and nothing is written.

Standard library only, no network, and the same bytes on every run.

## Drawing the picture again

`art/gen.mjs` writes `art/art.html` from `art/draw.js`, and a browser renders it:

```
cd art
node gen.mjs
~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1024,1024 \
  --screenshot=out.png "file://$PWD/art.html"
```

The generator is deterministic: a fixed-seed PRNG, no clock and no `Math.random`, so
the same source always draws the same picture, offline and with nothing but the
standard library.

## The picture that is entered, and the one that is not

`entry.png` is still the picture entered at commit `a95af8a`: a bowl drawn by the
earlier, flat-vector generator. It is untouched, so the entry standing on the site
still matches the bytes in this repository.

`art/` now draws a **different, newer** picture. It is painted on a canvas rather than
composed in SVG, and it reworks the five things the old one did worst — the egg, the
noodles, the broth, the pork and the steam — so that the food reads as food rather
than as a flat illustration:

- **the egg**: an elongated, slightly lobed white with a warm tinge at its edge, and a
  jammy yolk set into a cavity in it, off centre, its highlight spread wide and soft
  instead of a hard white dot;
- **the noodles**: ribbons whose half-width varies along their length, each shaded
  across its own axis with a narrow glint on top and a core shadow under it, some
  under the broth and some above it;
- **the broth**: amber shoyu with the room's window mirrored in it and cut into
  ripples, a meniscus climbing the wall, oil droplets and bubbles;
- **the pork**: braised belly with seared, blotchy edges and fat and lean in bands that
  bend and break up rather than running clean edge to edge;
- **the steam**: soft low-opacity plumes, tapered at both ends and blurred by degrees,
  with no edge anywhere.

It also adds the things that separate a photograph from a drawing and that the old one
had none of: a focal plane, so the room is soft and the food is crisp; a lighting model
that gives every wet surface a specular; a tight contact shadow under every piece of
food, so nothing floats; and film grain over the whole frame.

It has **not been submitted**. Measured against the picture standing as the entry it is
more realistic and cleaner, but it is also busier and reads less clearly at thumbnail
size, and the two things roughly cancel — so `entry.png` was left alone on purpose. To
ship it, render it over `entry.png` with the command above and enter a new commit.

## License

MIT, Copyright (c) 2026 farisghossani. See `LICENSE`.
