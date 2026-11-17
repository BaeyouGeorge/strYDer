// World for "THE DROP": storm sky, island, town lights, cargo plane, clouds, rain,
// lightning, parachute, supply crate, flare, watchtower.
import * as THREE from 'three';
import { rng } from './world.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------------------------------------------------------------- sky
export function makeStormSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uFlashDir: { value: V3(0, 0.3, -1).normalize() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      varying vec3 vDir; uniform float uTime, uFlash; uniform vec3 uFlashDir;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<6;i++){ s+=a*vn(p); p*=2.07; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.012,0.012,0.04), hor = vec3(0.07,0.045,0.13);
        vec3 col = mix(hor, zen, pow(clamp(abs(h),0.,1.), 0.5));
        if (h < 0.) col = mix(hor*0.7, vec3(0.008,0.008,0.016), clamp(-h*3.,0.,1.));
        // moon glow
        vec3 md = normalize(vec3(0.5,0.35,0.8));
        float m = max(dot(d,md),0.);
        col += vec3(0.25,0.28,0.55)*pow(m,30.)*0.6 + vec3(0.9,0.9,1.1)*smoothstep(0.9990,0.9994,m)*1.5;
        // storm clouds (both above and below the horizon for the aerial shots)
        vec2 uv = d.xz/(abs(h)+0.15)*1.1 + vec2(uTime*0.02, uTime*0.008);
        float c = fbm(uv*1.3);
        float cov = smoothstep(0.38, 0.8, c);
        float lit = pow(max(dot(d,uFlashDir),0.),3.);
        vec3 cc = vec3(0.035,0.03,0.06) + vec3(0.06,0.05,0.12)*pow(m,4.)*1.5;
        cc += uFlash*(0.25 + 1.6*lit)*vec3(0.75,0.7,1.2)*(0.4+c);
        col = mix(col, cc, cov*0.92);
        col += uFlash*lit*vec3(0.25,0.22,0.45);
        gl_FragColor = vec4(col,1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), mat);
  m.frustumCulled = false;
  return m;
}

// ---------------------------------------------------------------- terrain / island
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z);
  let h = 6 * Math.sin(x * 0.012) * Math.cos(z * 0.015) + 4 * Math.sin(x * 0.031 + 1.3) * Math.sin(z * 0.027 + 0.4)
    + 1.2 * Math.sin(x * 0.11) * Math.sin(z * 0.09) + 22 * Math.max(0, Math.sin(x * 0.004 + 2.0) * Math.cos(z * 0.005 + 0.3));
  h *= clamp((r - 40) / 140);                       // flat field around the crate
  h -= Math.max(0, (r - 900) / 25) ** 1.3;           // island shoreline
  return h;
}

