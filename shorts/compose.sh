#!/usr/bin/env bash
# Compose the vertical 4K STRYDER short.
# Usage: ./compose.sh strip_4k.mp4 source.mov out.mp4 [extra ffmpeg output args...]
set -euo pipefail
STRIP="$1"; SRC="$2"; OUT="$3"; shift 3
D="$(cd "$(dirname "$0")" && pwd)/layers"
STRIP_Y=1270; STRIP_H=990; RH=300

ffmpeg -v error -y \
  -loop 1 -framerate 30 -i "$D/bg.png" \
  -i "$STRIP" \
  -loop 1 -framerate 30 -i "$D/fg.png" \
  -loop 1 -framerate 30 -i "$D/refl_mask.png" \
  -i "$SRC" \
  -filter_complex "
    [0:v]format=yuv444p,eq=brightness='0.03*sin(2*PI*t/3.2)':saturation='1+0.08*sin(2*PI*t/3.2)':eval=frame[bg];
    [1:v]split[s1][s2];
    [s2]crop=2160:${RH}:0:$((STRIP_H-RH)),vflip,gblur=sigma=16,eq=brightness=-0.04:saturation=1.35,format=rgba[r0];
    [3:v]format=gray[m];
    [r0][m]alphamerge,colorchannelmixer=aa=0.5[refl];
    [bg][refl]overlay=0:$((STRIP_Y+STRIP_H+6))[b1];
    [b1][s1]overlay=0:${STRIP_Y}:shortest=1[b2];
    [b2][2:v]overlay=0:0:format=auto,format=yuv420p[v]" \
  -map "[v]" -map 4:a? -r 30 \
  -c:v libx264 -preset slow -crf 16 -profile:v high -level:v 5.2 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 320k -shortest -movflags +faststart "$@" "$OUT"
