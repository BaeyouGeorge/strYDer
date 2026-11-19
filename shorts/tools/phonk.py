"""Original drift-phonk track + final mix for the STRYDER short. Fully synthesized (no samples).

Usage: python3 phonk.py game_audio.wav out_mix.wav events.json
- builds a 142.7 BPM phonk beat whose bars land on the clip's key moments (3.82s, 24.0s)
- mixes it with the clip's game audio (ducked under the music)
- writes events.json (kick times, section markers) for beat-synced visuals
"""
import json
import sys
import wave

import numpy as np

SR = 48000
DUR = 45.8
N = int(SR * DUR)
BAR0 = 3.82          # first drop (first snipe)
BAR = 1.682          # 142.7 BPM, 4/4 -> bar 12 starts at 24.0 (arena drop)
STEP = BAR / 16      # 16th note
bar_t = lambda k: BAR0 + k * BAR

L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(1)
EV = {'kicks': [], 'snares': [], 'drops': [], 'hits': [], 'break': [], 'bpm': 60 / (BAR / 4)}


def tt(d):
    return np.arange(int(d * SR)) / SR


def place(sig, t0, g=1.0, pan=0.0, bus=None):
    i0 = int(round(t0 * SR))
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    gl, gr = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    (bus or (L, R))[0][i0:i0 + n] += sig[:n] * g * gl
    (bus or (L, R))[1][i0:i0 + n] += sig[:n] * g * gr


def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(f)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi:
        m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def lp_sweep(x, f0, f1):
    """Block-wise lowpass sweep (cheap): filter 4096-sample blocks with interpolated cutoff."""
    out = np.zeros_like(x)
    B = 4096
    nb = int(np.ceil(len(x) / B))
    for b in range(nb):
        seg = x[b * B:(b + 2) * B]
        fc = f0 * (f1 / f0) ** (b / max(nb - 1, 1))
        y = fft_filter(seg, hi=fc)
        w = np.hanning(len(y)) if len(y) > 8 else np.ones(len(y))
        out[b * B:b * B + len(y)] += y * w
    return out


def reverb(x, secs=1.8, wet=0.3, seed=3):
    n = int(secs * SR)
    r = np.random.default_rng(seed)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / secs))
    ir = fft_filter(ir, lo=250, hi=7000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    y = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    return x * (1 - wet) + y * wet * 1.5


# ---------------------------------------------------------------- instruments
def cowbell(f, d=0.22, bright=1.0):
    t = tt(d)
    sq = lambda fr: np.sign(np.sin(2 * np.pi * fr * t)) * 0.6 + np.sin(2 * np.pi * fr * t) * 0.4
    y = sq(f) + 0.75 * sq(f * 1.4836)
    y = fft_filter(y, lo=f * 0.8, hi=4000 * bright + 800)
    e = np.exp(-t * 14) * 0.8 + np.exp(-t * 60) * 0.6
    return y * e * 0.35


def kick(d=0.4):
    t = tt(d)
    f = 45 + 160 * np.exp(-t * 35)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.3
    return np.tanh((y + click) * 2.2)


def bass808(notes, t0, dur_total):
    """Distorted 808 following [(t_rel, freq, len)], with glides between consecutive notes."""
    t = tt(dur_total)
    f = np.zeros(len(t))
    amp = np.zeros(len(t))
    for i, (tr, fr, ln) in enumerate(notes):
        a, b = int(tr * SR), min(len(t), int((tr + ln) * SR))
        if a >= len(t):
            continue
        nxt = notes[i + 1][1] if i + 1 < len(notes) else fr
        k = np.linspace(0, 1, b - a)
        glide = np.clip((k - 0.7) / 0.3, 0, 1) ** 2 if (i + 1 < len(notes) and notes[i + 1][0] <= tr + ln + 1e-3) else 0
        f[a:b] = fr * (nxt / fr) ** glide
        tl = np.arange(b - a) / SR
        amp[a:b] = np.maximum(amp[a:b], np.exp(-tl * 1.2) * np.minimum(1, tl / 0.004))
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.25 * np.sin(2 * ph)
    y = np.tanh(y * 3.5) * amp
    return fft_filter(y, hi=1800) * 0.9


def clap():
    t = tt(0.3)
    y = np.zeros(len(t))
    for o in (0, 0.009, 0.018, 0.026):
        i = int(o * SR)
        y[i:] += rng.standard_normal(len(t) - i) * np.exp(-np.arange(len(t) - i) / SR * (90 if o < 0.02 else 16))
    return fft_filter(y, lo=900, hi=7000) * 0.5


def hat(d=0.05, open_=False):
    t = tt(0.25 if open_ else d)
    return fft_filter(rng.standard_normal(len(t)), lo=7500) * np.exp(-t * (14 if open_ else 80)) * 0.22


def riser(d, f0=200, f1=6000):
    t = tt(d)
    x = rng.standard_normal(len(t))
    y = lp_sweep(x, f0, f1) * (t / d) ** 2
    return y * 0.6


def rev_crash(d=1.2):
    t = tt(d)
    y = fft_filter(rng.standard_normal(len(t)), lo=3000) * np.exp(-t * 3)
    return y[::-1] * 0.5


def impact(d=2.2):
    t = tt(d)
    f = 30 + 90 * np.exp(-t * 10)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.8)
    nz = fft_filter(rng.standard_normal(len(t)), hi=3000) * np.exp(-t * 6) * 0.6
    return np.tanh((sub + nz) * 1.8)