export function makeIsland() {
  const grp = new THREE.Group();
  const geo = new THREE.PlaneGeometry(3200, 3200, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = [];
  const r = rng(4);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = terrainHeight(x, z);
    pos.setY(i, y);
    const n = r() * 0.15;
    const grass = [0.16 + n, 0.2 + n, 0.13 + n * 0.5], dirt = [0.22 + n, 0.19 + n, 0.16 + n];
    const k = clamp(Math.sin(x * 0.02) * Math.sin(z * 0.017) * 0.5 + 0.5 + (y < 0.5 ? 0.4 : 0));
    col.push(...grass.map((g, j) => g + (dirt[j] - g) * k));
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  ground.receiveShadow = true;
  grp.add(ground);
  // sea
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 0.15, metalness: 0.9 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -2; grp.add(sea);
  // trees
  const treeGeo = new THREE.ConeGeometry(2.4, 10, 7);
  const tm = new THREE.MeshStandardMaterial({ color: 0x0f1a12, roughness: 1 });
  const N = 2600, inst = new THREE.InstancedMesh(treeGeo, tm, N), o = new THREE.Object3D();
  let k = 0;
  while (k < N) {
    const x = (r() - 0.5) * 1800, z = (r() - 0.5) * 1800;
    const rr = Math.hypot(x, z);
    if (rr < 60 || rr > 880) continue;
    if (Math.sin(x * 0.01) * Math.cos(z * 0.013) < -0.1 && r() < 0.85) continue; // clearings
    const sc = 0.6 + r() * 0.9;
    o.position.set(x, terrainHeight(x, z) + 4.5 * sc, z); o.scale.set(sc, sc, sc); o.rotation.y = r() * 6;
    o.updateMatrix(); inst.setMatrixAt(k++, o.matrix);
  }
  inst.castShadow = true; grp.add(inst);
  // a few trees right at the edge of the field (visible in ground shots)
  for (const [x, z, s] of [[-24, -30, 1.1], [-30, -20, 0.9], [22, -34, 1.2], [30, -22, 1.0], [-18, -42, 1.3], [12, -46, 1.1], [34, 6, 1.2], [-34, 8, 1.0]]) {
    const t = new THREE.Mesh(treeGeo, tm); t.position.set(x, 4.5 * s, z); t.scale.setScalar(s); t.castShadow = true; grp.add(t);
  }
  // towns: houses + window lights
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.9 });
  const towns = [[-380, -420, 60], [420, -300, 45], [260, 380, 50], [-450, 260, 40], [80, -620, 35]];
  const lights = [];
  const houses = new THREE.InstancedMesh(houseGeo, houseMat, towns.length * 60);
  let hi = 0;
  for (const [tx, tz, rad] of towns) {
    for (let i = 0; i < 60; i++) {
      const a = r() * 6.28, d = Math.sqrt(r()) * rad;
      const x = tx + Math.cos(a) * d, z = tz + Math.sin(a) * d, w = 6 + r() * 8, h = 4 + r() * 7;
      o.position.set(x, terrainHeight(x, z) + h / 2, z); o.scale.set(w, h, 6 + r() * 6); o.rotation.y = r() * 3;
      o.updateMatrix(); houses.setMatrixAt(hi++, o.matrix);
      for (let j = 0; j < 3; j++) lights.push(x + (r() - 0.5) * w, terrainHeight(x, z) + 1 + r() * h, z + (r() - 0.5) * 6);
    }
  }
  grp.add(houses);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  const pts = new THREE.Points(lg, new THREE.PointsMaterial({ color: new THREE.Color(3.2, 2.0, 0.9), size: 5, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  grp.add(pts);
  return grp;
}

// ---------------------------------------------------------------- watchtower
export function makeTower() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x2b241f, roughness: 0.9 });
  const beam = (a, b, w) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, w, a.distanceTo(b)), wood);
    m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.castShadow = true; g.add(m);
  };
  const s = 1.8, top = 8;
  for (const [x, z] of [[-s, -s], [s, -s], [s, s], [-s, s]]) beam(V3(x * 1.3, 0, z * 1.3), V3(x, top, z), 0.3);
  for (const y of [2.5, 5.2]) {
    const k = 1.3 - 0.3 * y / top;
    beam(V3(-s * k, y, -s * k), V3(s * k, y, -s * k), 0.18); beam(V3(-s * k, y, s * k), V3(s * k, y, s * k), 0.18);
    beam(V3(-s * k, y, -s * k), V3(-s * k, y, s * k), 0.18); beam(V3(s * k, y, -s * k), V3(s * k, y, s * k), 0.18);
  }
  const plat = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 4.6), wood); plat.position.y = top; plat.castShadow = true; g.add(plat);
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]]) beam(V3(x, top, z), V3(x, top + 2.6, z), 0.18);
  beam(V3(-2.2, top + 1.1, -2.2), V3(2.2, top + 1.1, -2.2), 0.12); beam(V3(-2.2, top + 1.1, 2.2), V3(2.2, top + 1.1, 2.2), 0.12);
  beam(V3(-2.2, top + 1.1, -2.2), V3(-2.2, top + 1.1, 2.2), 0.12); beam(V3(2.2, top + 1.1, -2.2), V3(2.2, top + 1.1, 2.2), 0.12);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), wood); roof.rotation.y = Math.PI / 4; roof.position.y = top + 3.4; roof.castShadow = true; g.add(roof);
  return g;
}

