// Original, procedurally drawn characters (2D canvas) used as billboards.
// Any of them can be replaced by dropping a PNG with transparency into /chars
// (hero_full.png, hero_bust.png, rival_bust.png).

const GREEN = '#7a5cff'; // brand blue-violet
const RED = '#ff2a3a';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Tapered capsule from (x1,y1) to (x2,y2)
function limb(g, x1, y1, x2, y2, w1, w2, fill) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  const nx = -dy / L, ny = dx / L;
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  g.lineTo(x2 + nx * w2 / 2, y2 + ny * w2 / 2);
  g.lineTo(x2 - nx * w2 / 2, y2 - ny * w2 / 2);
  g.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2);
  g.closePath(); g.fill();
  g.beginPath(); g.arc(x1, y1, w1 / 2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(x2, y2, w2 / 2, 0, Math.PI * 2); g.fill();
}

function glowLine(g, pts, color, width, blur) {
  g.save();
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = color; g.shadowBlur = blur;
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.stroke();
  }
  g.restore();
}

function shade(g, w, h, top, bottom) {
  // Darken lower half / add vertical light falloff, only where pixels exist
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.restore();
}

// ---------- HERO (full body, front, arms slightly out) ----------
export function drawHeroFull() {
  const W = 512, H = 1024, c = canvas(W, H), g = c.getContext('2d');
  const mirror = (fn) => { fn(1); g.save(); g.translate(W, 0); g.scale(-1, 1); fn(-1); g.restore(); };
  const pants = '#2b2f2a', hood = '#2a2d33', vest = '#17191c', boot = '#0e0f10';

  // legs + boots
  mirror(() => {
    limb(g, 222, 515, 210, 715, 80, 62, pants);
    limb(g, 210, 715, 204, 905, 62, 50, pants);
    g.fillStyle = '#353a34'; g.fillRect(186, 585, 40, 58); // cargo pocket
    g.fillStyle = boot;
    g.beginPath(); g.roundRect(176, 890, 58, 82, 14); g.fill();
    g.fillRect(170, 955, 70, 20);
  });
  // arms
  mirror(() => {
    limb(g, 180, 228, 124, 372, 66, 56, hood);
    limb(g, 124, 372, 92, 500, 56, 46, hood);
    g.fillStyle = '#1a1c1f';
    g.beginPath(); g.arc(86, 524, 30, 0, Math.PI * 2); g.fill(); // glove fist
  });
  // green armband (left arm only)
  g.save();
  g.translate(160, 290); g.rotate(-1.2);
  g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 18;
  g.fillRect(-27, -7, 54, 14);
  g.restore();

  // torso
  g.beginPath();
  g.moveTo(150, 214); g.quadraticCurveTo(256, 172, 362, 214);
  g.lineTo(346, 370); g.lineTo(324, 530); g.lineTo(188, 530); g.lineTo(166, 370);
  g.closePath(); g.fill();
  // vest + pouches + straps
  g.fillStyle = vest;
  g.beginPath(); g.roundRect(190, 240, 132, 240, 18); g.fill();
  g.fillStyle = '#24272b';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(196 + i * 42, 392, 36, 52, 6); g.fill(); }
  g.fillStyle = '#0c0d0f'; g.fillRect(208, 212, 16, 40); g.fillRect(288, 212, 16, 40);
  g.fillStyle = '#121315'; g.fillRect(192, 505, 128, 22); // belt
  g.fillStyle = '#3d4247'; g.fillRect(248, 506, 16, 20);
  // chest emblem
  glowLine(g, [[238, 300], [256, 288], [274, 300]], GREEN, 5, 14);

  // head: face in shadow, glowing X eyes, spiky hair, high collar over the mouth
  g.fillStyle = '#121318';
  g.beginPath(); g.ellipse(256, 132, 42, 50, 0, 0, Math.PI * 2); g.fill();
  xEyes(g, 256, 126, 1.0, 0);
  spikyHair(g, 256, 108, 1.0, 0);
  collar(g, 256, 196, 1.0);

  shade(g, W, H, 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)');
  return c;
}