def whoosh(d=0.6):
    t = tt(d)
    x = rng.standard_normal(len(t))
    y = lp_sweep(x, 300, 5000) - fft_filter(x, hi=250)
    return y * np.sin(np.pi * t / d) ** 2 * 0.6


def pad(freqs, d):
    t = tt(d)
    y = sum(np.sin(2 * np.pi * f * t + i) + 0.3 * np.sin(2 * np.pi * f * 2.003 * t) for i, f in enumerate(freqs))
    return fft_filter(y, hi=1400) * np.minimum(1, t / 0.6) * np.minimum(1, (d - t) / 0.6) * 0.05


# ---------------------------------------------------------------- composition (F# minor)
F = {'F#2': 92.5, 'A2': 110.0, 'B2': 123.47, 'C#3': 138.59, 'E3': 164.81, 'F#3': 185.0, 'A3': 220.0, 'B3': 246.94, 'C#4': 277.18,
     'E4': 329.63, 'F#4': 369.99, 'G#4': 415.3, 'A4': 440.0}
B808 = {'F#1': 46.25, 'A1': 55.0, 'B1': 61.74, 'C#2': 69.3, 'E1': 41.2, 'D2': 73.42, 'F#2': 92.5}
# 2-bar cowbell riff (step, note)
RIFF = [(0, 'F#4'), (3, 'F#4'), (6, 'E4'), (8, 'F#4'), (10, 'A4'), (12, 'G#4'), (14, 'E4'),
        (16, 'C#4'), (19, 'C#4'), (22, 'E4'), (24, 'F#4'), (26, 'E4'), (28, 'C#4'), (30, 'B3')]
# 2-bar 808 line (step, note, steps)
BASS = [(0, 'F#1', 3), (3, 'F#1', 3), (6, 'A1', 2), (8, 'F#1', 6), (14, 'E1', 2),
        (16, 'C#2', 3), (19, 'C#2', 3), (22, 'B1', 2), (24, 'A1', 4), (28, 'F#1', 2), (30, 'F#2', 2)]
KICK_STEPS = [0, 6, 10, 16 + 0, 16 + 3, 16 + 10]
SNARE_STEPS = [8, 24]

drums = (np.zeros(N), np.zeros(N))
melo = (np.zeros(N), np.zeros(N))
bassb = (np.zeros(N), np.zeros(N))


def riff_pair(t0, bright=1.0, oct_up=False, gain=1.0):
    for st, nm in RIFF:
        f = F[nm]
        place(cowbell(f, bright=bright), t0 + st * STEP, 0.55 * gain, pan=-0.15, bus=melo)
        if oct_up:
            place(cowbell(f * 2, d=0.15, bright=bright), t0 + st * STEP, 0.22 * gain, pan=0.3, bus=melo)


