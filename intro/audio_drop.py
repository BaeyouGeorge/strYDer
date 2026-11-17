"""Sound design + score for "THE DROP" (src/drop.js). Fully synthesized.

Usage: python3 audio_drop.py out.wav
Reuses the synth building blocks from audio.py (everything above its score section).
"""
import os
import sys
import wave
import numpy as np

_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'audio.py')).read()
exec(_src[:_src.index('# ---------------------------------------------------------------- score')])

T_LAND, T_STRIKE = 12.35, 13.3
# lightning events (time, pan, distance 0=near..1=far)
THUNDER = [(0.85, -0.5, 0.5), (2.05, 0.6, 0.6), (3.3, 0.2, 0.3), (5.0, 0.5, 0.5), (6.7, -0.4, 0.4),
           (8.1, -0.6, 0.7), (10.05, 0.2, 0.8), (11.05, -0.2, 0.2)]


def thunder(dist=0.5, seed=0, d=3.5):
    t = tt(d)
    r = np.random.default_rng(seed)
    crack = fft_filter(r.standard_normal(len(t)), lo=800) * np.exp(-t * (40 + 30 * dist)) * (1 - dist)
    rum = onepole_lp(r.standard_normal(len(t)), 180 + 300 * (1 - dist))
    mod = onepole_lp(np.abs(r.standard_normal(len(t))), 6) * 6
    rum *= mod * np.exp(-t * 1.1) * np.minimum(1, t / (0.05 + 0.25 * dist))
    return np.tanh(crack * 2 + rum * 2.5)


def noise_bed(d, fc, seed):
    r = np.random.default_rng(seed)
    return onepole_lp(r.standard_normal(int(d * SR)), fc)