// ---------- shared head parts (brand look: spiky blue-violet hair, X eyes, high collar) ----------
const HAIR_A = '#4f6bff', HAIR_B = '#9b3dff';

function spikyHair(g, cx, cy, s, lean) {
  // lean > 0 sweeps spikes toward screen-right (back of head when facing left)
  const spikes = [
    [-46, 10, -78, -30], [-34, -8, -58, -66], [-18, -20, -30, -98], [0, -24, 4, -118],
    [18, -20, 40, -104], [34, -10, 72, -78], [46, 6, 92, -40], [40, 24, 100, 8],
  ];
  const gr = g.createLinearGradient(cx - 90 * s, cy, cx + 90 * s, cy - 100 * s);
  gr.addColorStop(0, HAIR_A); gr.addColorStop(1, HAIR_B);
  g.save();
  g.fillStyle = '#1a1530';
  g.beginPath(); g.ellipse(cx, cy + 6 * s, 54 * s, 40 * s, 0, Math.PI, Math.PI * 2); g.fill();
  for (const [bx, by, tx, ty] of spikes) {
    const x0 = cx + bx * s, y0 = cy + by * s, x1 = cx + (tx + lean * 30) * s, y1 = cy + ty * s;
    const nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny), w = 20 * s;
    g.fillStyle = '#1a1530';
    g.beginPath(); g.moveTo(x0 + nx / L * w, y0 + ny / L * w); g.lineTo(x1, y1); g.lineTo(x0 - nx / L * w, y0 - ny / L * w); g.closePath(); g.fill();
    // lit edge
    g.strokeStyle = gr; g.lineWidth = 4 * s; g.shadowColor = HAIR_B; g.shadowBlur = 14 * s;
    g.beginPath(); g.moveTo(x0 + nx / L * w, y0 + ny / L * w); g.lineTo(x1, y1); g.stroke();
    g.shadowBlur = 0;
  }
  // fringe over the forehead
  g.fillStyle = '#211a3d';
  g.beginPath();
  g.moveTo(cx - 48 * s, cy + 8 * s);
  for (let i = 0; i <= 6; i++) { const x = cx + (-48 + i * 16) * s; g.lineTo(x + 6 * s, cy + (i % 2 ? 30 : 14) * s); g.lineTo(x + 14 * s, cy + 6 * s); }
  g.lineTo(cx + 50 * s, cy - 4 * s); g.closePath(); g.fill();
  g.restore();
}

function xEyes(g, cx, cy, s, skew) {
  for (const dx of [-17, 17]) {
    const x = cx + (dx + skew) * s, y = cy, r = 9 * s;
    glowLine(g, [[x - r, y - r * 0.8], [x + r, y + r * 0.8]], '#c9b8ff', 4 * s, 20 * s);
    glowLine(g, [[x + r, y - r * 0.8], [x - r, y + r * 0.8]], '#c9b8ff', 4 * s, 20 * s);
    glowLine(g, [[x - r, y - r * 0.8], [x + r, y + r * 0.8]], HAIR_B, 2 * s, 30 * s);
  }
}

