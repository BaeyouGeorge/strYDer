"""Build the static layers for the vertical 4K STRYDER short.

Usage: python3 make_layers.py banner.png out_dir
Writes: bg.png (RGB), fg.png (RGBA overlay: strip frame + banner), refl_mask.png (L)
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

BANNER, OUT = sys.argv[1], sys.argv[2]
W, H = 2160, 3840
STRIP_Y, STRIP_H = 1270, 990
BANNER_Y = 2560
BLUE, PURPLE = np.array([63, 123, 255]), np.array([168, 69, 255])

banner = Image.open(BANNER).convert('RGB')

# ---------------------------------------------------------------- background
bg = Image.new('RGB', (W, H), (2, 2, 6))
# big blurred glow from the S + mascot + wordmark area of the banner
glow_src = banner.crop((430, 130, 1290, 700))
g = glow_src.resize((2700, int(2700 * glow_src.height / glow_src.width)), Image.LANCZOS)
g = g.filter(ImageFilter.GaussianBlur(70))
g = ImageEnhance.Color(g).enhance(1.6)
g = ImageEnhance.Brightness(g).enhance(1.9)
ga = np.asarray(g).astype(np.float32)
# soft elliptical mask so the glow fades into black
yy, xx = np.mgrid[0:g.height, 0:g.width]
m = np.clip(1.25 - np.hypot((xx - g.width / 2) / (g.width * 0.48), (yy - g.height / 2) / (g.height * 0.5)), 0, 1) ** 1.5
ga *= m[..., None]
gx, gy = (W - g.width) // 2, 1270 - int(g.height * 0.82)
base = np.asarray(bg).astype(np.float32)
y0, y1 = max(gy, 0), min(gy + g.height, H)
x0, x1 = max(gx, 0), min(gx + g.width, W)
base[y0:y1, x0:x1] += ga[y0 - gy:y1 - gy, x0 - gx:x1 - gx]
# faint second glow behind the banner area, purple on the right / blue on the left
yy, xx = np.mgrid[0:H, 0:W]
for cx, cy, r, c, k in [(500, 2400, 700, BLUE, 0.22), (1700, 2420, 700, PURPLE, 0.24)]:
    d = np.exp(-(((xx - cx) / r) ** 2 + ((yy - cy) / (r * 0.45)) ** 2))
    base += d[..., None] * c * k
# sparkles
rng = np.random.default_rng(3)
for _ in range(420):
    x, y = rng.integers(0, W), rng.integers(0, 1250)
    b = rng.random() ** 3 * 220
    col = BLUE if x < W / 2 else PURPLE
    s = 1 + int(rng.random() * 2)
    base[max(0, y - s):y + s, max(0, x - s):x + s] += (col * 0.4 + 120) * b / 255
# top vignette
v = np.clip(yy[..., None] / 500.0, 0.35, 1.0)
base = base * v
Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).save(f'{OUT}/bg.png')

# ---------------------------------------------------------------- foreground overlay
fg = Image.new('RGBA', (W, H), (0, 0, 0, 0))


def grad_line(img, y, h):
    a = np.zeros((h, W, 4), np.float32)
    k = np.linspace(0, 1, W)[None, :, None]
    a[..., :3] = BLUE * (1 - k) + PURPLE * k
    a[..., 3] = 255
    img.alpha_composite(Image.fromarray(a.astype(np.uint8), 'RGBA'), (0, y))


glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
for y in (STRIP_Y - 6, STRIP_Y + STRIP_H):
    grad_line(glow, y, 6)
d = ImageDraw.Draw(glow)
# HUD corner brackets (angled, like the banner frames)
L, T, cut = 150, 10, 34
for (x, y, sx, sy) in [(40, STRIP_Y - 40, 1, 1), (W - 40, STRIP_Y - 40, -1, 1), (40, STRIP_Y + STRIP_H + 40, 1, -1), (W - 40, STRIP_Y + STRIP_H + 40, -1, -1)]:
    col = tuple(BLUE) if sx > 0 else tuple(PURPLE)
    d.line([(x + sx * L, y), (x + sx * cut, y), (x, y + sy * cut), (x, y + sy * L)], fill=col + (255,), width=T, joint='curve')
blurred = glow.filter(ImageFilter.GaussianBlur(14))
fg.alpha_composite(blurred)
fg.alpha_composite(blurred)
fg.alpha_composite(glow)
# banner, full width, with a soft top fade
bw, bh = W, int(W * banner.height / banner.width)
b = banner.resize((bw, bh), Image.LANCZOS)
ba = np.full((bh, bw), 255, np.float32)
ba[:120] *= np.linspace(0, 1, 120)[:, None]
fg.alpha_composite(Image.fromarray(np.dstack([np.asarray(b), ba]).astype(np.uint8), 'RGBA'), (0, BANNER_Y))
fg.save(f'{OUT}/fg.png')

# ---------------------------------------------------------------- reflection mask (top bright -> transparent)
RH = 300
mask = (np.linspace(1, 0, RH) ** 1.6 * 255)[:, None].repeat(W, 1)
Image.fromarray(mask.astype(np.uint8), 'L').save(f'{OUT}/refl_mask.png')
print('layers written; banner height', bh, 'banner ends at', BANNER_Y + bh)
