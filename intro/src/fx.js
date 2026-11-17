// Deterministic particle effects: every particle state is a pure function of time.
import * as THREE from 'three';
import { rng } from './world.js';

const fract = (x) => x - Math.floor(x);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };

function sprite(tex, additive) {
  const m = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const s = new THREE.Sprite(m);
  s.visible = false;
  return s;
}

export class FireEmitter {
  constructor(scene, T, pos, opts = {}) {
    this.pos = pos.clone();
    this.scale = opts.scale ?? 1;
    this.plume = opts.plume ?? 14;
    this.seed = opts.seed ?? 1;
    const r = rng(this.seed * 999 + 3);
    this.fire = []; this.smoke = [];
    for (let i = 0; i < (opts.nFire ?? 16); i++) {
      const s = sprite(T.fire, true); scene.add(s);
      this.fire.push({ s, L: 0.55 + r() * 0.5, o: r(), x: (r() - 0.5) * 1.8, z: (r() - 0.5) * 1.6, sz: 0.7 + r() * 0.7, rot: r() * 6 });
    }
    for (let i = 0; i < (opts.nSmoke ?? 10); i++) {
      const s = sprite(T.smoke, false); scene.add(s);
      this.smoke.push({ s, L: 3.5 + r() * 2.5, o: r(), x: (r() - 0.5) * 1.5, z: (r() - 0.5) * 1.5, sz: 0.8 + r() * 0.6, rot: r() * 6 });
    }
  }
  update(tau, intensity = 1) {
    const S = this.scale;
    for (const p of this.fire) {
      const ph = fract(tau / p.L + p.o);
      const sp = p.s;
      sp.visible = intensity > 0.01;
      sp.position.set(this.pos.x + p.x * S * (1 - ph * 0.5) + Math.sin(tau * 3 + p.o * 9) * 0.15 * S,
        this.pos.y + ph * 2.6 * S, this.pos.z + p.z * S * (1 - ph * 0.5));
      const size = S * p.sz * (1.5 - ph * 1.0) * 1.6;
      sp.scale.set(size, size * 1.25, 1);
      const k = 1 - ph;
      const b = 1.1 + 1.8 * k;
      sp.material.color.setRGB(b, (0.3 + 0.42 * k) * b, (0.06 + 0.18 * k * k) * b);
      sp.material.opacity = smooth(0, 0.12, ph) * (1 - ph) * 0.9 * intensity;
      sp.material.rotation = p.rot + ph * 1.5;
    }
    for (const p of this.smoke) {
      const ph = fract(tau / p.L + p.o);
      const sp = p.s;
      sp.visible = intensity > 0.01;
      sp.position.set(this.pos.x + p.x * S + ph * ph * this.plume * 0.35, this.pos.y + 1.6 * S + ph * this.plume, this.pos.z + p.z * S + ph * 1.5);
      const size = S * p.sz * (1.8 + ph * this.plume * 0.45);
      sp.scale.set(size, size, 1);
      const v = 0.07 + 0.05 * ph;
      sp.material.color.setRGB(v * 1.15, v, v * 0.92);
      sp.material.opacity = Math.sin(Math.PI * ph) * 0.55 * intensity;
      sp.material.rotation = p.rot + ph;
    }
  }
}

