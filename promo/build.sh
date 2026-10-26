#!/usr/bin/env bash
# Rebuilds promo/ghandi-home-electro-promo.mp4 (25 s) or, with COMP=v40, promo/ghandi-home-electro-promo-40s.mp4,
# plus a poster image, from the animation source.
# Needs: node + Playwright (Chromium), python3 + numpy + scipy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"
# COMP=v40 builds the 40-second version (animation/v40.html) into ghandi-home-electro-promo-40s.mp4
export COMP="${COMP:-}"
NAME="ghandi-home-electro-promo${COMP:+-40s}"
OUTDIR="out${COMP:+/$COMP}"

node render.cjs cues                    # sound cue list from the animation -> $OUTDIR/cues.json
python3 audio/build_audio.py            # music + sound effects       -> $OUTDIR/audio_raw.wav
node render.cjs video "${WORKERS:-3}" "${SUBFRAMES:-3}"  # 1920x1080 @ 60 with motion blur -> $OUTDIR/video.mp4

ffmpeg -y -loglevel error -i "$OUTDIR/video.mp4" -i "$OUTDIR/audio_raw.wav" -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 256k -movflags +faststart -shortest "$NAME.mp4"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$NAME.mp4")
# poster: the full end card (the 40 s version ends on a TV power-off for the loop, so it is taken before it)
POSTER_T=$(if [ -n "$COMP" ]; then echo 38.8; else awk "BEGIN { print $DUR - 0.5 }"; fi)
ffmpeg -y -loglevel error -ss "$POSTER_T" -i "$NAME.mp4" -frames:v 1 -q:v 3 "$NAME.jpg"

echo "-> promo/$NAME.mp4"