def bass_pair(t0, gain=1.0):
    notes = [(st * STEP, B808[nm], ln * STEP) for st, nm, ln in BASS]
    place(bass808(notes, t0, 2 * BAR + 0.3), t0, 0.85 * gain, bus=bassb)


def drum_pair(t0, half=False, hard=False):
    ks = [0, 16] if half else KICK_STEPS
    for st in ks:
        place(kick(), t0 + st * STEP, 1.0, bus=drums)
        EV['kicks'].append(round(t0 + st * STEP, 3))
    for st in ([16] if half else SNARE_STEPS):
        place(clap(), t0 + st * STEP, 0.9 if not hard else 1.05, bus=drums)
        EV['snares'].append(round(t0 + st * STEP, 3))
    for st in range(0, 32, 2):
        place(hat(), t0 + st * STEP, 0.7 if st % 4 == 0 else 0.45, pan=0.25, bus=drums)
    # hat rolls (triplet 32nds) at the end of each 2-bar phrase
    for k in range(6):
        place(hat(0.03), t0 + (28 + k * 2 / 3) * STEP, 0.45, pan=0.25, bus=drums)
    if hard:
        place(hat(open_=True), t0 + 14 * STEP, 0.5, pan=-0.3, bus=drums)
        place(hat(open_=True), t0 + 30 * STEP, 0.5, pan=-0.3, bus=drums)


# INTRO 0 -> BAR0: muffled riff, opening up
intro_t0 = BAR0 - 2 * BAR
intro = (np.zeros(N), np.zeros(N))
for st, nm in RIFF:
    place(cowbell(F[nm], bright=0.3), intro_t0 + st * STEP, 0.5, bus=intro)
    if intro_t0 + st * STEP < 0:
        continue
place(pad([F['F#2'], F['C#3'], F['A3']], BAR0 + 0.2), 0.0, 1.0, bus=intro)
for ch in intro:
    ch[:int(BAR0 * SR)] = lp_sweep(ch[:int(BAR0 * SR)], 500, 5000)
    ch[int(BAR0 * SR):] = 0
L += intro[0]
R += intro[1]
place(riser(BAR0 - 0.8, 200, 7000), 0.8, 0.5)
place(rev_crash(1.2), BAR0 - 1.2, 0.8)

# DROP 1: bars 0..4 (5 bars -> pairs at 0,2 + single bar 4)
EV['drops'].append(BAR0)
place(impact(), BAR0, 0.9)
for k in (0, 2, 4):
    riff_pair(bar_t(k))
    bass_pair(bar_t(k))
    drum_pair(bar_t(k))
# cut everything after bar 5 (break starts)
for bus in (melo, bassb, drums):
    for ch in bus:
        ch[int(bar_t(5) * SR):] = 0

# BREAK: bars 5..6 — flight. reverb riff, long 808 slide down, whoosh on the cut
EV['break'] = [12.0, bar_t(7)]
place(whoosh(0.9), 11.7, 0.8)
br = (np.zeros(N), np.zeros(N))
for st, nm in RIFF:
    place(cowbell(F[nm], bright=0.6), bar_t(5) + st * STEP, 0.4, bus=br)
for ch in br:
    ch[:] = reverb(ch, 2.5, 0.55, seed=5)
L += br[0]
R += br[1]
place(bass808([(0, B808['F#2'], 1.5 * BAR), (1.5 * BAR, B808['F#1'], 1.5 * BAR)], bar_t(5), 3 * BAR), bar_t(5), 0.7, bus=bassb)
place(pad([F['F#2'], F['A2'], F['C#3'], F['E3']], 2 * BAR + 0.5), bar_t(5), 1.6)

# GROOVE: bars 7..10 half-time
for k in (7, 9):
    riff_pair(bar_t(k), bright=0.8)
    bass_pair(bar_t(k), gain=0.9)
    drum_pair(bar_t(k), half=True)
for bus in (melo, bassb, drums):
    for ch in bus:
        ch[int(bar_t(11) * SR):int(bar_t(12) * SR)] = 0