// Big explosion: fireball + smoke + sparks + debris + shockwave
export class Explosion {
  constructor(scene, T, opts = {}) {
    this.n = opts.n ?? 90;
    this.scale = opts.scale ?? 1;
    this.pal = Object.assign({ hot: [3.2, 1.5, 0.45], ember: [1.1, 0.32, 0.07], soot: [0.06, 0.045, 0.04], core: [1, 0.35, 0.08], spark: [4, 2.0, 0.7], light: 0xff9a50, smoke: [1.9, 1.15, 0.85] }, opts.palette || {});
    const r = rng(opts.seed ?? 42);
    this.fire = []; this.smoke = []; this.sparks = []; this.debris = [];
    const dir = () => { const a = r() * Math.PI * 2, u = 0.15 + r() * 0.85; const s = Math.sqrt(1 - u * u); return new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s); };
    for (let i = 0; i < this.n; i++) {
      const core = i < this.n * 0.25;
      const s = sprite(core ? T.fire : T.smoke, core); scene.add(s);
      this.fire.push({ s, core, d: dir(), R: (core ? 1 : 2) + r() * (core ? 3 : 5), sz: (core ? 2 : 2.5) + r() * 3, rot: r() * 6, k: 2 + r() * 3, hv: r() });
    }
    for (let i = 0; i < this.n * 0.6; i++) { const s = sprite(T.smoke, false); scene.add(s); this.smoke.push({ s, d: dir(), R: 3 + r() * 6, sz: 4 + r() * 4, rot: r() * 6, t0: 0.25 + r() * 0.5 }); }
    for (let i = 0; i < this.n; i++) { const s = sprite(T.glow, true); scene.add(s); const d = dir(); this.sparks.push({ s, v: d.multiplyScalar(10 + r() * 22), life: 0.6 + r() * 1.2 }); }
    const dm = new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 0.8 });
    for (let i = 0; i < (opts.nDebris ?? 26); i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.2 + r() * 0.6, 0.06 + r() * 0.15, 0.2 + r() * 0.5), dm);
      m.visible = false; m.castShadow = true; scene.add(m);
      const d = dir(); this.debris.push({ m, v: d.multiplyScalar(8 + r() * 16), w: new THREE.Vector3(r() * 10, r() * 10, r() * 10) });
    }
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: opts.ringColor ?? 0xffa060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
    this.light = new THREE.PointLight(this.pal.light, 0, 0, 2); scene.add(this.light);
  }
  update(t, tE, P) {
    const dt = t - tE, on = dt >= 0, S = this.scale;
    this.light.visible = on;
    this.light.position.copy(P).add(new THREE.Vector3(0, 2, 0));
    this.light.intensity = on ? (this.pal.lightScale ?? 1) * 2500 * S * S * (Math.exp(-dt * 2.2) * 1.0 + 0.15 * Math.exp(-dt * 0.5)) * (0.85 + 0.15 * Math.sin(dt * 40)) : 0;
    for (const p of this.fire) {
      const sp = p.s; sp.visible = on && dt < 3.5;
      if (!sp.visible) continue;
      const g = 1 - Math.exp(-dt * p.k);
      sp.position.copy(P).addScaledVector(p.d, p.R * g * S).add(new THREE.Vector3(0, dt * 2.5 * S, 0));
      const size = p.sz * S * (0.35 + 1.3 * g) * (1 + dt * 0.25);
      sp.scale.set(size, size, 1);
      if (p.core) {
        const heat = Math.exp(-dt * 2.2);
        const b = 0.6 + 2.6 * heat;
        const cc = this.pal.core; sp.material.color.setRGB(b * cc[0], b * (cc[1] + 0.5 * heat), b * (cc[2] + 0.4 * heat * heat));
        sp.material.opacity = 0.7 * clamp(1.2 - dt * 0.9) * (dt < 0.03 ? dt / 0.03 : 1);
      } else {
        // opaque billowing fire: white-hot -> ember -> soot; tops cool first
        sp.position.y += dt * 2.2 * S * p.d.y;
        const heat = clamp(Math.exp(-dt * (0.8 + p.hv * 1.5)) * (1.35 - p.hv * 0.55) - p.d.y * 0.35 * Math.min(dt, 1.2));
        const fl = 0.75 + 0.5 * Math.sin(p.rot * 7.3) ** 2;
        const hot = this.pal.hot.map(v => v * fl), ember = this.pal.ember, soot = this.pal.soot;
        let c;
        if (heat > 0.45) { const k = (heat - 0.45) / 0.55; c = ember.map((e, j) => e + (hot[j] - e) * k); }
        else { const k = heat / 0.45; c = soot.map((s, j) => s + (ember[j] - s) * k * k); }
        sp.material.color.setRGB(c[0], c[1], c[2]);
        sp.material.opacity = 0.95 * clamp(1.9 - dt * 0.6) * (dt < 0.03 ? dt / 0.03 : 1);
      }
      sp.material.rotation = p.rot + dt * 0.6;
    }
    for (const p of this.smoke) {
      const sp = p.s, a = dt - p.t0; sp.visible = on && a > 0;
      if (!sp.visible) continue;
      const g = 1 - Math.exp(-a * 1.4);
      sp.position.copy(P).addScaledVector(p.d, p.R * g * S).add(new THREE.Vector3(0, (2 + a * 3.5) * S, 0));
      const size = p.sz * S * (1 + a * 0.9);
      sp.scale.set(size, size, 1);
      const v = 0.035 + 0.12 * Math.exp(-a * 2.5);
      const sm = this.pal.smoke; sp.material.color.setRGB(v * sm[0], v * sm[1], v * sm[2]);
      sp.material.opacity = 0.6 * smooth(0, 0.25, a) * clamp(1.2 - a * 0.35);
      sp.material.rotation = p.rot + a * 0.3;
    }
    for (const p of this.sparks) {
      const sp = p.s; sp.visible = on && dt < p.life;
      if (!sp.visible) continue;
      sp.position.set(P.x + p.v.x * dt * S, P.y + (p.v.y * dt - 4.9 * dt * dt) * S, P.z + p.v.z * dt * S);
      const k = 1 - dt / p.life;
      const size = 0.35 * S * (0.5 + k);
      sp.scale.set(size, size, 1);
      sp.material.color.setRGB(...this.pal.spark);
      sp.material.opacity = k;
    }
    for (const p of this.debris) {
      const m = p.m; m.visible = on && dt < 4;
      if (!m.visible) continue;
      let y = P.y + (p.v.y * dt - 4.9 * dt * dt) * S;
      m.position.set(P.x + p.v.x * dt * S, Math.max(0.05, y), P.z + p.v.z * dt * S);
      m.rotation.set(p.w.x * dt, p.w.y * dt, p.w.z * dt);
    }
    this.ring.visible = on && dt < 0.7;
    if (this.ring.visible) {
      const rr = 1 + dt * 45 * S;
      this.ring.scale.set(rr, rr, rr);
      this.ring.position.set(P.x, 0.15, P.z);
      this.ring.material.opacity = (1 - dt / 0.7) * 0.8;
    }
  }
}

