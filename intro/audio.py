"""Synthesized sound design + score for the intro (no samples, fully original).

Usage: python3 audio.py out.wav
Timeline matches src/main.js (shots) and src/overlay.js (titles).
"""
import sys
import wave
import numpy as np

SR = 48000
DUR = 19.4
N = int(SR * DUR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR

L = np.zeros(N)
R = np.zeros(N)


def env_adsr(n, a, d, s, r, sustain_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = max(0, int(sustain_len * SR))
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sl, s), np.linspace(s, 0, max(r, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def onepole_lp(x, fc):
    """One-pole lowpass; fc may be scalar or array (time-varying)."""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a[i]) * x[i] + a[i] * acc
        y[i] = acc
    return y


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def reverb(x, secs=2.2, wet=0.3, seed=1):
    n = int(secs * SR)
    r = np.random.default_rng(seed)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / secs))
    ir = fft_filter(ir, lo=200, hi=6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - wet) + y * wet * 1.6


def place(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    if i0 < 0:
        sig = sig[-i0:]
        i0 = 0
    n = min(len(sig), N - i0)
    gl = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
    gr = np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    L[i0:i0 + n] += sig[:n] * gain * gl
    R[i0:i0 + n] += sig[:n] * gain * gr


def mix(*xs):
    n = max(len(x) for x in xs)
    return sum(np.pad(x, (0, n - len(x))) for x in xs)


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------------------------------------------------------------- elements
def boom(d=2.5, f0=55, f1=28, noise=0.6, bright=3000, seed=0):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 6)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    r = np.random.default_rng(seed)
    nz = r.standard_normal(len(t))
    nz = onepole_lp(nz, bright * np.exp(-t * 2.5) + 120) * np.exp(-t * 2.2)
    click = r.standard_normal(len(t)) * np.exp(-t * 60) * 0.5
    return np.tanh((sub * 1.2 + nz * noise * 2.5 + click) * 1.4)


def whoosh(d=0.8, f0=400, f1=3000, peak=0.6, seed=3):
    t = tt(d)
    r = np.random.default_rng(seed)
    nz = r.standard_normal(len(t))
    fc = f0 + (f1 - f0) * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    y = onepole_lp(nz, fc) - onepole_lp(nz, fc * 0.3)
    e = np.where(t < d * peak, (t / (d * peak)) ** 2, np.exp(-(t - d * peak) * 8))
    return y * e * 3


def engine(d, rpm_fn, seed=5):
    t = tt(d)
    f = rpm_fn(t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum(np.sin(k * ph) / k * (1 if k % 2 else 0.7) for k in range(1, 14))
    r = np.random.default_rng(seed)
    grit = onepole_lp(r.standard_normal(len(t)), 900) * 0.4
    y = np.tanh(saw * 1.8 + grit * (1 + np.sin(ph * 0.5)))
    return onepole_lp(y, 2600)


def screech(d=1.0, seed=8):
    t = tt(d)
    r = np.random.default_rng(seed)
    f = 1900 + 160 * np.sin(2 * np.pi * 7 * t) + r.standard_normal(len(t)).cumsum() * 0.3
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    nz = fft_filter(r.standard_normal(len(t)), lo=1500, hi=5000)
    e = np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.25)
    return (tone * 0.5 + nz * 0.8) * e


def metal_ping(d=1.0, base=2200, seed=2):
    t = tt(d)
    ratios = [1, 1.47, 2.09, 2.76, 3.9]
    y = sum(np.sin(2 * np.pi * base * rr * t) * np.exp(-t * (6 + 4 * i)) / (i + 1) for i, rr in enumerate(ratios))
    return y * 0.6


def thump(d=0.5, f=55):
    t = tt(d)
    return np.sin(2 * np.pi * f * t * (1 + 0.6 * np.exp(-t * 30))) * np.exp(-t * 9)


def riser(d=1.5, f0=200, f1=2400, seed=4):
    t = tt(d)
    r = np.random.default_rng(seed)
    fc = f0 * (f1 / f0) ** (t / d)
    nz = onepole_lp(r.standard_normal(len(t)), fc) - onepole_lp(r.standard_normal(len(t)), fc * 0.2)
    tone = np.sin(2 * np.pi * np.cumsum(fc * 0.5) / SR) * 0.3
    return (nz * 2 + tone) * (t / d) ** 2


def braam(d=2.0, f=36.71, seed=1):
    """Brassy low hit: detuned saws through a closing lowpass."""
    t = tt(d)
    y = np.zeros(len(t))
    for det in (-0.6, 0, 0.5):
        for k in range(1, 18):
            y += np.sin(2 * np.pi * (f + det) * k * t) / k
            y += np.sin(2 * np.pi * (f * 1.5 + det) * k * t) / k * 0.5
    y = onepole_lp(y, 2200 * np.exp(-t * 2.2) + 200)
    return np.tanh(y * 0.8) * env_adsr(len(t), 0.02, 0.4, 0.6, 1.2, d - 1.6)