def fade_env(n, a, b):
    e = np.ones(n)
    a, b = int(a * SR), int(b * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if b:
        e[-b:] = np.linspace(1, 0, b)
    return e


# ---------------------------------------------------------------- beds
# high-altitude wind + plane drone (0 - 4.3)
w = noise_bed(4.3, 700, 1) - noise_bed(4.3, 150, 2)
place(w * fade_env(len(w), 0.6, 0.2), 0.0, 0.5)
dr_t = tt(4.3)
drone = sum(np.sin(2 * np.pi * f * dr_t + k) / (k + 1) for k, f in enumerate([48, 96, 144, 192, 61.5]))
drone = onepole_lp(np.tanh(drone * 1.5), 900) * fade_env(len(dr_t), 0.8, 0.15)
place(drone, 0.0, 0.25)
# ramp interior roar is louder
place(noise_bed(1.7, 1200, 3) * fade_env(int(1.7 * SR), 0.1, 0.1), 2.6, 0.35)
# freefall wind roar rising (4.3 - 7.42)
ff = noise_bed(3.15, 1, 4)
ff_t = tt(3.15)
fc = 300 + 2500 * (ff_t / 3.15)
ff = onepole_lp(np.random.default_rng(5).standard_normal(len(ff_t)), fc) * 1.4
place(ff * fade_env(len(ff_t), 0.15, 0.02), 4.3, 0.65)
# gentle wind under canopy
place(noise_bed(1.6, 500, 6) * fade_env(int(1.6 * SR), 0.05, 0.3), 7.42, 0.35)
# rain on the ground (8.8 - 15.2)
rn = fft_filter(np.random.default_rng(7).standard_normal(int(6.4 * SR)), lo=1500, hi=9000)
drops = np.zeros_like(rn)
rr = np.random.default_rng(8)
for i in rr.integers(0, len(rn) - 400, 900):
    drops[i:i + 400] += np.sin(2 * np.pi * rr.uniform(2500, 6000) * tt(400 / SR)) * np.exp(-tt(400 / SR) * 300) * rr.uniform(0.1, 0.4)
place((rn * 0.25 + drops) * fade_env(len(rn), 0.4, 0.3), 8.8, 0.45)

# ---------------------------------------------------------------- thunder
for i, (tt0, pan, dist) in enumerate(THUNDER):
    delay = 0.08 + dist * 0.5
    place(thunder(dist, seed=50 + i), tt0 + delay, 0.75 * (1.1 - dist * 0.5), pan)

# ---------------------------------------------------------------- story SFX
place(reverb(braam(2.6, 36.71), 2.8, 0.35), 0.05, 0.6)                    # opening hit
place(reverb(braam(1.8, 43.65), 2.2, 0.3), 2.6, 0.45)                     # cut inside plane
place(mix(thump(0.4, 60), whoosh(0.4, 400, 3000, 0.3, seed=9)), 2.65, 0.5)
for st in (2.75, 3.1, 3.45):                                              # footsteps on ramp
    place(mix(thump(0.12, 90), metal_ping(0.12, 600, seed=int(st * 10)) * 0.3), st, 0.35)
place(whoosh(0.9, 200, 4000, 0.4, seed=11), 4.0, 0.9)                     # the jump
place(whoosh(0.7, 300, 5000, 0.75, seed=12), 5.5, 0.8, pan=0.4)           # dive past camera
place(riser(1.3, 200, 3000, seed=13), 6.0, 0.3)
# canopy snap
snap = mix(thump(0.3, 70) * 1.2, fft_filter(np.random.default_rng(14).standard_normal(int(0.35 * SR)), lo=300, hi=4000) * np.exp(-tt(0.35) * 14))
place(snap, 7.42, 0.9)
for k in range(5):                                                        # fabric flutter
    place(fft_filter(np.random.default_rng(20 + k).standard_normal(int(0.12 * SR)), lo=200, hi=1500) * np.exp(-tt(0.12) * 25), 7.6 + k * 0.11, 0.25)
# rivals: low hit, march
place(reverb(braam(1.6, 34.65), 2.2, 0.3), 9.0, 0.55)
for k in range(8):
    place(thump(0.15, 80 + 10 * (k % 2)), 9.1 + k * 0.32, 0.25, pan=(k % 3 - 1) * 0.4)
# rival look-up sting
place(reverb(metal_ping(1.2, 880, seed=30), 2.0, 0.4), 10.65, 0.3)
# slow-mo fall: heartbeat + descending whoosh
for hb in (11.65, 12.1):
    place(thump(0.35, 48), hb, 0.9)
    place(thump(0.3, 44), hb + 0.18, 0.6)
place(whoosh(0.75, 2000, 200, 0.9, seed=31), 11.6, 0.6)
# landing impact
place(reverb(boom(2.0, 70, 32, noise=0.5, bright=2500, seed=32), 2.0, 0.3), T_LAND, 0.85)
# the strike: thunder crack right on top + energy blast
place(thunder(0.0, seed=99, d=4.0), T_STRIKE, 1.0)
place(reverb(boom(3.0, 60, 26, noise=0.7, bright=7000, seed=33), 3.0, 0.35), T_STRIKE + 0.03, 0.9)
zap_t = tt(1.2)
zap = np.sin(2 * np.pi * np.cumsum(900 * np.exp(-zap_t * 3) + 80) / SR) * np.exp(-zap_t * 3) * 0.5
place(reverb(zap, 2.0, 0.4), T_STRIKE + 0.03, 0.5)
place(reverb(braam(2.2, 36.71), 3.0, 0.35), T_STRIKE, 0.8)
ring_t = tt(1.8)
place(np.sin(2 * np.pi * 4300 * ring_t) * np.exp(-ring_t * 1.6) * np.minimum(1, ring_t / 0.2) * 0.04, T_STRIKE + 0.1, 1.0)
place(riser(1.8, 300, 5000, seed=34), 13.4, 0.35)

# ---------------------------------------------------------------- score: dark pulse
music = np.zeros(N)


def mplace(sig, t0, g=1.0):
    i0 = int(t0 * SR)
    n = min(len(sig), N - i0)
    if n > 0:
        music[i0:i0 + n] += sig[:n] * g


def bass_note(f, d):
    t = tt(d)
    ph = 2 * np.pi * f * t
    y = sum(np.sin(k * ph) / k for k in range(1, 8))
    return onepole_lp(y, 650) * env_adsr(len(t), 0.005, 0.1, 0.7, 0.06, d - 0.17) * 0.5


BPM = 120.0
beat = 60 / BPM
notes = [73.42, 73.42, 87.31, 73.42, 65.41, 65.41, 58.27, 55.0]
t = 2.6
i = 0
while t < 11.55:
    if not (7.3 <= t < 9.0):  # canopy: music breathes
        mplace(bass_note(notes[(i // 2) % 8], beat / 2 * 0.9), t, 0.9)
    if i % 4 == 0:
        mplace(thump(0.35, 50) * 1.2, t, 0.9)
    if t > 4.3 and i % 2 == 1 and not (7.3 <= t < 9.0):
        mplace(fft_filter(np.random.default_rng(i).standard_normal(int(0.06 * SR)), lo=7000) * np.exp(-tt(0.06) * 70) * 0.25, t, 0.5)
    t += beat / 2
    i += 1
pad_t = tt(9.0)
pad = sum(np.sin(2 * np.pi * f * pad_t + k) for k, f in enumerate([73.42, 110.0, 146.83, 174.61, 220.0]))
pad *= fade_env(len(pad_t), 1.5, 1.0) * 0.07
mplace(pad, 7.0)
music = reverb(music, 1.6, 0.2, seed=11)
place(music, 0, 0.5)

# ---------------------------------------------------------------- logo (same as the bridge version)
place(boom(2.8, 50, 30, noise=0.4, bright=8000, seed=10), 15.2, 0.8)
place(reverb(braam(3.2, 36.71), 3.5, 0.4), 15.2, 0.6)
for k in range(7):
    place(whoosh(0.35, 800, 5000, 0.6, seed=20 + k), 15.2 + 0.15 + [0, 0.32, 0.12, 0.44, 0.2, 0.36, 0.06][k] * 0.9, 0.22, pan=(k - 3) / 4)
place(reverb(mix(metal_ping(2.5, 1760, seed=30), metal_ping(2.5, 2637, seed=31) * 0.6), 3.0, 0.5), 16.45, 0.5)
sh_t = tt(1.2)
place(fft_filter(rng.standard_normal(len(sh_t)), lo=6000) * np.sin(np.pi * sh_t / 1.2) ** 2 * 0.25, 17.0, 0.6)
place(whoosh(0.5, 600, 4000, 0.7, seed=40), 17.25, 0.35, pan=-0.3)
place(reverb(mix(thump(0.6, 45), metal_ping(1.2, 1320, seed=41) * 0.4), 2.5, 0.4), 17.5, 0.6)
place(noise_bed(2.5, 400, 60) * fade_env(int(2.5 * SR), 0.5, 1.5), 16.5, 0.15)  # distant rain under logo

# ---------------------------------------------------------------- master
mixd = np.stack([L, R], 1)
fo = int(0.5 * SR)
fade = np.ones(N)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mixd *= fade[:, None]
mixd = mixd / (np.max(np.abs(mixd)) + 1e-9) * 1.6
mixd = np.tanh(mixd) * 0.92
out = (mixd * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'drop.wav', 'wb') as wv:
    wv.setnchannels(2)
    wv.setsampwidth(2)
    wv.setframerate(SR)
    wv.writeframes(out.tobytes())
print('wrote audio', DUR, 's')