// Tire smoke trail: births from a function giving wheel position at time tb
export class TireSmoke {
  constructor(scene, T, n = 60) {
    const r = rng(55);
    this.p = [];
    for (let i = 0; i < n; i++) { const s = sprite(T.smoke, false); scene.add(s); this.p.push({ s, j: new THREE.Vector3(r() - 0.5, r(), r() - 0.5), rot: r() * 6, side: i % 2 }); }
  }
  update(t, t0, t1, wheelPos, strength) {
    const n = this.p.length;
    this.p.forEach((p, i) => {
      const tb = t0 + (i / n) * (t1 - t0);
      const age = t - tb;
      const sp = p.s;
      sp.visible = age > 0 && age < 3.5;
      if (!sp.visible) return;
      const base = wheelPos(tb, p.side);
      sp.position.copy(base).add(new THREE.Vector3(p.j.x * age * 1.6, 0.3 + age * (0.5 + p.j.y * 0.6), p.j.z * age * 1.6));
      const size = 0.8 + age * 2.6;
      sp.scale.set(size, size, 1);
      sp.material.color.setRGB(0.75, 0.72, 0.7);
      sp.material.opacity = 0.42 * strength(tb) * Math.exp(-age * 0.7) * smooth(0, 0.15, age);
      sp.material.rotation = p.rot + age * 0.4;
    });
  }
}

// Bullet impact sparks on the road
export class Impacts {
  constructor(scene, T, hits) {
    const r = rng(12);
    this.hits = hits.map(h => ({ ...h, sp: Array.from({ length: 10 }, () => { const s = sprite(T.glow, true); scene.add(s); return { s, v: new THREE.Vector3((r() - 0.5) * 6, 2 + r() * 5, (r() - 0.5) * 6) }; }) }));
  }
  update(t) {
    for (const h of this.hits) {
      const dt = t - h.t;
      for (const p of h.sp) {
        p.s.visible = dt > 0 && dt < 0.35;
        if (!p.s.visible) continue;
        p.s.position.set(h.p.x + p.v.x * dt, h.p.y + p.v.y * dt - 9 * dt * dt, h.p.z + p.v.z * dt);
        const k = 1 - dt / 0.35;
        p.s.scale.set(0.18 * k + 0.05, 0.18 * k + 0.05, 1);
        p.s.material.color.setRGB(6, 4, 2);
        p.s.material.opacity = k;
      }
    }
  }
}
