"""Beat-synced 4K vertical compositor for the STRYDER short.

Usage:
  python3 composite.py STRIP layers_dir events.json mix.wav out.mp4 [--times 0.5,4,24.2] [--preview-src clip.mov]
STRIP is the upscaled 2160x990 gameplay video. With --preview-src the strip is taken from the
original clip with a fast resize instead (for quick checks). --times renders PNG stills only.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

STRIP, LAYERS, EVENTS, AUDIO, OUT = sys.argv[1:6]
opt = lambda k: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else None
TIMES = [float(x) for x in opt('--times').split(',')] if opt('--times') else None
PREVIEW = opt('--preview-src')

W, H, FPS = 2160, 3840, 30
DUR = 45.8
SY, SH = 1270, 990
RH = 300
HERE = os.path.dirname(os.path.abspath(__file__))
FONT_BIG = os.path.join(HERE, '..', '..', 'intro', 'node_modules', '@fontsource', 'anton', 'files', 'anton-latin-400-normal.woff')
FONT_SM = os.path.join(HERE, '..', '..', 'intro', 'node_modules', '@fontsource', 'rajdhani', 'files', 'rajdhani-latin-700-normal.woff')
BLUE, PURPLE = (63, 123, 255), (168, 69, 255)

EV = json.load(open(EVENTS))
KICKS = np.array(EV['kicks'])
DROPS = EV['drops']
HITS = EV['hits']

bg = np.asarray(Image.open(f'{LAYERS}/bg.png').convert('RGB')).astype(np.float32)
fg = np.asarray(Image.open(f'{LAYERS}/fg.png').convert('RGBA')).astype(np.float32)
fg_a = fg[..., 3:4] / 255
fg_rgb = fg[..., :3] * fg_a
rows = np.where(fg[..., 3].max(1) > 0)[0]
mask = np.asarray(Image.open(f'{LAYERS}/refl_mask.png').convert('L')).astype(np.float32)[..., None] / 255
BANNER_Y = 2560


# ---------------------------------------------------------------- timing helpers
def kick_pulse(t, tau=0.13):
    d = t - KICKS[(KICKS <= t)]
    return float(np.exp(-d / tau).max()) if len(d) else 0.0


def decay(t, events, tau):
    v = 0.0
    for e in events:
        if t >= e:
            v = max(v, np.exp(-(t - e) / tau))
    return v


def ease_out(x):
    x = min(max(x, 0), 1)
    return 1 - (1 - x) ** 3


def ease_back(x):
    x = min(max(x, 0), 1)
    c = 2.2
    return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


# ---------------------------------------------------------------- text sprites
_cache = {}


def sprite(text, size, font=FONT_BIG, fill='white', glow=PURPLE, stroke=None):
    key = (text, size, font, str(fill), glow)
    if key in _cache:
        return _cache[key]
    f = ImageFont.truetype(font, size)
    st = stroke if stroke is not None else max(6, size // 16)
    l, t, r, b = f.getbbox(text, stroke_width=st)
    pad = size // 2
    w, h = r - l + pad * 2, b - t + pad * 2
    # glow
    gl = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(gl).text((pad - l, pad - t), text, font=f, fill=glow + (255,), stroke_width=st + size // 18, stroke_fill=glow + (255,))
    gl = gl.filter(ImageFilter.GaussianBlur(size / 7))
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.alpha_composite(gl)
    img.alpha_composite(gl)
    # gradient fill text
    txt = Image.new('L', (w, h), 0)
    ImageDraw.Draw(txt).text((pad - l, pad - t), text, font=f, fill=255)
    strk = Image.new('L', (w, h), 0)
    ImageDraw.Draw(strk).text((pad - l, pad - t), text, font=f, fill=255, stroke_width=st, stroke_fill=255)
    black = Image.new('RGBA', (w, h), (8, 6, 16, 255))
    img.paste(black, (0, 0), strk)
    if fill == 'grad':
        g = np.zeros((h, w, 4), np.uint8)
        k = np.linspace(0, 1, h)[:, None]
        top, bot = np.array([255, 255, 255]), np.array([196, 170, 255])
        g[..., :3] = (top * (1 - k[..., None]) + bot * k[..., None]).astype(np.uint8)
        g[..., 3] = 255
        img.paste(Image.fromarray(g, 'RGBA'), (0, 0), txt)
    elif fill == 'brand':
        g = np.zeros((h, w, 4), np.uint8)
        k = np.linspace(0, 1, w)[None, :, None]
        g[..., :3] = (np.array(BLUE) * (1 - k) + np.array(PURPLE) * k + 40).clip(0, 255).astype(np.uint8)
        g[..., 3] = 255
        img.paste(Image.fromarray(g, 'RGBA'), (0, 0), txt)
    else:
        img.paste(Image.new('RGBA', (w, h), fill), (0, 0), txt)
    _cache[key] = img
    return img


# (start, end, text, size, y_center, style)  style: punch | pop | slide | count
CAPTIONS = [
    (3.82, 6.95, 'ONE TAP.', 300, 830, 'punch'),
    (7.26, 11.85, 'TWO.', 340, 830, 'punch'),
    (12.1, 15.45, 'THEN I TOOK THE SKY', 175, 830, 'slide'),
    (18.0, 22.2, 'NO ESCAPE.', 260, 830, 'punch'),
    (22.74, 23.16, '3', 420, 830, 'count'),
    (23.16, 23.58, '2', 420, 830, 'count'),
    (23.58, 24.0, '1', 420, 830, 'count'),
    (24.0, 27.85, 'NO MERCY.', 300, 830, 'punch'),
    (27.92, 34.2, 'CLEAN.', 320, 830, 'punch'),
    (34.28, 41.9, 'TOO EASY.', 300, 830, 'punch'),
    (42.0, 43.35, 'GG.', 380, 830, 'punch'),
]


def paste(canvas, spr, cx, cy, scale=1.0, alpha=1.0):
    if alpha <= 0.01 or scale <= 0.01:
        return
    s = spr if abs(scale - 1) < 1e-3 else spr.resize((max(1, int(spr.width * scale)), max(1, int(spr.height * scale))), Image.BILINEAR)
    if alpha < 0.999:
        a = s.getchannel('A').point(lambda v: int(v * alpha))
        s = s.copy()
        s.putalpha(a)
    canvas.alpha_composite(s, (int(cx - s.width / 2), int(cy - s.height / 2)))


def draw_text(t):
    layer = Image.new('RGBA', (W, SY), (0, 0, 0, 0))
    # hook: word-by-word pop
    if 0.1 <= t < 3.8:
        words = [('THEY', 0.15), ('HAD', 0.45), ('NO', 0.75), ('IDEA...', 1.05)]
        out = ease_out((3.8 - t) / 0.18)
        # two lines: THEY HAD / NO IDEA...
        for i, (wd, t0) in enumerate(words):
            if t < t0:
                continue
            k = ease_back((t - t0) / 0.22)
            spr = sprite(wd, 230, fill='grad')
            line, col = divmod(i, 2)
            line_words = words[line * 2:line * 2 + 2]
            widths = [sprite(x, 230, fill='grad').width - 230 + 60 for x, _ in line_words]
            x0 = W / 2 - sum(widths) / 2
            cx = x0 + sum(widths[:col]) + widths[col] / 2
            paste(layer, spr, cx, 520 + line * 250, scale=k * out, alpha=min(1, (t - t0) / 0.08) * out)
        if t >= 1.6:
            k = ease_out((t - 1.6) / 0.3) * out
            blink = 0.75 + 0.25 * np.sin(t * 9)
            paste(layer, sprite('WAIT FOR THE END', 92, font=FONT_SM, fill='brand', glow=PURPLE, stroke=5), W / 2, 1010 + (1 - k) * 40, alpha=k * blink)
    for (t0, t1, text, size, cy, style) in CAPTIONS:
        if not (t0 <= t < t1):
            continue
        d, rem = t - t0, t1 - t
        out = ease_out(rem / 0.15)
        if style == 'punch':
            sc = 1 + 0.55 * (1 - ease_back(d / 0.2))
            sh = max(0, 1 - d / 0.35) * 22
            dx, dy = np.sin(t * 91) * sh, np.cos(t * 77) * sh
            beat = 1 + 0.035 * kick_pulse(t)
            paste(layer, sprite(text, size, fill='grad'), W / 2 + dx, cy + dy, scale=sc * beat * (0.85 + 0.15 * out), alpha=min(1, d / 0.05) * out)
        elif style == 'slide':
            k = ease_out(d / 0.35)
            paste(layer, sprite(text, size, fill='grad'), W / 2, cy + (1 - k) * 120, alpha=k * out)
        elif style == 'count':
            k = ease_back(d / 0.15)
            paste(layer, sprite(text, size, fill='brand'), W / 2, cy, scale=0.6 + 0.4 * k, alpha=1 - max(0, (d - 0.3) / 0.12))
    # CTA
    if t >= 43.4:
        k = ease_back((t - 43.4) / 0.3)
        paste(layer, sprite('FOLLOW', 300, fill='grad'), W / 2, 700, scale=k)
        if t >= 43.7:
            k2 = ease_out((t - 43.7) / 0.3)
            paste(layer, sprite('@STRYDERGAMING', 120, font=FONT_SM, fill='brand', stroke=6), W / 2, 960 + (1 - k2) * 40, alpha=k2)
    return np.asarray(layer).astype(np.float32)


# ---------------------------------------------------------------- strip source
def strip_reader():
    if PREVIEW:
        cmd = ['ffmpeg', '-v', 'error', '-i', PREVIEW, '-vf',
               "crop=720:330:0:475,zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
               "zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=saturation=1.12:contrast=1.04,scale=2160:990:flags=lanczos,format=rgb24",
               '-f', 'rawvideo', '-']
    else:
        cmd = ['ffmpeg', '-v', 'error', '-i', STRIP, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = 0
    while True:
        b = p.stdout.read(W * SH * 3)
        if len(b) < W * SH * 3:
            break
        yield n, np.frombuffer(b, np.uint8).reshape(SH, W, 3)
        n += 1


# ---------------------------------------------------------------- frame
def frame(t, strip):
    kp = kick_pulse(t)
    drop = decay(t, DROPS, 0.22)
    hit = decay(t, HITS, 0.18)
    in_drop2 = t >= DROPS[1]
    canvas = bg.copy()
    # background glow pulse on kicks (top area)
    canvas[:SY] *= 1 + 0.28 * kp + 0.6 * drop
    # strip zoom punch + shake
    z = 1 + 0.07 * drop + (0.018 * kp if in_drop2 else 0.0) + 0.03 * hit
    sh = 26 * hit + 14 * drop
    dx, dy = int(np.sin(t * 83) * sh), int(np.cos(t * 71) * sh * 0.6)
    s = Image.fromarray(strip)
    if z > 1.001:
        cw, ch = W / z, SH / z
        s = s.resize((W, SH), Image.BILINEAR, box=((W - cw) / 2 - dx, (SH - ch) / 2 - dy, (W + cw) / 2 - dx, (SH + ch) / 2 - dy))
    sa = np.asarray(s).astype(np.float32)
    # reflection
    rf = Image.fromarray(np.ascontiguousarray(sa[-RH:][::-1]).astype(np.uint8)).resize((W // 4, RH // 4), Image.BILINEAR)
    rf = np.asarray(rf.filter(ImageFilter.GaussianBlur(4)).resize((W, RH), Image.BILINEAR)).astype(np.float32)
    lum = rf.mean(2, keepdims=True)
    rf = (rf * 0.6 + lum * np.array([0.45, 0.3, 0.9]) * 0.6) * 0.55
    ry = SY + SH + 6
    canvas[ry:ry + RH] = canvas[ry:ry + RH] * (1 - mask * 0.75) + rf * mask
    canvas[SY:SY + SH] = sa
    # flash on drops
    if drop > 0.01:
        canvas += 255 * 0.55 * drop ** 2
    # foreground (frame lines + banner), banner pulses with the kick
    canvas[rows] = canvas[rows] * (1 - fg_a[rows]) + fg_rgb[rows]
    if kp > 0.01 or drop > 0.01:
        canvas[BANNER_Y:BANNER_Y + 1180] *= 1 + 0.12 * kp + 0.2 * drop
    # text
    tl = draw_text(t)
    a = tl[..., 3:4] / 255
    canvas[:SY] = canvas[:SY] * (1 - a) + tl[..., :3] * a
    return np.clip(canvas, 0, 255).astype(np.uint8)


if TIMES:
    want = {int(round(x * FPS)): x for x in TIMES}
    for n, st in strip_reader():
        if n in want:
            Image.fromarray(frame(n / FPS, st)).save(f'{OUT}_{want[n]:.2f}.png')
            print('still', want[n], flush=True)
            want.pop(n)
        if not want:
            break
    sys.exit()

enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                        '-i', AUDIO, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
                        '-profile:v', 'high', '-level:v', '5.2', '-pix_fmt', 'yuv420p',
                        '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
                        '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', OUT], stdin=subprocess.PIPE)
import time
t0 = time.time()
for n, st in strip_reader():
    enc.stdin.write(frame(n / FPS, st).tobytes())
    if n % 60 == 0:
        print(f'frame {n}  {(time.time() - t0) / (n + 1):.2f}s/frame', flush=True)
enc.stdin.close()
enc.wait()
print('done', OUT, flush=True)
