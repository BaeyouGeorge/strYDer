// Original, procedurally drawn characters (2D canvas) used as billboards.
// Any of them can be replaced by dropping a PNG with transparency into /chars
// (hero_full.png, hero_bust.png, rival_bust.png).

const GREEN = '#39ff8f';
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

  // hood behind head
  g.fillStyle = hood;
  g.beginPath();
  g.moveTo(194, 214); g.quadraticCurveTo(184, 52, 256, 50); g.quadraticCurveTo(328, 52, 318, 214);
  g.closePath(); g.fill();
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

  // head + mask
  g.fillStyle = '#1b1d21';
  g.beginPath(); g.ellipse(256, 128, 44, 52, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0b0c0d';
  g.beginPath(); g.roundRect(218, 128, 76, 52, 20); g.fill();
  g.strokeStyle = '#2e3236'; g.lineWidth = 3;
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(232 + i * 12, 146); g.lineTo(232 + i * 12, 170); g.stroke(); }
  // visor eyes
  glowLine(g, [[222, 116], [246, 122]], GREEN, 7, 22);
  glowLine(g, [[266, 122], [290, 116]], GREEN, 7, 22);
  // hood rim around face
  g.strokeStyle = '#33373d'; g.lineWidth = 8;
  g.beginPath(); g.ellipse(256, 122, 52, 62, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();

  shade(g, W, H, 'rgba(255,255,255,0)', 'rgba(0,0,0,0.35)');
  return c;
}

// ---------- HERO bust, 3/4 view facing screen-left (driver shot) ----------
export function drawHeroBust() {
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d');
  const hood = '#2a2d33';
  // shoulders
  g.fillStyle = hood;
  g.beginPath();
  g.moveTo(10, 512); g.quadraticCurveTo(40, 335, 220, 322); g.quadraticCurveTo(440, 310, 500, 512);
  g.closePath(); g.fill();
  // green collar stripe
  glowLine(g, [[150, 352], [240, 338], [330, 340]], GREEN, 6, 16);
  // hood
  g.fillStyle = '#25282d';
  g.beginPath();
  g.moveTo(140, 336); g.quadraticCurveTo(102, 150, 248, 92); g.quadraticCurveTo(392, 72, 384, 240);
  g.quadraticCurveTo(378, 330, 336, 352); g.closePath(); g.fill();
  // face opening (in shadow)
  g.fillStyle = '#0a0b0d';
  g.beginPath();
  g.moveTo(160, 318); g.quadraticCurveTo(140, 168, 238, 136); g.quadraticCurveTo(290, 190, 280, 318);
  g.closePath(); g.fill();
  // mask lower half
  g.fillStyle = '#121416';
  g.beginPath(); g.moveTo(158, 238); g.quadraticCurveTo(220, 226, 280, 236); g.lineTo(276, 312); g.quadraticCurveTo(220, 326, 166, 312); g.closePath(); g.fill();
  g.strokeStyle = '#30353a'; g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(176 + i * 16, 254); g.lineTo(178 + i * 16, 300); g.stroke(); }
  // eyes (glowing slits)
  glowLine(g, [[170, 206], [204, 214]], GREEN, 8, 24);
  glowLine(g, [[226, 214], [262, 204]], GREEN, 8, 24);
  // hood edge highlight
  g.strokeStyle = 'rgba(160,170,180,0.25)'; g.lineWidth = 5;
  g.beginPath(); g.moveTo(150, 320); g.quadraticCurveTo(128, 160, 240, 120); g.stroke();
  shade(g, W, H, 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.4)');
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
