# Ghandi Home Electro — promo animation

`ghandi-home-electro-promo.mp4` is a 25-second motion-design video of the site (1920×1080, 60 fps,
H.264 + AAC, French text, blue and white). `ghandi-home-electro-promo.jpg` is its last frame, usable
as a poster image.

| Time | Scene |
| --- | --- |
| 0–3 s | Power-on line over a grid floor, sparks draw the logo house with an electric arc between them, flash with ray burst, electron orbits, "GHANDI" drops letter by letter, dive through the washer door |
| 3–7 s | The phone drops onto the floor (ray burst, confetti), appliances rise behind it, "Votre magasin d'électroménager à Casablanca" drops word by word with outline echoes, notifications drop onto the screen, warp-speed dive into the phone |
| 7–11 s | Browser: the address types in big letters and flies into the address bar, the home page loads, the camera pushes in while "Tous nos rayons" opens, a 3D carousel shows the catalogue and store pages |
| 11–14.5 s | The univers roll on the beat (Froid, Lavage, Cuisson, TV, Climatisation) between moving outline bands, then land as the site's tiles |
| 14.5–17.5 s | Brand slams (Samsung, LG, Bosch, Whirlpool, Haier, TCL, Candy, Franke), then a tilted 3D wall of brand tiles |
| 17.5–21 s | Services: free delivery, cash on delivery, store pick-up, phone and WhatsApp advice, with a progress rail hopping from card to card |
| 21–25 s | 3D tilted map of Casablanca, the pin drops on Boulevard Ghandi, then the extruded 3D logo with orbits, phone, website and address |

## 40-second version

`ghandi-home-electro-promo-40s.mp4` is a completely different, slower cut (same format): the story
plays in a floating 3D model of Casablanca built with CSS 3D, and every caption stays on screen long
enough to be read (only the brands go fast). `ghandi-home-electro-promo-40s.jpg` is its end card (taken at 38.8 s, before the power-off).

| Time | Scene |
| --- | --- |
| 0–4 s | Hook on the very first frame: "Besoin d'un frigo ?" (the noun flips on the beat: clim, télé, the last one held), the question is sucked into a power button that is pressed, a power wave switches on a field of appliance icons, they implode into a flash and the 3D logo lands as the answer, with the six-note sonic logo |
| 4–9.5 s | An iris opens on Casablanca: buildings spring up, palms pop along Boulevard Ghandi, cars drive, people walk; the Atlantic corniche and the Hassan II mosque line the north edge. The shop — a 3D model of the real building at 41 Boulevard Ghandi (glass front on two floors, six blue pillars, overhanging flat roof, bay with blinds, "41" over the door, railing) — assembles itself on the beat: pillars shoot up, the glass floors rise, the roof slams down, the lights come on, the sign and the pin drop. The camera cranes down to a street-level view of the facade ("Votre magasin d'électroménager à Casablanca", address) and walks in through the door. From 8 s a WhatsApp chip with the number stays in the corner |
| 9.5–15 s | Inside the showroom (its side wall is the shop's glass front with the blue pillars), customers browse while the camera lands on each univers on the beat (Froid, Lavage, Cuisson, TV, Climatisation) |
| 15–18 s | Front view of the brand wall: the eight brands light up on 8th notes |
| 18–23.75 s | A giant phone drops into a plaza; a finger orders on it while "Commander en 3 étapes" follows along (Panier, Livraison, Confirmation) |
| 23.75–28.35 s | The parcel flies from the phone into the delivery van; the camera pulls back as Mohammedia and Dar Bouazza rise as floating islands, pins drop and vans fly along the routes — "Livraison gratuite" |
| 28.35–30.85 s | The van parks at a house, the parcel hops to the door — "Paiement à la livraison" |
| 30.85–35.5 s | Above the shop a phone rings and a WhatsApp message pops up — "Conseil par téléphone et WhatsApp" — then the camera pulls back over the whole city |
| 35.5–40 s | A blue iris opens on the final card: logo, the slogan "L'électroménager qui fait vivre votre maison", one big WhatsApp button with the number (tapped by a finger), website, address and hours; then the card switches off like an old TV into the dark stage of the first frame, so the video loops seamlessly on TikTok / Reels |

```sh
COMP=v40 WORKERS=3 SUBFRAMES=3 promo/build.sh   # animation/v40.html -> ghandi-home-electro-promo-40s.mp4
```

Extra motion accents: speed lines on every fast camera move, hand-drawn circles and underlines on the
key words, confetti when the order is validated and when the parcel reaches the door, brand panels that
flip as they light up, puffs behind the van.

Texts, colours (`#1266e8`), font (Roboto) and contact details come from the site itself
(`src/lib/company.ts`, `src/lib/services.ts`, `src/styles.css`, the home page). The pages are rebuilt
from the site's components; product cards show generic product types with the site's own
"Prix sur demande" label, never invented models or prices.

## How it is made

- `animation/` — the animation as an HTML page (`js/fx.js` holds the reusable motion accents: ray
  bursts, ring pulses, confetti, electric arcs, grid floor, text bands, warp lines). Every frame is a pure function of time (`seek(t)`),
  so it renders identically every time. Open `animation/index.html?play` in Chrome to preview it
  (silent), or `?t=12.3` to look at one moment. The 40-second version is `animation/v40.html`
  (scenes in `js/v40/`), built on `js/iso.js`, a small CSS 3D engine for the city diorama
  (boxes, ground planes, billboards that face the camera, and a camera with zoom, yaw and pitch).
- `render.cjs` — drives Chromium with Playwright: exports the sound cue list and renders the frames.
- `audio/build_audio.py` — synthesises everything you hear: an original 120 BPM track and the
  sound effects (whooshes, impacts, pops, clicks, typing, notification dings, phone buzz, cash
  register, truck horn, map pin, …) placed on the cue list. No samples, no licensed music.
- `build.sh` — runs the whole pipeline. Each frame averages `SUBFRAMES` renders over a 180° shutter
  for real motion blur (3 by default: about 30 minutes on 4 cores; `SUBFRAMES=1` for a quick draft).

```sh
WORKERS=3 SUBFRAMES=3 promo/build.sh
```

Requires Node with Playwright's Chromium, Python 3 with numpy and scipy, and ffmpeg.
Intermediate files go to `promo/out/` (ignored by git).

Fonts: Roboto, Unbounded and Lexend Zetta (SIL Open Font License). Icons: Lucide (ISC License).