# BUILD: bar 11 snare roll + riser + stutter
for i in range(16):
    st = i if i < 8 else 8 + (i - 8) * 0.5
    place(clap(), bar_t(11) + st * STEP, 0.35 + 0.04 * i, bus=drums)
for i in range(8):
    place(clap(), bar_t(11) + (12 + i * 0.5) * STEP, 0.7, bus=drums)
place(riser(BAR, 300, 9000), bar_t(11), 0.6)
place(rev_crash(1.0), 24.0 - 1.0, 0.9)

# DROP 2: bars 12..22 (arena) — hardest
EV['drops'].append(round(bar_t(12), 3))
place(impact(), bar_t(12), 1.0)
for k in range(12, 23, 2):
    riff_pair(bar_t(k), bright=1.2, oct_up=True, gain=1.05)
    bass_pair(bar_t(k), gain=1.1)
    drum_pair(bar_t(k), hard=True)
for bus in (melo, bassb, drums):
    for ch in bus:
        ch[int(bar_t(23) * SR):] = 0

# hits on big gameplay moments
for th in (27.92, 34.28, 42.0):
    EV['hits'].append(th)
    place(impact(1.2), th, 0.45)

# OUTRO: final bar with tape stop, then tail
OUT0 = bar_t(23)
EV['outro'] = round(OUT0, 3)
seg = (np.zeros(N), np.zeros(N))
riff_pair(OUT0, bright=1.0)
bass_pair(OUT0)
drum_pair(OUT0, hard=True)
# tape stop the last bar: time-varying resample of [OUT0, OUT0 + 1 bar] (all buses)
mixbus = [melo[c] + bassb[c] + drums[c] for c in (0, 1)]
a, b = int(OUT0 * SR), int((OUT0 + BAR) * SR)
for c in (0, 1):
    src = mixbus[c][a:b].copy()
    n = b - a
    speed = np.linspace(1.0, 0.05, n) ** 1.3
    pos = np.cumsum(speed)
    pos = pos[pos < n - 1]
    out = np.interp(pos, np.arange(n), src) * np.linspace(1, 0.2, len(pos))
    mixbus[c][a:] = 0
    mixbus[c][a:a + len(out)] = out
place(impact(2.5), OUT0 + BAR * 0.9, 0.7)

music_L = L + mixbus[0] * 0.95
music_R = R + mixbus[1] * 0.95

# sidechain pump on melody/pads from the kicks
pump = np.ones(N)
for k in EV['kicks']:
    i = int(k * SR)
    n = min(int(0.18 * SR), N - i)
    if n > 0:
        pump[i:i + n] = np.minimum(pump[i:i + n], 0.55 + 0.45 * np.linspace(0, 1, n) ** 0.7)
music_L = (music_L - mixbus[0] * 0.95) * pump + mixbus[0] * 0.95
music_R = (music_R - mixbus[1] * 0.95) * pump + mixbus[1] * 0.95

# ---------------------------------------------------------------- mix with game audio (ducked)
with wave.open(sys.argv[1]) as w:
    g = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float).reshape(-1, w.getnchannels()) / 32768
    if w.getframerate() != SR:
        raise SystemExit('game audio must be 48 kHz')
g = np.pad(g, ((0, max(0, N - len(g))), (0, 0)))[:N]
duck = np.full(N, 0.42)
duck[:int(BAR0 * SR)] = 0.8                       # intro: game sound up front
duck[int(12.0 * SR):int(bar_t(7) * SR)] = 0.6     # break
m = np.stack([music_L, music_R], 1)
m = m / (np.max(np.abs(m)) + 1e-9) * 0.9
gn = g / (np.max(np.abs(g)) + 1e-9) * 0.9
mix = m * 0.95 + gn * duck[:, None]
fo = int(0.6 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
mix = np.tanh(mix / (np.max(np.abs(mix)) + 1e-9) * 1.5) * 0.93
with wave.open(sys.argv[2], 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
json.dump(EV, open(sys.argv[3], 'w'), indent=1)
print('mix written', DUR, 's; kicks', len(EV['kicks']), 'bpm', round(EV['bpm'], 1))