// ---------------------------------------------------------------- crate
export function makeCrate() {
  const c = cnv(512, 512), g = c.getContext('2d');
  g.fillStyle = '#1b1c22'; g.fillRect(0, 0, 512, 512);
  const r = rng(9);
  for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  g.strokeStyle = '#0c0c10'; g.lineWidth = 14; g.strokeRect(10, 10, 492, 492);
  g.strokeStyle = '#2c2d36'; g.lineWidth = 6; g.strokeRect(40, 40, 432, 432);
  g.fillStyle = '#6a3dff'; g.fillRect(0, 230, 512, 22);
  g.fillStyle = '#3f7bff'; g.fillRect(0, 260, 512, 8);
  g.font = 'bold 90px Anton, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#d8d4ff';
  g.fillText('S', 256, 190);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.5, emissive: 0x2a1060, emissiveMap: tex, emissiveIntensity: 0.25 }));
  m.position.y = 0.55; m.castShadow = true; m.receiveShadow = true;
  const g2 = new THREE.Group(); g2.add(m);
  return g2;
}

// ---------------------------------------------------------------- cargo plane
export function makePlane() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x3b3e45, metalness: 0.6, roughness: 0.5, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.8, side: THREE.DoubleSide });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 26, 28, 1, true), skin);
  fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), skin);
  nose.rotation.x = -Math.PI / 2; nose.scale.set(1, 1.6, 1); nose.position.z = -13; g.add(nose);
  // interior ribs & floor
  for (let z = -11; z <= 12; z += 1.6) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.08, 6, 28), dark); rib.position.z = z; g.add(rib);
  }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 26), dark); floor.position.set(0, -1.7, 0); g.add(floor);
  // open ramp hanging down/back
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 5), dark);
  ramp.geometry.translate(0, 0, 2.5); ramp.position.set(0, -1.7, 13); ramp.rotation.x = 0.35; g.add(ramp);
  // upper tail boom + fins
  const boom = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 10), skin); boom.position.set(0, 1.9, 17); boom.rotation.x = -0.12; g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 5), skin); fin.position.set(0, 5.5, 20); fin.rotation.x = -0.3; g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 3.4), skin); stab.position.set(0, 3, 21); g.add(stab);
  // high wing + engines
  const wing = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 5.5), skin); wing.position.set(0, 2.7, -3); g.add(wing);
  g.userData.props = [];
  for (const x of [-15, -8, 8, 15]) {
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 4.5, 14), skin); e.rotation.x = Math.PI / 2; e.position.set(x, 1.9, -5.5); g.add(e);
    const p = new THREE.Mesh(new THREE.CircleGeometry(2.0, 24), new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    p.position.set(x, 1.9, -7.9); g.add(p);
  }
  // interior red lights
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.25) });
  for (let z = -9; z <= 11; z += 4) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.2), lampMat); l.position.set(0, 2.35, z); g.add(l); }
  const red = new THREE.PointLight(0xff2a20, 40, 18, 2); red.position.set(0, 1.8, 2); g.add(red);
  const red2 = new THREE.PointLight(0xff2a20, 30, 14, 2); red2.position.set(0, 1.8, 10); g.add(red2);
  g.userData.interior = [red, red2];
  // nav lights
  const nav = (x, y, z, c) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), new THREE.MeshBasicMaterial({ color: c })); s.position.set(x, y, z); g.add(s); return s; };
  g.userData.nav = [nav(-23, 2.7, -3, new THREE.Color(6, 0.2, 0.2)), nav(23, 2.7, -3, new THREE.Color(0.2, 6, 0.4)), nav(0, 9, 22, new THREE.Color(6, 6, 6))];
  return g;
}

