# STRYDER — "THE DROP" intro

A ~19 second cinematic channel intro rendered entirely in code: a three.js scene drawn
frame by frame in headless Chromium, synthesized sound design, and ffmpeg for encoding.
Story, characters, visuals and audio are original; the STRYDER wordmark, subtitle and
tagline come from the channel banner (`brand/`).

## Story — "THE DROP" (default, `src/drop.js`)

| Time | Shot | On screen |
|------|------|-----------|
| 0.0–2.6 | Cargo plane cuts through a lightning storm above the clouds | **100 DROP IN.** |
| 2.6–4.3 | Inside the plane: STRYDER walks to the open ramp, lightning lights the X eyes, jumps | **ONE WALKS OUT.** |
| 4.3–6.0 | Free-fall with him, then he dives past the lens | |
| 6.0–7.3 | POV dive through the clouds; a purple flare marks the crate on the island | **THE STORM DOESN'T PICK SIDES.** |
| 7.3–9.0 | Branded parachute snaps open against the storm | |
| 9.0–10.6 | Three red-visor rivals walk out of the fog toward the crate | |
| 10.6–11.6 | Close-up: the rival looks up | |
| 11.6–13.0 | Slow-mo: STRYDER lands on the crate between them | |
| 13.0–15.2 | Lightning strikes *him*; a purple shockwave wipes the squad | **IT PICKS ME.** + killfeed |
| 15.2–19.4 | Flash → STRYDER wordmark assembles, STRYDERGAMING, EVERY DROP BUILDS LEGACY | |

An earlier alternative cut ("The Bridge", car chase + grenade) is kept in `src/main.js`
(`?story=bridge`, audio: `audio.py`).

## Customize

- **Texts:** `DROP_TEXT` in `src/config.js` (titles, killfeed names).
- **Brand art:** `brand/wordmark.png`, `brand/subtitle.png`, `brand/tagline.png`.
- **Your own characters:** drop transparent PNGs into `chars/`:
  - `hero_full.png` — full body, standing, facing camera (≈1:2 aspect)
  - `hero_bust.png` — head & shoulders, looking to the left (square)
  - `rival_bust.png` — head & shoulders, facing camera (square)

  Anything missing falls back to the built-in procedural characters.
- **Shot timing / cameras:** `SHOTS` and `setupShot()` in `src/drop.js`.
- **Sound:** `audio_drop.py` (timeline mirrors the shot list).

## Render

```bash
npm install
python3 audio_drop.py intro.wav
node render.js video video.mp4 --w 1920 --h 1080          # full video (silent)
ffmpeg -i video.mp4 -i intro.wav -c:v copy -c:a aac -b:a 256k -shortest stryder_intro.mp4
node render.js stills out/ 3.2 9.5 13.1 --w 1280 --h 720  # quick stills for checking
```

Rendering uses SwiftShader (CPU WebGL), around 5–15 s per 1080p frame.
`--from/--to` render a time range, so long renders can be split across processes and
joined with ffmpeg's concat demuxer.
