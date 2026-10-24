# Ghandi Home Electro — promo animation

`ghandi-home-electro-promo.mp4` is a 25-second motion-design video of the site (1920×1080, 60 fps,
H.264 + AAC, French text, blue and white). `ghandi-home-electro-promo.jpg` is its last frame, usable
as a poster image.

| Time | Scene |
| --- | --- |
| 0–3 s | Power-on line, sparks draw the logo house, flash to blue, "GHANDI" drops letter by letter, dive through the washer door |
| 3–7 s | The phone drops onto the floor, "Votre magasin d'électroménager à Casablanca" drops word by word, notifications drop onto the screen |
| 7–11 s | Browser: the address is typed, the home page loads, "Tous nos rayons" opens, a 3D carousel shows the catalogue and store pages |
| 11–14.5 s | The univers roll on the beat (Froid, Lavage, Cuisson, TV, Climatisation), then land as the site's tiles |
| 14.5–17.5 s | Brand slams (Samsung, LG, Bosch, Whirlpool, Haier, TCL, Candy, Franke) and the brand grid |
| 17.5–21 s | Services: free delivery, cash on delivery, store pick-up, phone and WhatsApp advice |
| 21–25 s | Map of Casablanca, the pin drops on Boulevard Ghandi, then the final logo with phone, website and address |

Texts, colours (`#1266e8`), font (Roboto) and contact details come from the site itself
(`src/lib/company.ts`, `src/lib/services.ts`, `src/styles.css`, the home page). The pages are rebuilt
from the site's components; product cards show generic product types with the site's own
"Prix sur demande" label, never invented models or prices.

## How it is made

- `animation/` — the animation as an HTML page. Every frame is a pure function of time (`seek(t)`),
  so it renders identically every time. Open `animation/index.html?play` in Chrome to preview it
  (silent), or `?t=12.3` to look at one moment.
- `render.cjs` — drives Chromium with Playwright: exports the sound cue list and renders the frames.
- `audio/build_audio.py` — synthesises everything you hear: an original 120 BPM track and the
  sound effects (whooshes, impacts, pops, clicks, typing, notification dings, phone buzz, cash
  register, truck horn, map pin, …) placed on the cue list. No samples, no licensed music.
- `build.sh` — runs the whole pipeline (about 10 minutes on 4 cores).

```sh
WORKERS=3 promo/build.sh
```

Requires Node with Playwright's Chromium, Python 3 with numpy and scipy, and ffmpeg.
Intermediate files go to `promo/out/` (ignored by git).

Fonts: Roboto, Unbounded and Lexend Zetta (SIL Open Font License). Icons: Lucide (ISC License).