// ---------------------------------------------------------------- clouds
export class CloudDeck {
  constructor(scene, T, opts) {
    const r = rng(opts.seed || 3);
    this.s = [];
    const add = (x, y, z, size) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, transparent: true, depthWrite: false, opacity: 0.55, fog: false }));
      sp.position.set(x, y, z); sp.scale.set(size, size * 0.6, 1); sp.material.rotation = r() * 6;
      scene.add(sp); this.s.push({ sp, b: 0.6 + r() * 0.5 });
    };
    for (let i = 0; i < opts.n; i++) add((r() - 0.5) * opts.area, opts.y0 + r() * (opts.y1 - opts.y0), (r() - 0.5) * opts.area + (opts.cz || 0), opts.size * (0.6 + r() * 0.8));
    for (const c of opts.clusters || []) for (let i = 0; i < c.n; i++) add(c.p.x + (r() - 0.5) * c.r * 2, c.p.y + (r() - 0.5) * c.h, c.p.z + (r() - 0.5) * c.r * 2, c.size * (0.6 + r() * 0.8));
  }
  update(flash, flashPos) {
    for (const { sp, b } of this.s) {
      const d = flashPos ? Math.max(0, 1 - sp.position.distanceTo(flashPos) / 900) : 0;
      const f = Math.min(flash, 1) * (0.06 + 0.7 * d * d);
      sp.material.color.setRGB((0.06 + 0.5 * f) * b, (0.05 + 0.45 * f) * b, (0.1 + 0.8 * f) * b);
    }
  }
}

// ---------------------------------------------------------------- rain
export class Rain {
  constructor(scene, n = 3000) {
    const r = rng(17);
    this.seed = Array.from({ length: n }, () => [r(), r(), r(), 0.8 + r() * 0.4]);
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 0.62, 0.85), transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }
  update(t, cam, on) {
    this.lines.visible = on;
    if (!on) return;
    const B = 34, Hh = 26, vy = 28, vx = 4;
    const c = cam.position;
    this.seed.forEach(([a, b, d, sp], i) => {
      const fall = (t * vy * sp + d * Hh) % Hh;
      const x = c.x + ((a * B + t * vx) % B) - B / 2, z = c.z + b * B - B / 2, y = c.y + Hh / 2 - fall;
      const L = 0.55 * sp;
      this.pos.set([x, y, z, x - vx / vy * L, y + L, z], i * 6);
    });
    this.geo.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- lightning
export function makeBolt(a, b, seed, opts = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const core = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.5, 9), transparent: true, depthWrite: false, fog: false });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.6, 2.2), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const width = opts.width || 1.0;
  const branch = (p0, p1, w, depth) => {
    const pts = [p0.clone()];
    const N = 14, len = p0.distanceTo(p1);
    for (let i = 1; i < N; i++) {
      const p = p0.clone().lerp(p1, i / N);
      p.add(V3((r() - 0.5), (r() - 0.5) * 0.4, (r() - 0.5)).multiplyScalar(len * 0.09));
      pts.push(p);
    }
    pts.push(p1.clone());
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1], L = s.distanceTo(e);
      for (const [mat, k] of [[core, 1], [glow, 3.5]]) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(w * k, w * k, L, 5, 1, true), mat);
        m.position.copy(s).add(e).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(V3(0, 1, 0), e.clone().sub(s).normalize());
        g.add(m);
      }
      if (depth < 2 && r() < 0.18) {
        const dir = e.clone().sub(s).normalize().add(V3((r() - 0.5) * 1.6, -0.2, (r() - 0.5) * 1.6)).normalize();
        branch(e, e.clone().addScaledVector(dir, len * (0.15 + r() * 0.2)), w * 0.55, depth + 1);
      }
    }
  };
  branch(a, b, width, 0);
  g.visible = false;
  g.userData.mats = [core, glow];
  return g;
}

