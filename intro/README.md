# STRYDER — "The Bridge" team intro

An ~18.6 second cinematic team intro rendered entirely in code: a three.js scene drawn
frame by frame in headless Chromium, synthesized sound design, and ffmpeg for encoding.
All visuals, characters and audio are original.

## Story

| Time | Shot | On screen |
|------|------|-----------|
| 0.0–2.4 | Sunset establishing shot of a burning steel truss bridge | **ONE BRIDGE.** / FOUR SQUADS WAITING ON IT. |
| 2.4–4.0 | Close-up of the masked driver at speed | **THEY SAID NOBODY CROSSES.** |
| 4.0–6.4 | Low chase: red roadster weaving through wrecks, bullets sparking | |
| 6.4–8.0 | The rival waits in a black car blocking the road | |
| 8.0–9.8 | Drift stop in tire smoke, hero steps out | |
| 9.8–11.8 | Slow-mo grenade (team logo printed on it) flies into the lens | **WE DON'T CROSS BRIDGES.** |
| 11.8–12.6 | Grenade bounces and rolls under the rival's car | |
| 12.6–15.2 | Hero walks toward camera, huge explosion behind, rival car flips overhead | **WE BURN THEM.** + killfeed |
| 15.2–18.6 | White flash → 3D logo assembles with light rays and a glint | **STRYDER** / TEAM |

## Customize

- **Team name / texts:** `src/config.js` (logo, grenade print, titles, killfeed names).
- **Your own characters:** drop transparent PNGs into `chars/`:
  - `hero_full.png` — full body, standing, facing camera (≈1:2 aspect)
  - `hero_bust.png` — head & shoulders, looking to the left (square)
  - `rival_bust.png` — head & shoulders, facing camera (square)

  Anything missing falls back to the built-in procedural characters.
- **Shot timing / cameras:** `SHOTS` and `setupShot()` in `src/main.js`.
- **Sound:** `audio.py` (timeline mirrors the shot list).

## Render

```bash
npm install
python3 audio.py intro.wav
node render.js video video.mp4 --w 1920 --h 1080          # full video (silent)
ffmpeg -i video.mp4 -i intro.wav -c:v copy -c:a aac -b:a 256k -shortest stryder_intro.mp4
node render.js stills out/ 3.2 9.5 13.1 --w 1280 --h 720  # quick stills for checking
```

Rendering uses SwiftShader (CPU WebGL), around 5–15 s per 1080p frame.
`--from/--to` render a time range, so long renders can be split across processes and
joined with ffmpeg's concat demuxer.
