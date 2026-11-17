// World building: sky, water, bridge, land, cars, wrecks, grenade.
import * as THREE from 'three';
import { TEAM } from './config.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SUN_DIR = new THREE.Vector3(-0.78, 0.11, -0.6).normalize();

// ---------------- textures ----------------
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function makeTextures() {
  const T = {};
  // fire puff
  {
    const c = cnv(128, 128), g = c.getContext('2d');
    const r = rng(3);
    for (let i = 0; i < 26; i++) {
      const x = 64 + (r() - 0.5) * 40, y = 70 + (r() - 0.5) * 44, rad = 14 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    T.fire = new THREE.CanvasTexture(c); T.fire.colorSpace = THREE.SRGBColorSpace;
  }
  // smoke
  {
    const c = cnv(128, 128), g = c.getContext('2d');
    const r = rng(9);
    for (let i = 0; i < 40; i++) {
      const x = 64 + (r() - 0.5) * 60, y = 64 + (r() - 0.5) * 60, rad = 10 + r() * 30;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const v = 180 + r() * 75 | 0;
      gr.addColorStop(0, `rgba(${v},${v},${v},0.35)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    T.smoke = new THREE.CanvasTexture(c); T.smoke.colorSpace = THREE.SRGBColorSpace;
  }
  // spark / glow
  {
    const c = cnv(64, 64), g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    T.glow = new THREE.CanvasTexture(c);
  }
  // anamorphic streak
  {
    const c = cnv(512, 64), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 512, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    const v = g.createLinearGradient(0, 0, 0, 64);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillRect(0, 26, 512, 12);
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = v; g.fillRect(0, 0, 512, 64);
    T.streak = new THREE.CanvasTexture(c);
  }
  // light rays burst
  {
    const c = cnv(512, 512), g = c.getContext('2d');
    const r = rng(21);
    g.translate(256, 256);
    for (let i = 0; i < 48; i++) {
      const a = r() * Math.PI * 2, w = 0.01 + r() * 0.035, L = 120 + r() * 136;
      const gr = g.createLinearGradient(0, 0, Math.cos(a) * L, Math.sin(a) * L);
      gr.addColorStop(0, `rgba(255,255,255,${0.25 + r() * 0.5})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, L, a - w, a + w); g.closePath(); g.fill();
    }
    T.rays = new THREE.CanvasTexture(c);
  }
  // road
  {
    const W = 512, H = 2048, c = cnv(W, H), g = c.getContext('2d');
    const img = g.createImageData(W, H), d = img.data, r = rng(5);
    for (let i = 0; i < W * H; i++) {
      const n = 52 + (r() * 22) | 0;
      d[i * 4] = n; d[i * 4 + 1] = n; d[i * 4 + 2] = n + 3; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // patches & stains
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? 20 : 90},${r() < 0.5 ? 20 : 88},${r() < 0.5 ? 22 : 85},${0.08 + r() * 0.12})`;
      g.beginPath(); g.ellipse(r() * W, r() * H, 20 + r() * 80, 30 + r() * 160, r() * 3, 0, Math.PI * 2); g.fill();
    }
    // tire marks
    g.strokeStyle = 'rgba(15,15,15,0.18)';
    for (let i = 0; i < 10; i++) { g.lineWidth = 6 + r() * 6; const x = 80 + r() * 350; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 30, H / 3, x - 30, H * 2 / 3, x + (r() - .5) * 60, H); g.stroke(); }
    // cracks
    g.strokeStyle = 'rgba(10,10,10,0.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) { let x = r() * W, y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - .5) * 30; y += (r() - .2) * 30; g.lineTo(x, y); } g.stroke(); }
    // lane markings. width 16m -> 32px/m; length 64m
    const px = (m) => (m + 8) * 32;
    g.fillStyle = 'rgba(230,230,220,0.85)';
    g.fillRect(px(-6.9), 0, 6, H); g.fillRect(px(6.9) - 6, 0, 6, H);
    for (const xm of [-3.45, 3.45]) for (let z = 0; z < 64; z += 9) g.fillRect(px(xm) - 3, z * 32, 6, 3.5 * 32);
    g.fillStyle = 'rgba(225,180,60,0.8)';
    g.fillRect(px(0) - 8, 0, 5, H); g.fillRect(px(0) + 3, 0, 5, H);
    T.road = new THREE.CanvasTexture(c);
    T.road.colorSpace = THREE.SRGBColorSpace;
    T.road.wrapS = T.road.wrapT = THREE.RepeatWrapping;
    T.road.anisotropy = 8;
  }
  // water normal map (tileable)
  {
    const N = 256, c = cnv(N, N), g = c.getContext('2d');
    const img = g.createImageData(N, N), d = img.data, r = rng(11);
    const waves = [];
    for (let i = 0; i < 18; i++) waves.push([((r() * 9) | 0) - 4, ((r() * 9) | 0) - 4, r() * 6.28, 0.3 + r()]);
    const h = (x, y) => waves.reduce((a, w) => a + w[3] * Math.sin(2 * Math.PI * (w[0] * x + w[1] * y) / N + w[2]) / (1 + Math.hypot(w[0], w[1])), 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
      const v = new THREE.Vector3(-dx * 4, -dy * 4, 1).normalize();
      const i = (y * N + x) * 4;
      d[i] = (v.x * 0.5 + 0.5) * 255; d[i + 1] = (v.y * 0.5 + 0.5) * 255; d[i + 2] = (v.z * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    T.water = new THREE.CanvasTexture(c);
    T.water.wrapS = T.water.wrapT = THREE.RepeatWrapping;
  }
  // grenade body print
  {
    const W = 1024, H = 512, c = cnv(W, H), g = c.getContext('2d');
    g.fillStyle = '#3f5a1f'; g.fillRect(0, 0, W, H);
    const r = rng(8);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * W, r() * H, 3, 3); }
    // segmentation grooves
    g.strokeStyle = 'rgba(15,25,5,0.65)'; g.lineWidth = 7;
    for (let i = 0; i < 12; i++) { const x = (i / 12) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let j = 1; j < 6; j++) { const y = (j / 6) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // logo centered at u=0.5
    g.save();
    g.translate(W / 2, H * 0.48);
    g.rotate(-0.12);
    g.font = '120px Anton'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '4px';
    g.lineWidth = 12; g.strokeStyle = '#13200a'; g.strokeText(TEAM.name, 0, 0);
    g.fillStyle = '#e9f04a'; g.fillText(TEAM.name, 0, 0);
    g.font = '60px Anton'; g.letterSpacing = '10px';
    g.lineWidth = 8; g.strokeText(TEAM.sub, 0, 92);
    g.fillStyle = '#e9f04a'; g.fillText(TEAM.sub, 0, 92);
    g.restore();
    T.grenade = new THREE.CanvasTexture(c);
    T.grenade.colorSpace = THREE.SRGBColorSpace;
    T.grenade.anisotropy = 8;
  }
  return T;
}

// ---------------- sky ----------------
export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR.clone() }, uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 sunDir; uniform float uTime;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=0.5, s=0.; for(int i=0;i<5;i++){ s+=a*vn(p); p*=2.03; a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.06,0.11,0.26), hor = vec3(0.95,0.48,0.26), gnd = vec3(0.16,0.12,0.11);
        vec3 col = mix(hor, zen, pow(clamp(h,0.,1.), 0.42));
        if (h < 0.) col = mix(hor*0.75, gnd, clamp(-h*5.,0.,1.));
        float s = max(dot(d, sunDir), 0.);
        col += vec3(1.0,0.5,0.2)*pow(s,10.)*0.45 + vec3(1.0,0.72,0.4)*pow(s,120.)*1.2;
        // clouds
        if (h > 0.0) {
          vec2 uv = d.xz/(h+0.12)*1.3 + vec2(uTime*0.01, 0.);
          float c = fbm(uv*1.6);
          c = smoothstep(0.52, 0.85, c) * smoothstep(0.0, 0.18, h);
          vec3 cc = mix(vec3(0.55,0.32,0.30), vec3(1.25,0.8,0.55), pow(s,3.)*0.8+0.25);
          col = mix(col, cc, c*0.85);
        }
        col += vec3(1.0,0.85,0.6)*smoothstep(0.9994,0.9997,s)*12.;
        gl_FragColor = vec4(col,1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
  m.frustumCulled = false;
  return m;
}

// ---------------- bridge ----------------
export function makeBridge(T) {
  const grp = new THREE.Group();
  const L = 420, half = L / 2;
  // deck
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x55524e, roughness: 0.9 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 1.4, L), deckMat);
  deck.position.y = -0.72; deck.receiveShadow = true; grp.add(deck);
  const roadTex = T.road.clone(); roadTex.needsUpdate = true; roadTex.repeat.set(1, L / 64);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(16, L), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.82, metalness: 0.0 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.005; road.receiveShadow = true; grp.add(road);
  // curbs / sidewalks
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.9 });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, L), curbMat);
    c.position.set(s * 8.1, 0.12, 0); c.receiveShadow = true; c.castShadow = true; grp.add(c);
  }
  // truss (instanced beams)
  const beams = [];
  const add = (a, b, w, h) => beams.push([a, b, w, h]);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const P = 9, H = 10.5, X = 8.4;
  for (let z = -half; z < half; z += P) {
    const z2 = z + P;
    for (const s of [-1, 1]) {
      const x = s * X;
      add(V(x, 0.4, z), V(x, 0.4, z2), 0.7, 0.9);         // bottom chord
      add(V(x, H, z), V(x, H, z2), 0.8, 0.8);            // top chord
      add(V(x, 0.4, z), V(x, H, z), 0.5, 0.7);           // vertical
      const up = ((z + half) / P) % 2 === 0;
      add(V(x, up ? 0.4 : H, z), V(x, up ? H : 0.4, z2), 0.45, 0.6); // diagonal
      add(V(x, 1.1, z), V(x, 1.1, z2), 0.12, 0.25);      // railing
    }
    add(V(-X, H, z), V(X, H, z), 0.5, 0.5);              // top cross beam
    add(V(-X, H, z), V(X, H, z2), 0.25, 0.3);            // top X bracing
    add(V(X, H, z), V(-X, H, z2), 0.25, 0.3);
    add(V(-X, H - 1.6, z), V(-X + 1.8, H, z), 0.3, 0.3); // portal knee braces
    add(V(X, H - 1.6, z), V(X - 1.8, H, z), 0.3, 0.3);
  }
  const steel = new THREE.MeshStandardMaterial({ color: 0x5c6166, metalness: 0.55, roughness: 0.55 });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), steel, beams.length);
  const o = new THREE.Object3D();
  beams.forEach(([a, b, w, h], i) => {
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.lookAt(b);
    o.scale.set(w, h, a.distanceTo(b));
    o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
  });
  inst.castShadow = true; inst.receiveShadow = true;
  grp.add(inst);
  // piers
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.95 });
  for (let z = -half + 30; z < half; z += 60) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 3.5), pierMat);
    p.position.set(0, -12.4, z); grp.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(19, 1.4, 4.5), pierMat);
    cap.position.set(0, -2, z); grp.add(cap);
  }
  // concrete barriers & debris
  const r = rng(77);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x9a958a, roughness: 0.95 });
  for (const [x, z, a] of [[-6, 55, 0.2], [6.2, 25, -0.3], [-6.3, -8, 0.1], [6.5, -52, 0.4], [-6.2, -70, -0.2], [6.3, -100, 0.15], [-6, 95, 0.1]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 3.2), barMat);
    b.position.set(x, 0.45, z); b.rotation.y = a; b.castShadow = true; b.receiveShadow = true; grp.add(b);
  }
  const debMat = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.9 });
  for (let i = 0; i < 90; i++) {
    const s = 0.1 + r() * 0.45;
    const d = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.4, s * (0.6 + r())), debMat);
    d.position.set((r() - 0.5) * 15, s * 0.2, (r() - 0.5) * 300); d.rotation.y = r() * 6;
    d.castShadow = true; grp.add(d);
  }
  return grp;
}

export function makeLand() {
  const grp = new THREE.Group();
  const r = rng(31);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x2c3a2b, roughness: 1 });
  const landMat = new THREE.MeshStandardMaterial({ color: 0x4a4a36, roughness: 1 });
  for (const s of [-1, 1]) {
    const land = new THREE.Mesh(new THREE.BoxGeometry(900, 14, 400), landMat);
    land.position.set(0, -7.6, s * (210 + 200)); land.receiveShadow = true; grp.add(land);
    const road = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 400), new THREE.MeshStandardMaterial({ color: 0x3c3c3e, roughness: 0.9 }));
    road.position.set(0, -0.6, s * 410); grp.add(road);
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 480 + r() * 260;
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), hillMat);
    h.scale.set(80 + r() * 120, 25 + r() * 55, 80 + r() * 120);
    h.position.set(Math.cos(a) * d, -14, Math.sin(a) * d);
    grp.add(h);
  }
  // trees on banks
  const treeGeo = new THREE.ConeGeometry(2.2, 9, 7);
  const tm = new THREE.MeshStandardMaterial({ color: 0x1f3322, roughness: 1 });
  const N = 900, inst = new THREE.InstancedMesh(treeGeo, tm, N), o = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const s = r() < 0.5 ? -1 : 1;
    let x = (r() - 0.5) * 700, z = s * (225 + r() * 300);
    if (Math.abs(x) < 16) x += 30 * Math.sign(x || 1);
    const sc = 0.7 + r() * 0.9;
    o.position.set(x, -0.6 + 4.5 * sc, z); o.scale.set(sc, sc, sc); o.rotation.y = r() * 6;
    o.updateMatrix(); inst.setMatrixAt(i, o.matrix);
  }
  inst.castShadow = true; grp.add(inst);
  // lighthouse-ish tower on far bank for a silhouette landmark
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 26, 12), new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 }));
  tower.position.set(-60, 12, -260); grp.add(tower);
  return grp;
}

export function makeWater(T) {
  const tex = T.water.clone(); tex.needsUpdate = true; tex.repeat.set(120, 120);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({
    color: 0x1a2735, roughness: 0.08, metalness: 0.95, normalMap: tex, normalScale: new THREE.Vector2(0.35, 0.35),
  }));
  m.rotation.x = -Math.PI / 2; m.position.y = -14;
  m.receiveShadow = true;
  m.userData.tex = tex;
  return m;
}

// ---------------- car ----------------
export function makeCarGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.32);
  s.lineTo(0.45, 0.32);
  s.absarc(0.98, 0.32, 0.47, Math.PI, 0, true);
  s.lineTo(3.22, 0.32);
  s.absarc(3.72, 0.32, 0.47, Math.PI, 0, true);
  s.lineTo(4.55, 0.32);
  s.lineTo(4.64, 0.5);
  s.quadraticCurveTo(4.5, 0.66, 4.1, 0.74);
  s.lineTo(3.15, 0.9);
  s.lineTo(2.95, 0.92);
  s.lineTo(1.45, 0.92);
  s.quadraticCurveTo(1.0, 1.02, 0.35, 1.0);
  s.lineTo(0.08, 0.94);
  s.lineTo(0, 0.32);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 4, curveSegments: 18 });
  g.translate(-2.32, 0, -0.88);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

export function makeCar(geo, color, opts = {}) {
  const car = new THREE.Group();
  const body = new THREE.Group(); car.add(body);
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
  const m = new THREE.Mesh(geo, paint); m.castShadow = true; m.receiveShadow = true; body.add(m);
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.6 });
  // cockpit tub + seats
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.45), black);
  tub.position.set(0, 1.0, 0.1); body.add(tub);
  for (const x of [-0.42, 0.42]) {
    const seat = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.22, 4, 10), new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.6 }));
    seat.scale.set(1, 1, 0.45);
    seat.position.set(x, 1.2, 0.68); seat.rotation.x = -0.2; seat.castShadow = true; body.add(seat);
  }
  // windshield
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x111418, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.35 }));
  glass.position.set(0, 1.2, -0.66); glass.rotation.x = -0.75; body.add(glass);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.05, 0.05), black);
  frame.position.set(0, 1.39, -0.48); body.add(frame);
  // intakes, diffuser
  for (const x of [-0.98, 0.98]) { const it = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.8), black); it.position.set(x, 0.62, 0.55); body.add(it); }
  const diff = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.3), black); diff.position.set(0, 0.36, 2.35); body.add(diff);
  // lights
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2dd, emissiveIntensity: opts.headOn ? 6 : 0.5 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1010, emissiveIntensity: 3 });
  for (const x of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.12), head); h.position.set(x, 0.66, -2.24); h.rotation.x = 0.4; body.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.05), tail); t.position.set(x, 0.86, 2.4); body.add(t);
  }
  car.userData.headMat = head;
  // wheels
  const tire = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.85 });
  const rim = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: 0.25 });
  car.userData.wheels = [];
  for (const [x, z] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.34], [0.9, 1.34]]) {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.3, 24), tire); t.rotation.z = Math.PI / 2; t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.31, 10), rim); r.rotation.z = Math.PI / 2; w.add(r);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.05, 0.04), black); sp.rotation.x = k * 1.256; sp.position.x = x > 0 ? 0.16 : -0.16; w.add(sp); }
    w.position.set(x, 0.37, z);
    car.add(w); car.userData.wheels.push(w);
  }
  car.userData.body = body;
  car.userData.paint = paint;
  return car;
}

export function makeWreck(geo, r) {
  const g = new THREE.Group();
  const burnt = new THREE.MeshStandardMaterial({ color: 0x1d1813, roughness: 0.95, metalness: 0.2 });
  const m = new THREE.Mesh(geo, burnt); m.castShadow = true; m.receiveShadow = true;
  m.scale.set(1.05, 1.15, 1.0);
  g.add(m);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 1.8), burnt); cab.position.set(0, 1.25, 0.2); cab.castShadow = true; g.add(cab);
  g.rotation.z = (r() - 0.5) * 0.2;
  g.position.y = -0.12;
  return g;
}

// ---------------- grenade ----------------
export function makeGrenade(T) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group(); pivot.add(spin);
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI / 2 + (i / 24) * Math.PI;
    const y = Math.sin(a) * 0.11;
    const r = Math.cos(a) * 0.082 * (1 - 0.15 * Math.max(0, Math.sin(a)));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48),
    new THREE.MeshStandardMaterial({ map: T.grenade, roughness: 0.5, metalness: 0.25 }));
  body.rotation.y = Math.PI; // put the print (u=0.5) facing +z
  spin.add(body);
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9196, metalness: 1, roughness: 0.3 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.06, 16), steel); cap.position.y = 0.125; spin.add(cap);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 12), steel); top.position.y = 0.165; spin.add(top);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.012), steel);
  lever.position.set(0.075, 0.07, 0); lever.rotation.z = -0.35; spin.add(lever);
  spin.scale.setScalar(1.9);
  pivot.userData.spin = spin;
  return pivot;
}
