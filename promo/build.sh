#!/usr/bin/env bash
# Rebuilds promo/ghandi-home-electro-promo.mp4 (and its poster image) from the animation source.
# Needs: node + Playwright (Chromium), python3 + numpy + scipy, ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

node render.cjs cues                    # sound cue list from the animation -> out/cues.json
python3 audio/build_audio.py            # music + sound effects       -> out/audio_raw.wav
node render.cjs video "${WORKERS:-3}"   # 1500 frames, 1920x1080 @ 60 -> out/video.mp4

ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio_raw.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high \
  -c:a aac -b:a 256k -movflags +faststart -shortest ghandi-home-electro-promo.mp4
ffmpeg -y -loglevel error -ss 24.5 -i ghandi-home-electro-promo.mp4 -frames:v 1 -q:v 3 ghandi-home-electro-promo.jpg

echo "-> promo/ghandi-home-electro-promo.mp4"