// flicker envelope for a strike starting at t0
export function strikeEnv(t, t0, dur = 0.35) {
  const d = t - t0;
  if (d < 0 || d > dur + 0.25) return 0;
  const pulses = [[0, 0.05, 1], [0.08, 0.13, 0.7], [0.17, dur, 1]];
  let v = 0;
  for (const [a, b, k] of pulses) if (d >= a && d <= b) v = Math.max(v, k * (1 - (d - a) / (b - a + 0.15) * 0.4));
  if (d > dur) v = Math.max(v, 0.25 * (1 - (d - dur) / 0.25));
  return v;
}

// ---------------------------------------------------------------- parachute
export function makeParachute(wordmark) {
  const g = new THREE.Group();
  const c = cnv(1024, 256), x = c.getContext('2d');
  for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#3f4cff' : '#7a2cff'; x.fillRect(i * 1024 / 9, 0, 1024 / 9 + 1, 256); }
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = gr; x.fillRect(0, 0, 1024, 256);
  if (wordmark) { const w = 640, h = w * wordmark.height / wordmark.width; x.drawImage(wordmark, 512 - w / 2, 128 - h / 2, w, h); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // ram-air canopy: arc of a cylinder, axis along local z (chord)
  const geo = new THREE.CylinderGeometry(4.2, 4.2, 2.6, 36, 1, true, -0.85, 1.7);
  geo.rotateX(-Math.PI / 2);
  const canopy = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x24104a, emissiveIntensity: 0.6 }));
  // after rotateX the arc bulges toward +y; shift so the canopy edge sits ~6.2m above the jumper
  canopy.position.y = 2.6;
  g.add(canopy);
  // suspension lines from canopy edge to shoulders
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = -0.85 + 1.7 * i / 6;
    for (const z of [-1.2, 1.2]) pts.push(Math.sin(a) * 4.2, 2.6 + Math.cos(a) * 4.2 - 0.05, z, (i < 3 ? -0.25 : 0.25), 0, 0);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9a9ab0, transparent: true, opacity: 0.7 })));
  g.userData.canopy = canopy;
  return g;
}

// ---------------------------------------------------------------- flare (purple smoke + light)
export class Flare {
  constructor(scene, T, pos) {
    this.pos = pos.clone();
    const r = rng(23);
    this.p = [];
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.smoke, transparent: true, depthWrite: false }));
      scene.add(s); this.p.push({ s, L: 3 + r() * 2.5, o: r(), x: (r() - 0.5), z: (r() - 0.5), rot: r() * 6 });
    }
    this.core = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(2.2, 0.9, 3.2), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.core.position.copy(pos).add(V3(0, 0.15, 0)); scene.add(this.core);
    this.light = new THREE.PointLight(0xa040ff, 18, 40, 2); this.light.position.copy(pos).add(V3(0, 0.6, 0)); scene.add(this.light);
  }
  update(tau, on = true) {
    for (const p of this.p) {
      const ph = ((tau / p.L + p.o) % 1 + 1) % 1;
      p.s.visible = on;
      p.s.position.set(this.pos.x + p.x * 0.6 + ph * ph * 7, this.pos.y + 0.3 + ph * 9, this.pos.z + p.z * 0.6 - ph * 2);
      const sz = 0.6 + ph * 4.2;
      p.s.scale.set(sz, sz, 1);
      const k = Math.exp(-ph * 3);
      p.s.material.color.setRGB(0.22 + 0.9 * k, 0.07 + 0.2 * k, 0.4 + 1.4 * k);
      p.s.material.opacity = Math.sin(Math.PI * ph) * 0.42;
      p.s.material.rotation = p.rot + ph;
    }
    const fl = 0.8 + 0.2 * Math.sin(tau * 37) * Math.sin(tau * 13);
    this.core.visible = this.light.visible = on;
    this.core.scale.setScalar(0.45 * fl);
    this.light.intensity = 18 * fl;
  }
}
