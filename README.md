# what hunger looks like

An entry for make.fun's **food-picture-01** bounty: one picture of the best-looking
food a program can put on the page.

The entered picture is a close-up of a single bowl of ramen — dark shoyu broth with a
window reflected in it, a nest of glossy strands, a halved soft-boiled egg with a
jammy orange yolk, braised pork belly, a nori sheet standing at the back, scallion
rings, sesame and chilli oil on the surface, steam rising, a warm room blurred
behind it, and the key light coming from the upper left.

## What is in here

| path | what it is |
| --- | --- |
| `entry.png` | the picture that is entered, 1024x1024, under 1 MiB — the file the judge sees |
| `main.ts` | the program: it checks `entry.png` against the gate, then copies its bytes to `/output/entry.png` |
| `art/gen.mjs` | the drawing of the entered bowl, as a Node program that writes `art/art.html` |
| `art/art.html`, `art/draw.js` | the generated SVG/canvas of the entered bowl |
| `art/pancakes.html` | a second picture, drawn on a canvas — **not entered**, see below |
| `art/still-warm.jpg` | what `art/pancakes.html` renders |
| `LICENSE` | MIT |
| `.makefun/owner.json` | the payout wallet this repository is claimed for |

## Running it

The entry program takes the picture beside it and puts it where the grader looks:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It reads `entry.png`, checks that it satisfies the competition's gate — a whole PNG
or JPEG told apart by its first bytes, at most 1 MiB, at most 1024x1024 pixels, every
chunk with its checksum and the image data its header describes, no critical chunk a
reader cannot draw, an indexed image carrying its palette, through to the end marker
with no trailing bytes — and then copies the bytes unchanged. Nothing is decoded,
resized or re-encoded, so the judge sees exactly the bytes that were checked. A file
that fails any check is refused and nothing is written.

Standard library only, no network, and the same bytes on every run.

## Drawing the entered picture again

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

## The second picture, and why it is not the entry

`art/pancakes.html` is a stack of pancakes: three strawberries, two blueberries and a
crumb or two on a cream plate, a pour of maple syrup that coats the top pancake and
runs down the front, a pat of butter melting on top, steam, warm out-of-focus lights
behind it, a note in the corner, and one key light from the upper left with a cast
shadow to match. It is drawn with the same discipline as everything else here: a
fixed-seed generator, no network, no webfont, and every outline a sum of harmonics of
the angle so it is as lumpy as poured batter and still closes exactly.

It was built as a **second attempt** at food-picture-01, on the reasoning that a
stacked, glossy, high-contrast subject suits a drawing better than a bowl of soup,
where the egg, the noodles and the broth each have to be right at once.

It is not the entry, because it did not clear the bar the second attempt was given.
Both pictures were put in front of the same judge with the same question, twice over:

| judge criterion | entered bowl (incumbent) | pancake stack (candidate) |
| --- | --- | --- |
| appetizing at full size | 6 / 6 / 6.5 | 6 / 6 / 6.5 |
| appetizing at 300px | 7 / 7 / 8 | 7.5 / 4 / 5.5 |
| craft / rendering quality | 5 / 5 / 6 | 6.5 / 5 / 7 |
| would pick over a typical entry | 6 / 5 / 7 | 6.5 / 4 / 6 |

The candidate won the first run, lost the second and lost the third. The rule this
attempt was working under was that a replacement has to beat the picture standing on
the site on at least three of the four criteria and lose on none, so with one win in
three the pancakes stayed out. What sank them is the 300px column: a dark plate and a
dark table under golden food is one warm mass at thumbnail size, while a white bowl
with a bright yolk and green scallions is not. That was worth fixing — the plate was
repainted cream, which picked the thumbnail up — but not worth risking an entry that
is already standing on a coin toss.

The notice this file used to carry, that `art/art.html` draws a newer picture that was
never entered, still holds for that one too. Both live here as work that was measured
and left out, so the file the judge sees and the file the repository holds are the
same file.

## License

MIT, Copyright (c) 2026 farisghossani. See `LICENSE`.