# ---------------------------------------------------------------- score: pulse bass + drums
BPM = 128.0
beat = 60 / BPM


def kick():
    return thump(0.35, 50) * 1.2


def snare(seed=0):
    t = tt(0.3)
    r = np.random.default_rng(seed)
    return fft_filter(r.standard_normal(len(t)), lo=900, hi=9000) * np.exp(-t * 18) * 0.6 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25) * 0.5


def hat(seed=0):
    t = tt(0.06)
    r = np.random.default_rng(seed)
    return fft_filter(r.standard_normal(len(t)), lo=7000) * np.exp(-t * 70) * 0.25


def bass_note(f, d):
    t = tt(d)
    ph = 2 * np.pi * f * t
    y = sum(np.sin(k * ph) / k for k in range(1, 8))
    return onepole_lp(y, 700) * env_adsr(len(t), 0.005, 0.1, 0.7, 0.06, d - 0.17) * 0.5


music = np.zeros(N)


def mplace(sig, t0, g=1.0):
    i0 = int(t0 * SR)
    n = min(len(sig), N - i0)
    if n > 0:
        music[i0:i0 + n] += sig[:n] * g


# D minor pulse: D D F D | C C A# A
notes = [73.42, 73.42, 87.31, 73.42, 65.41, 65.41, 58.27, 55.0]
# beat section 2.4 -> 9.8 (drive), then drop out for slow-mo
t = 2.4
i = 0
while t < 9.75:
    mplace(bass_note(notes[(i // 2) % 8], beat / 2 * 0.9), t, 0.9)
    if i % 4 == 0:
        mplace(kick(), t, 1.0)
    if i % 8 == 4:
        mplace(snare(i), t, 0.8)
    if t > 4.0:
        mplace(hat(i), t, 0.6 if i % 2 else 0.35)
    if t > 6.4 and i % 8 == 6:
        mplace(kick(), t, 0.7)
    t += beat / 2
    i += 1
# low string pad under the establishing shot
pad_t = tt(2.6)
pad = sum(np.sin(2 * np.pi * f * pad_t + k) for k, f in enumerate([73.42, 110.0, 146.83, 174.61]))
pad *= np.minimum(1, pad_t / 1.0) * np.minimum(1, (2.6 - pad_t) / 0.4) * 0.12
mplace(pad, 0.0)
music = reverb(music, 1.6, 0.18, seed=11)
place(music, 0, 0.55)

# ---------------------------------------------------------------- SFX timeline
# 0.0 establishing: wind + distant fire + braam
wind_t = tt(2.6)
wind = onepole_lp(rng.standard_normal(len(wind_t)), 500 + 300 * np.sin(wind_t * 1.3)) * 0.8
place(wind * np.minimum(1, wind_t / 0.8) * np.minimum(1, (2.6 - wind_t) / 0.3), 0.0, 0.5)
place(reverb(braam(2.4), 2.5, 0.35), 0.05, 0.55)
place(engine(1.0, lambda x: 60 + 30 * x) * np.linspace(0, 1, SR), 1.5, 0.12, pan=0.4)

# 2.4 driver close-up: interior engine roar
place(boom(0.6, 70, 40, noise=0.2, seed=1), 2.4, 0.5)
d = 1.6
e = engine(d, lambda x: 95 + 12 * np.sin(x * 3))
place(e * env_adsr(len(e), 0.02, 0.2, 0.8, 0.2, d - 0.42), 2.4, 0.35)

# 4.0 chase: engine approaching + bullet ricochets + pass-by whoosh
d = 2.4
e = engine(d, lambda x: 110 + 40 * (x / d) ** 2)
place(e * np.linspace(0.3, 1.0, len(e)) ** 2, 4.0, 0.45)
for tt0, pan in [(4.35, 0.3), (4.6, -0.4), (4.9, 0.5), (5.2, -0.2), (5.45, 0.4), (5.8, -0.5)]:
    place(mix(metal_ping(0.35, 2600 + 900 * rng.random(), seed=int(tt0 * 10)) * 0.5, whoosh(0.18, 2000, 6000, 0.2, seed=int(tt0 * 7)) * 0.4), tt0, 0.35, pan)
place(whoosh(0.9, 300, 2500, 0.7, seed=9), 5.7, 0.8, pan=0.6)

# 6.4 rival reveal: low hit + idling engine
place(reverb(braam(1.6, 34.65), 2.0, 0.3), 6.4, 0.6)
place(engine(1.6, lambda x: 42 + 3 * np.sin(x * 10)), 6.4, 0.18, pan=0.3)

# 8.0 drift: whoosh in, screech, stop thud, door step
place(whoosh(0.5, 300, 2000, 0.8, seed=4), 7.75, 0.6, pan=-0.3)
place(screech(1.05), 8.1, 0.32, pan=0.2)
place(thump(0.4, 70), 9.0, 0.6)
place(metal_ping(0.25, 900, seed=5), 9.2, 0.15)

# 9.8 slow-mo grenade: pin ping, heartbeat, pitched-down whoosh, riser
place(reverb(metal_ping(1.6, 3100, seed=8), 2.5, 0.45), 9.82, 0.45, pan=0.2)
for hb in (10.05, 10.75, 11.45):
    place(thump(0.35, 48), hb, 0.9)
    place(thump(0.3, 44), hb + 0.18, 0.6)
place(whoosh(1.9, 120, 900, 0.9, seed=12), 9.9, 0.7)
place(riser(1.9, 150, 2600), 9.95, 0.25)

# 11.8 grenade bounces then silence
for bt, g in [(11.86, 0.6), (12.05, 0.4), (12.18, 0.25), (12.27, 0.15)]:
    place(mix(metal_ping(0.25, 1500, seed=int(bt * 100)), thump(0.15, 120) * 0.5), bt, g, pan=-0.2)
place(onepole_lp(rng.standard_normal(int(0.5 * SR)), 2500) * np.exp(-tt(0.5) * 4) * 0.15, 12.25, 0.4)

# 12.75 EXPLOSION
x = boom(3.2, 60, 26, noise=0.9, bright=6000, seed=3)
place(reverb(x, 3.0, 0.35, seed=4), 12.75, 1.0)
place(boom(2.0, 80, 35, noise=0.6, bright=3000, seed=5), 13.1, 0.45, pan=-0.6)
place(boom(2.0, 75, 30, noise=0.6, bright=3000, seed=6), 13.45, 0.4, pan=0.6)
debris_t = tt(2.0)
debris = np.zeros(len(debris_t))
for k in range(40):
    i0 = int(rng.random() * len(debris_t) * 0.8)
    s = metal_ping(0.15, 700 + rng.random() * 3000, seed=k)
    debris[i0:i0 + len(s)] += s[:len(debris_t) - i0] * rng.random()
place(debris, 13.0, 0.18)
# tinnitus ring after blast
ring_t = tt(2.0)
place(np.sin(2 * np.pi * 4100 * ring_t) * np.exp(-ring_t * 1.4) * np.minimum(1, ring_t / 0.2) * 0.05, 12.85, 1.0)
# score: big hit + rising choir-ish pad into flash
place(reverb(braam(2.2, 36.71), 3.0, 0.35), 12.75, 0.75)
place(riser(2.1, 300, 5000, seed=9), 12.95, 0.35)

# 15.2 logo: reverse swell, impact, shimmer, sub tail
place(boom(2.8, 50, 30, noise=0.4, bright=8000, seed=10), 15.2, 0.8)
place(reverb(braam(3.2, 36.71), 3.5, 0.4), 15.2, 0.6)
for k in range(7):
    place(whoosh(0.35, 800, 5000, 0.6, seed=20 + k), 15.2 + 0.15 + [0, 0.32, 0.12, 0.44, 0.2, 0.36, 0.06][k] * 0.9, 0.22, pan=(k - 3) / 4)
place(reverb(mix(metal_ping(2.5, 1760, seed=30), metal_ping(2.5, 2637, seed=31) * 0.6), 3.0, 0.5), 16.45, 0.5)
sh_t = tt(1.2)
shimmer = fft_filter(rng.standard_normal(len(sh_t)), lo=6000) * np.sin(np.pi * sh_t / 1.2) ** 2 * 0.25
place(shimmer, 17.0, 0.6)
# tagline sting
place(whoosh(0.5, 600, 4000, 0.7, seed=40), 17.25, 0.35, pan=-0.3)
place(reverb(mix(thump(0.6, 45), metal_ping(1.2, 1320, seed=41) * 0.4), 2.5, 0.4), 17.5, 0.6)

# ---------------------------------------------------------------- master
mix = np.stack([L, R], 1)
fade = np.ones(N)
fo = int(0.5 * SR)
fade[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade[:, None]
mix = mix / (np.max(np.abs(mix)) + 1e-9) * 1.6
mix = np.tanh(mix) * 0.92  # soft clip / glue
out = (mix * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'intro.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out.tobytes())
print('wrote audio', DUR, 's')
