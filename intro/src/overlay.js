// 2D overlay: hook titles, story beats and a killfeed.
import { TEXT, TEAM } from './config.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeOutBack = (x) => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const GREEN = '#39ff8f';

function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

// Lower-third style block: green bar + lines sliding up from a mask
function lowerThird(g, t, t0, t1, lines, x, y, S) {
  if (t < t0 || t > t1) return;
  const outK = clamp((t1 - t) / 0.3);
  const barH = lines.reduce((a, l) => a + l.size * S * 1.08, 0);
  g.save();
  g.globalAlpha = outK;
  // bar
  const bk = easeOut((t - t0) / 0.3);
  g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 20 * S;
  g.fillRect(x - 28 * S, y - barH * bk, 9 * S, barH * bk);
  g.shadowBlur = 0;
  let yy = y - barH;
  for (const l of lines) {
    const h = l.size * S * 1.08;
    const k = easeOut((t - t0 - (l.delay || 0)) / 0.4);
    g.save();
    g.beginPath(); g.rect(x - 4 * S, yy, 2200 * S, h + 4 * S); g.clip();
    g.font = `${l.size * S}px ${l.font || 'Anton'}`;
    g.letterSpacing = `${(l.track || 2) * S}px`;
    g.textBaseline = 'top';
    g.fillStyle = l.color || '#fff';
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 16 * S; g.shadowOffsetY = 3 * S;
    g.fillText(l.text, x, yy + (1 - k) * h * 1.05 + 2 * S);
    g.restore();
    yy += h;
  }
  g.restore();
}

function centerSlow(g, t, t0, t1, text, W, H, S) {
  if (t < t0 || t > t1) return;
  const u = (t - t0) / (t1 - t0);
  const a = clamp((t - t0) / 0.35) * clamp((t1 - t) / 0.3);
  g.save();
  g.globalAlpha = a;
  g.font = `${78 * S}px Anton`;
  g.letterSpacing = `${(6 + u * 14) * S}px`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 24 * S;
  g.fillStyle = '#fff';
  g.fillText(text, W / 2, H * 0.80);
  g.restore();
}

function bigPunch(g, t, t0, t1, text, W, H, S) {
  if (t < t0 || t > t1) return;
  const dt = t - t0;
  const sc = 1 + 0.5 * (1 - easeOutBack(dt / 0.22)) ;
  const a = clamp(dt / 0.06) * clamp((t1 - t) / 0.25);
  const shake = Math.max(0, 1 - dt / 0.8) * 14 * S;
  const sx = (hash(Math.floor(t * 30)) - 0.5) * shake, sy = (hash(Math.floor(t * 30) + 7) - 0.5) * shake;
  g.save();
  g.translate(W / 2 + sx, H * 0.8 + sy);
  g.scale(sc, sc);
  g.font = `${165 * S}px Anton`;
  g.letterSpacing = `${8 * S}px`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // chromatic ghosts
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a * 0.55;
  g.fillStyle = '#ff3b1f'; g.fillText(text, -7 * S, 0);
  g.fillStyle = '#1fd0ff'; g.fillText(text, 7 * S, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = a;
  const gr = g.createLinearGradient(0, -100 * S, 0, 100 * S);
  gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.55, '#ffd27a'); gr.addColorStop(1, '#ff7a1a');
  g.shadowColor = 'rgba(255,120,30,0.9)'; g.shadowBlur = 40 * S;
  g.fillStyle = gr; g.fillText(text, 0, 0);
  g.restore();
}

function grenadeIcon(g, x, y, r) {
  g.save();
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(x, y + r * 0.15, r * 0.7, r * 0.85, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(x - r * 0.3, y - r * 0.95, r * 0.6, r * 0.35);
  g.strokeStyle = '#fff'; g.lineWidth = r * 0.18;
  g.beginPath(); g.moveTo(x + r * 0.3, y - r * 0.8); g.quadraticCurveTo(x + r * 0.9, y - r * 0.6, x + r * 0.75, y + r * 0.2); g.stroke();
  g.restore();
}

function killfeed(g, t, t0, t1, entries, W, H, S) {
  if (t < t0 || t > t1) return;
  const fade = clamp((t1 - t) / 0.3);
  let y = 60 * S;
  entries.forEach((e, i) => {
    const ti = t0 + i * 0.16;
    if (t < ti) return;
    const k = easeOut((t - ti) / 0.25);
    g.save();
    g.globalAlpha = fade * k;
    g.font = `${30 * S}px Rajdhani`;
    g.letterSpacing = `${1 * S}px`;
    const wA = g.measureText(e[0]).width, wB = g.measureText(e[1]).width;
    const w = wA + wB + 90 * S, h = 46 * S;
    const x = W - 60 * S - w + (1 - k) * 80 * S;
    g.fillStyle = 'rgba(8,10,12,0.62)';
    g.beginPath(); g.roundRect(x, y, w, h, 6 * S); g.fill();
    g.fillStyle = GREEN; g.fillRect(x, y, 5 * S, h);
    g.textBaseline = 'middle';
    g.fillStyle = GREEN; g.fillText(e[0], x + 20 * S, y + h / 2 + 1 * S);
    grenadeIcon(g, x + 20 * S + wA + 26 * S, y + h / 2, 12 * S);
    g.fillStyle = '#ff5a5a'; g.fillText(e[1], x + 20 * S + wA + 54 * S, y + h / 2 + 1 * S);
    g.restore();
    y += h + 10 * S;
  });
  // "SQUAD WIPED" tag
  const tw = t0 + entries.length * 0.16 + 0.15;
  if (t > tw) {
    const k = easeOutBack((t - tw) / 0.3);
    g.save();
    g.globalAlpha = fade;
    g.translate(W - 60 * S, y + 30 * S);
    g.scale(k, k);
    g.font = `${44 * S}px Anton`; g.letterSpacing = `${4 * S}px`;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    g.shadowColor = GREEN; g.shadowBlur = 24 * S;
    g.fillStyle = GREEN; g.fillText(TEXT.wiped, 0, 0);
    g.restore();
  }
}

export function drawOverlay(g, t, W, H) {
  const S = H / 1080;
  lowerThird(g, t, 0.35, 2.3, [
    { text: TEXT.hook1, size: 120 },
    { text: TEXT.hook2, size: 58, delay: 0.45, color: '#e8e8e8' },
  ], 130 * S, H - 120 * S, S);
  lowerThird(g, t, 2.55, 3.95, [
    { text: TEXT.beat2, size: 84 },
  ], 130 * S, H - 120 * S, S);
  centerSlow(g, t, 10.0, 11.75, TEXT.beat3, W, H, S);
  bigPunch(g, t, 12.85, 14.95, TEXT.punch, W, H, S);
  killfeed(g, t, 13.35, 15.0, TEXT.kills, W, H, S);
}
