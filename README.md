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

`art/gen.mjs` writes `art/art.html`, and a browser renders it:

```
cd art
node gen.mjs
~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
  --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1024,1024 \
  --screenshot=../entry.png "file://$PWD/art.html"
```

The generator is deterministic: a fixed-seed PRNG, no clock and no `Math.random`, so
the same source always draws the same picture. It is a drawing rather than a
photograph — every highlight, shadow and texture in it is a gradient, a filter or a
path, built up in layers: the room out of focus behind the bowl, the bowl and its rim,
the broth and what it mirrors, the nori, the noodles, the pork, the egg, the scatter on
the surface, and the steam and key light on top of it all.

## License

MIT, Copyright (c) 2026 farisghossani. See `LICENSE`.