function collar(g, cx, cy, s) {
  // tall jacket collar covering the mouth, with a small crowned-S badge
  g.fillStyle = '#16171c';
  g.beginPath();
  g.moveTo(cx - 70 * s, cy + 30 * s); g.lineTo(cx - 56 * s, cy - 42 * s); g.quadraticCurveTo(cx, cy - 30 * s, cx + 56 * s, cy - 42 * s);
  g.lineTo(cx + 70 * s, cy + 30 * s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(140,120,255,0.35)'; g.lineWidth = 3 * s;
  g.beginPath(); g.moveTo(cx - 56 * s, cy - 42 * s); g.quadraticCurveTo(cx, cy - 30 * s, cx + 56 * s, cy - 42 * s); g.stroke();
  // badge
  const bx = cx - 36 * s, by = cy - 8 * s;
  g.save();
  g.shadowColor = '#4f8bff'; g.shadowBlur = 10 * s;
  g.fillStyle = '#4f8bff';
  g.font = `bold ${20 * s}px Anton, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('S', bx, by + 6 * s);
  g.beginPath(); g.moveTo(bx - 9 * s, by - 8 * s); g.lineTo(bx - 9 * s, by - 16 * s); g.lineTo(bx - 4 * s, by - 11 * s); g.lineTo(bx, by - 18 * s);
  g.lineTo(bx + 4 * s, by - 11 * s); g.lineTo(bx + 9 * s, by - 16 * s); g.lineTo(bx + 9 * s, by - 8 * s); g.closePath(); g.fill();
  g.restore();
}

// ---------- HERO bust, 3/4 view facing screen-left (driver shot) ----------
export function drawHeroBust() {
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d');
  // shoulders / jacket
  g.fillStyle = '#1c1d23';
  g.beginPath();
  g.moveTo(10, 512); g.quadraticCurveTo(40, 335, 220, 322); g.quadraticCurveTo(440, 310, 500, 512);
  g.closePath(); g.fill();
  glowLine(g, [[120, 420], [200, 372]], GREEN, 4, 14); // jacket piping
  // head
  g.fillStyle = '#121318';
  g.beginPath(); g.ellipse(236, 262, 70, 82, -0.1, 0, Math.PI * 2); g.fill();
  // subtle cheek/edge light from the dashboard
  g.strokeStyle = 'rgba(150,130,255,0.35)'; g.lineWidth = 5;
  g.beginPath(); g.ellipse(236, 262, 70, 82, -0.1, Math.PI * 0.75, Math.PI * 1.15); g.stroke();
  xEyes(g, 216, 258, 1.6, -8);
  spikyHair(g, 244, 226, 1.6, 0.6);
  collar(g, 236, 362, 1.6);
  shade(g, W, H, 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.35)');
  return c;
}

// ---------- RIVAL bust, frontal (spiked helmet, red visor) ----------
export function drawRivalBust() {
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d');
  const metal = '#24262b', dark = '#121316';
  // shoulders / jacket
  g.fillStyle = '#1a1b1e';
  g.beginPath(); g.moveTo(0, 512); g.quadraticCurveTo(20, 350, 256, 330); g.quadraticCurveTo(492, 350, 512, 512); g.closePath(); g.fill();
  // pauldrons with spikes
  for (const s of [1, -1]) {
    g.save(); if (s < 0) { g.translate(W, 0); g.scale(-1, 1); }
    g.fillStyle = metal;
    g.beginPath(); g.ellipse(110, 392, 92, 56, -0.25, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a1016';
    for (let i = 0; i < 3; i++) {
      const x = 60 + i * 42, y = 352 - i * 8;
      g.beginPath(); g.moveTo(x - 14, y + 10); g.lineTo(x - 4, y - 46); g.lineTo(x + 14, y + 6); g.closePath(); g.fill();
    }
    g.restore();
  }
  // neck
  g.fillStyle = dark; g.fillRect(210, 280, 92, 70);
  // helmet crest spikes
  g.fillStyle = '#7a121b';
  for (let i = -3; i <= 3; i++) {
    const x = 256 + i * 22, h = 70 - Math.abs(i) * 12;
    g.beginPath(); g.moveTo(x - 12, 108); g.lineTo(x, 108 - h); g.lineTo(x + 12, 108); g.closePath(); g.fill();
  }
  // helmet dome
  g.fillStyle = metal;
  g.beginPath(); g.ellipse(256, 196, 104, 112, 0, 0, Math.PI * 2); g.fill();
  const hl = g.createRadialGradient(220, 140, 10, 256, 196, 120);
  hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl; g.beginPath(); g.ellipse(256, 196, 104, 112, 0, 0, Math.PI * 2); g.fill();
  // visor recess
  g.fillStyle = '#060607';
  g.beginPath(); g.moveTo(166, 176); g.lineTo(346, 176); g.lineTo(330, 214); g.lineTo(282, 222); g.lineTo(272, 290); g.lineTo(240, 290); g.lineTo(230, 222); g.lineTo(182, 214); g.closePath(); g.fill();
  // red T visor glow
  glowLine(g, [[180, 192], [332, 192]], RED, 9, 28);
  glowLine(g, [[256, 200], [256, 272]], RED, 7, 22);
  // respirator
  g.fillStyle = '#18191c';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(256 + s * 62, 268, 22, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#3a3c40'; g.lineWidth = 3;
  for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(256 + s * 62 - 12, 268 + k * 8); g.lineTo(256 + s * 62 + 12, 268 + k * 8); g.stroke(); }
  shade(g, W, H, 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.35)');
  return c;
}

// Edge mask of a silhouette, used as an additive rim-light layer.
export function makeRim(src, radius = 7) {
  const W = src.width, H = src.height;
  const out = canvas(W, H), o = out.getContext('2d');
  const tmp = canvas(W, H), t = tmp.getContext('2d');
  // solid white silhouette
  const sil = canvas(W, H), s = sil.getContext('2d');
  s.drawImage(src, 0, 0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#fff'; s.fillRect(0, 0, W, H);
  o.globalCompositeOperation = 'lighter';
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // stronger from the top (backlight from above/behind)
    const w = 0.35 + 0.65 * Math.max(0, -Math.sin(a));
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, W, H);
    t.drawImage(sil, 0, 0);
    t.globalCompositeOperation = 'destination-out';
    t.drawImage(sil, Math.cos(a) * radius, Math.sin(a) * radius);
    o.globalAlpha = w * 0.5;
    o.drawImage(tmp, 0, 0);
  }
  // soften
  const blur = canvas(W, H), b = blur.getContext('2d');
  b.filter = 'blur(2px)'; b.drawImage(out, 0, 0);
  return blur;
}

export async function loadCharacter(name, fallback) {
  try {
    const img = new Image();
    img.src = `/chars/${name}.png`;
    await img.decode();
    const c = canvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    return { canvas: c, custom: true };
  } catch (e) {
    return { canvas: fallback(), custom: false };
  }
}

// ---------- HERO free-fall: spread-eagle, seen from below/front ----------
export function drawHeroSky() {
  const W = 768, H = 768, c = canvas(W, H), g = c.getContext('2d');
  const jacket = '#1c1d23', pants = '#262a26';
  const mirror = (fn) => { fn(); g.save(); g.translate(W, 0); g.scale(-1, 1); fn(); g.restore(); };
  mirror(() => {
    // legs spread down-out, knees slightly bent
    limb(g, 352, 470, 272, 600, 78, 62, pants);
    limb(g, 272, 600, 214, 700, 62, 50, pants);
    g.fillStyle = '#0e0f10'; g.beginPath(); g.ellipse(204, 716, 34, 24, -0.6, 0, Math.PI * 2); g.fill();
    // arms spread up-out
    limb(g, 330, 300, 214, 236, 66, 56, jacket);
    limb(g, 214, 236, 108, 150, 56, 46, jacket);
    g.fillStyle = '#1a1c1f'; g.beginPath(); g.arc(96, 140, 30, 0, Math.PI * 2); g.fill();
  });
  // torso
  g.fillStyle = jacket;
  g.beginPath(); g.moveTo(290, 290); g.quadraticCurveTo(384, 262, 478, 290); g.lineTo(456, 480); g.lineTo(312, 480); g.closePath(); g.fill();
  g.fillStyle = '#121315'; g.fillRect(316, 462, 136, 20);
  glowLine(g, [[300, 330], [350, 360]], GREEN, 5, 16);
  // head with hair blown upward by the wind
  g.fillStyle = '#121318'; g.beginPath(); g.ellipse(384, 236, 46, 54, 0, 0, Math.PI * 2); g.fill();
  xEyes(g, 384, 236, 1.05, 0);
  spikyHair(g, 384, 206, 1.15, 0);
  collar(g, 384, 300, 1.0);
  shade(g, W, H, 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.25)');
  return c;
}

// ---------- RIVAL full body: armored trooper, spiked helmet, red T-visor, rifle ----------
export function drawRivalFull(variant = 0) {
  const W = 512, H = 1024, c = canvas(W, H), g = c.getContext('2d');
  const armor = ['#24262b', '#2a2526', '#1f2328'][variant % 3], suit = '#16171a';
  const mirror = (fn) => { fn(); g.save(); g.translate(W, 0); g.scale(-1, 1); fn(); g.restore(); };
  mirror(() => {
    limb(g, 222, 520, 214, 720, 84, 66, suit);
    limb(g, 214, 720, 210, 905, 66, 54, suit);
    g.fillStyle = armor; g.beginPath(); g.roundRect(186, 690, 56, 64, 12); g.fill(); // knee pad
    g.fillStyle = '#0b0b0c'; g.beginPath(); g.roundRect(176, 890, 66, 86, 14); g.fill();
    // pauldron with spikes
    g.fillStyle = armor; g.beginPath(); g.ellipse(170, 236, 64, 44, -0.35, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5a1016';
    for (let i = 0; i < 3; i++) { const x = 132 + i * 30, y = 214 - i * 6; g.beginPath(); g.moveTo(x - 10, y + 8); g.lineTo(x - 2, y - 36); g.lineTo(x + 10, y + 6); g.closePath(); g.fill(); }
  });
  // arms holding rifle across the body
  limb(g, 168, 250, 150, 380, 62, 54, suit);
  limb(g, 150, 380, 230, 440, 54, 46, suit);
  limb(g, 344, 250, 372, 370, 62, 54, suit);
  limb(g, 372, 370, 330, 330, 54, 46, suit);
  // torso armor
  g.fillStyle = armor;
  g.beginPath(); g.moveTo(170, 220); g.quadraticCurveTo(256, 190, 342, 220); g.lineTo(326, 380); g.lineTo(306, 530); g.lineTo(206, 530); g.lineTo(186, 380); g.closePath(); g.fill();
  g.strokeStyle = '#3a3c42'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(206, 300); g.lineTo(306, 300); g.moveTo(214, 380); g.lineTo(298, 380); g.stroke();
  glowLine(g, [[236, 340], [276, 340]], '#ff2a3a', 5, 16);
  // rifle
  g.save(); g.translate(256, 390); g.rotate(-0.55);
  g.fillStyle = '#0a0a0b'; g.fillRect(-150, -14, 300, 28); g.fillRect(40, -14, 30, 70); g.fillRect(-150, -20, 60, 40); g.fillRect(150, -6, 60, 12);
  g.restore();
  // helmet
  g.fillStyle = '#7a121b';
  for (let i = -2; i <= 2; i++) { const x = 256 + i * 16, h = 52 - Math.abs(i) * 12; g.beginPath(); g.moveTo(x - 9, 82); g.lineTo(x, 82 - h); g.lineTo(x + 9, 82); g.closePath(); g.fill(); }
  g.fillStyle = armor; g.beginPath(); g.ellipse(256, 134, 62, 68, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#060607';
  g.beginPath(); g.moveTo(204, 122); g.lineTo(308, 122); g.lineTo(298, 146); g.lineTo(270, 150); g.lineTo(264, 192); g.lineTo(248, 192); g.lineTo(242, 150); g.lineTo(214, 146); g.closePath(); g.fill();
  glowLine(g, [[212, 132], [300, 132]], '#ff2a3a', 7, 22);
  glowLine(g, [[256, 138], [256, 182]], '#ff2a3a', 5, 16);
  shade(g, W, H, 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)');
  return c;
}
