// STRYDER bridge intro: scene setup, shot timeline, and frame renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeTextures, makeSky, makeBridge, makeLand, makeWater, makeCarGeometry, makeCar, makeWreck, makeGrenade, rng, SUN_DIR } from './world.js';
import { FireEmitter, Explosion, TireSmoke, Impacts } from './fx.js';
import { drawHeroFull, drawHeroBust, drawRivalBust, makeRim, loadCharacter } from './chars.js';
import { drawOverlay } from './overlay.js';
import { TEAM } from './config.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1280), H = +(Q.get('h') || 720);
const FPS = 30;
export const DURATION = 18.6;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const easeIn = (x) => Math.pow(clamp(x), 2);
const easeOutExpo = (x) => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const vlerp = (a, b, k) => a.clone().lerp(b, k);
const noise1 = (t, s = 0) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 3.1 + s * 2.3) * 0.3 + Math.sin(t * 7.3 + s * 5.1) * 0.2;

// ------------------------------------------------------------------ shots
const SHOTS = [
  { id: 'est', t0: 0.0, t1: 2.4 },
  { id: 'driver', t0: 2.4, t1: 4.0 },
  { id: 'chase', t0: 4.0, t1: 6.4 },
  { id: 'rival', t0: 6.4, t1: 8.0 },
  { id: 'drift', t0: 8.0, t1: 9.8 },
  { id: 'grenade', t0: 9.8, t1: 11.8 },
  { id: 'roll', t0: 11.8, t1: 12.6 },
  { id: 'pose', t0: 12.6, t1: 15.2 },
  { id: 'logo', t0: 15.2, t1: DURATION },
];
const shotAt = (t) => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
const T_EXPLODE = 12.75;
const RIVAL_POS = V3(1.0, 0, -82);
const BOOM_POS = V3(1.0, 0.8, -81.2);

// slow-motion aware time for ambient effects (fire etc.)
function animTime(t) {
  const segs = [[9.8, 11.8, 0.22]];
  let tau = t;
  for (const [a, b, sp] of segs) if (t > a) tau -= (Math.min(t, b) - a) * (1 - sp);
  return tau;
}

// ------------------------------------------------------------------ setup
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
// The WebGL canvas stays offscreen; each frame is composited (3D + titles) into one 2D canvas.
const overlay = document.createElement('canvas');
overlay.width = W; overlay.height = H;
document.body.appendChild(overlay);
const og = overlay.getContext('2d');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x7a5f55, 90, 900);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 2000);

const T = makeTextures();
const sky = makeSky(); scene.add(sky);

// environment for reflections
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const envScene = new THREE.Scene();
  envScene.add(makeSky());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
}
scene.environmentIntensity = 0.9;

const hemi = new THREE.HemisphereLight(0xffc9a0, 0x3a2e28, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb070, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 400 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);

scene.add(makeBridge(T));
scene.add(makeLand());
const water = makeWater(T); scene.add(water);

const carGeo = makeCarGeometry();
const hero = makeCar(carGeo, 0x8f0a0c, { headOn: true });
scene.add(hero);
const rival = makeCar(carGeo, 0x0c0c0e, { headOn: true });
scene.add(rival);

// headlight glows
function addGlows(car, color, size) {
  const arr = [];
  for (const x of [-0.62, 0.62]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.position.set(x, 0.68, -2.32); s.scale.set(size, size, 1);
    car.userData.body.add(s); arr.push(s);
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.streak, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    st.position.set(x, 0.68, -2.34); st.scale.set(size * 4, size * 0.25, 1);
    car.userData.body.add(st); arr.push(st);
  }
  car.userData.glows = arr;
}
addGlows(hero, new THREE.Color(1.6, 1.5, 1.35), 0.45);
addGlows(rival, new THREE.Color(1.6, 1.5, 1.35), 0.45);

// wrecks + fires
const r = rng(101);
const WRECKS = [[-4.6, 120, 0.4], [4.4, 85, 2.6], [-4.8, 44, -0.3], [4.8, 14, 1.9], [-4.4, -22, 0.9], [5.2, -42, -0.6], [-5.2, -98, 2.2], [4.8, -118, 0.3], [-4.2, -152, -1.2], [3.8, -190, 1.1]];
const fires = [];
for (const [x, z, a] of WRECKS) {
  const w = makeWreck(carGeo, r); w.position.x = x; w.position.z = z; w.rotation.y = a; scene.add(w);
  fires.push(new FireEmitter(scene, T, V3(x, 0.9, z), { scale: 1.1, seed: fires.length + 1, plume: 22 }));
}
// a few ground fires around the standoff
for (const [x, z] of [[-6.2, -77], [6, -88], [-6.5, -58]]) fires.push(new FireEmitter(scene, T, V3(x, 0.1, z), { scale: 0.7, seed: fires.length + 7, plume: 10, nFire: 10, nSmoke: 5 }));

const fireLights = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff7a30, 0, 30, 2); scene.add(l); fireLights.push(l); }

const boom = new Explosion(scene, T, { n: 120, scale: 1.0, seed: 4 });
const boom2 = new Explosion(scene, T, { n: 40, scale: 0.6, seed: 9, nDebris: 6 });
const boom3 = new Explosion(scene, T, { n: 40, scale: 0.6, seed: 13, nDebris: 6 });
const tireSmoke = new TireSmoke(scene, T, 70);
const impacts = new Impacts(scene, T, [
  { t: 4.35, p: V3(1.5, 0.05, 42) }, { t: 4.6, p: V3(-0.8, 0.05, 30) }, { t: 4.9, p: V3(2.4, 0.05, 22) },
  { t: 5.2, p: V3(-0.2, 0.05, 6) }, { t: 5.45, p: V3(1.8, 0.05, 0) }, { t: 5.8, p: V3(-1.2, 0.05, -9) },
]);

const grenade = makeGrenade(T); scene.add(grenade);

// characters as billboards (base + additive rim layer)
function billboard(cnv, height, rimColor) {
  const grp = new THREE.Group();
  const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace;
  const aspect = cnv.width / cnv.height;
  const geo = new THREE.PlaneGeometry(height * aspect, height); geo.translate(0, height / 2, 0);
  const base = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, fog: true }));
  const rimTex = new THREE.CanvasTexture(makeRim(cnv, Math.round(cnv.height / 110)));
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rimTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: rimColor }));
  rim.position.z = 0.002;
  grp.add(base); grp.add(rim);
  grp.userData = { base, rim };
  return grp;
}

const chars = {};
async function buildChars() {
  const hf = await loadCharacter('hero_full', drawHeroFull);
  const hb = await loadCharacter('hero_bust', drawHeroBust);
  const rb = await loadCharacter('rival_bust', drawRivalBust);
  chars.heroFull = billboard(hf.canvas, 1.9, new THREE.Color(1, 0.6, 0.3));
  chars.heroBust = billboard(hb.canvas, 0.95, new THREE.Color(1, 0.7, 0.45));
  chars.rivalBust = billboard(rb.canvas, 1.0, new THREE.Color(1, 0.5, 0.3));
  for (const c of Object.values(chars)) { c.visible = false; scene.add(c); }
}

// ------------------------------------------------------------------ logo scene
const logo = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(32, W / H, 0.1, 200), letters: [] };
logo.scene.background = new THREE.Color(0x000000);
logo.scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
logo.scene.environmentIntensity = 0.6;

async function buildLogo() {
  let font;
  try {
    const json = await new TTFLoader().loadAsync('/node_modules/@fontsource/russo-one/files/russo-one-latin-400-normal.woff');
    font = new FontLoader().parse(json);
  } catch (e) {
    font = await new FontLoader().loadAsync('/node_modules/three/examples/fonts/helvetiker_bold.typeface.json');
  }
  const face = new THREE.MeshStandardMaterial({ color: 0x3dff94, emissive: 0x0e8a44, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.2 });
  const side = new THREE.MeshStandardMaterial({ color: 0x0b5a2d, emissive: 0x032612, emissiveIntensity: 0.6, metalness: 0.9, roughness: 0.3 });
  const size = 1.0, spacing = 0.06;
  const geos = [...TEAM.name].map(ch => {
    const g = new TextGeometry(ch, { font, size, height: 0.32, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3 });
    g.computeBoundingBox(); return g;
  });
  const widths = geos.map(g => g.boundingBox.max.x - g.boundingBox.min.x);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (geos.length - 1);
  let x = -total / 2;
  const rr = rng(66);
  geos.forEach((g, i) => {
    const bb = g.boundingBox;
    g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -0.16);
    const m = new THREE.Mesh(g, [face, side]);
    const final = V3(x + widths[i] / 2, 0, 0);
    x += widths[i] + spacing;
    const ang = rr() * Math.PI * 2;
    const start = V3(Math.cos(ang) * (5 + rr() * 4), Math.sin(ang) * (3 + rr() * 3), -6 + rr() * 14);
    m.userData = { final, start, rot: V3((rr() - 0.5) * 7, (rr() - 0.5) * 9, (rr() - 0.5) * 5), delay: [0, 0.32, 0.12, 0.44, 0.2, 0.36, 0.06][i % 7] * 0.9 };
    logo.scene.add(m); logo.letters.push(m);
  });
  logo.total = total;
  // subtitle
  const sg = new TextGeometry(TEAM.sub.split('').join(' '), { font, size: 0.24, height: 0.05, curveSegments: 4 });
  sg.computeBoundingBox(); sg.translate(-(sg.boundingBox.max.x + sg.boundingBox.min.x) / 2, 0, 0);
  logo.sub = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfffd8, emissiveIntensity: 0.8, transparent: true, opacity: 0 }));
  logo.sub.position.set(0, -0.95, 0.05);
  logo.scene.add(logo.sub);
  // decorations
  const add = (tex, color) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); logo.scene.add(s); return s; };
  logo.rays = add(T.rays, new THREE.Color(0.12, 0.6, 0.3)); logo.rays.position.z = -3;
  logo.streak = add(T.streak, new THREE.Color(0.5, 1.6, 0.9)); logo.streak.position.z = -0.5;
  logo.glint = add(T.glow, new THREE.Color(3, 3, 3));
  logo.glintH = add(T.streak, new THREE.Color(2, 2, 2));
  logo.sparks = [];
  for (let i = 0; i < 70; i++) { const s = add(T.glow, new THREE.Color(0.6, 2.5, 1.2)); logo.sparks.push({ s, a: rr() * 6.28, sp: 1.5 + rr() * 5, y: (rr() - 0.5) * 2, z: (rr() - 0.5) * 3, t0: rr() * 0.6 }); }
  logo.key = new THREE.PointLight(0xffffff, 0, 0, 2); logo.scene.add(logo.key);
  logo.fill = new THREE.DirectionalLight(0x9fffd0, 1.2); logo.fill.position.set(-3, 4, 6); logo.scene.add(logo.fill);
  logo.scene.add(new THREE.AmbientLight(0xffffff, 0.15));
}

function updateLogo(t) {
  const lt = t - 15.2;
  logo.cam.position.set(Math.sin(lt * 0.3) * 0.6, 0.15, lerp(14.5, 12.2, easeOut(lt / 3.2)));
  logo.cam.lookAt(0, 0, 0);
  logo.letters.forEach((m) => {
    const d = m.userData;
    const k = easeOutExpo((lt - 0.15 - d.delay) / 0.85);
    m.visible = lt - 0.15 - d.delay > 0;
    m.position.copy(vlerp(d.start, d.final, k));
    m.rotation.set(d.rot.x * (1 - k), d.rot.y * (1 - k), d.rot.z * (1 - k));
    const sc = lerp(0.3, 1, k); m.scale.setScalar(sc);
  });
  const settled = lt - 1.25;
  logo.sub.material.opacity = clamp((lt - 1.45) / 0.4);
  logo.sub.position.y = -0.95 - (1 - easeOut((lt - 1.45) / 0.5)) * 0.25;
  const pulse = settled > 0 ? Math.exp(-settled * 2.5) : 0;
  logo.rays.visible = lt > 0.9;
  logo.rays.material.opacity = clamp((lt - 0.9) / 0.4) * (0.55 + 0.6 * pulse);
  const rs = 7 + pulse * 3 + lt * 0.3;
  logo.rays.scale.set(rs * 1.6, rs, 1);
  logo.rays.material.rotation = lt * 0.12;
  logo.streak.visible = lt > 1.0;
  logo.streak.material.opacity = clamp((lt - 1.0) / 0.2) * (0.35 + 1.2 * pulse);
  logo.streak.scale.set(18 + pulse * 8, 0.35, 1);
  // glint sweeping across at ~1.9s
  const gk = (lt - 1.85) / 0.6;
  logo.glint.visible = logo.glintH.visible = gk > 0 && gk < 1;
  const gx = lerp(-logo.total / 2 - 0.5, logo.total / 2 + 0.5, ease(gk));
  logo.glint.position.set(gx, 0.38, 0.4); logo.glint.scale.set(0.5, 0.5, 1);
  logo.glintH.position.set(gx, 0.38, 0.42); logo.glintH.scale.set(2.4, 0.12, 1);
  logo.glint.material.opacity = logo.glintH.material.opacity = 0.6 * Math.sin(Math.PI * clamp(gk));
  logo.key.position.set(gx, 0.6, 2.2);
  logo.key.intensity = gk > 0 && gk < 1 ? 10 * Math.sin(Math.PI * clamp(gk)) : 0;
  logo.fill.intensity = 1.2 + pulse * 2;
  for (const p of logo.sparks) {
    const a = lt - 1.1 - p.t0 * 0.3;
    p.s.visible = a > 0 && a < 1.8;
    if (!p.s.visible) continue;
    const dd = p.sp * easeOut(a / 1.8);
    p.s.position.set(Math.cos(p.a) * dd * 1.4, Math.sin(p.a) * dd * 0.6 + p.y * 0.2, p.z);
    const s = 0.12 * (1 - a / 1.8) + 0.02;
    p.s.scale.set(s, s, 1);
    p.s.material.opacity = 1 - a / 1.8;
  }
}

// ------------------------------------------------------------------ post
const rtOpts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace, samples: 4 };
const rtScene = new THREE.WebGLRenderTarget(W, H, rtOpts);
const rtAcc = [new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }), new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType })];
const accQuad = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: { tNew: { value: null }, tPrev: { value: null }, w: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }',
  fragmentShader: 'uniform sampler2D tNew,tPrev; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = mix(texture2D(tPrev,vUv), texture2D(tNew,vUv), w); }',
  depthTest: false, depthWrite: false,
}));

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
const texPass = new TexturePass(null); composer.addPass(texPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 1.35); composer.addPass(bloom);
composer.addPass(new OutputPass());
const finalPass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRadial: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uChroma: { value: 0.0015 }, uGrain: { value: 0.035 }, uVig: { value: 0.35 }, uFlash: { value: 0 }, uFade: { value: 0 },
    uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uAspect: { value: W / H },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime,uRadial,uChroma,uGrain,uVig,uFlash,uFade,uSat,uContrast,uAspect; uniform vec2 uCenter;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = vUv - uCenter;
      vec3 col = vec3(0.);
      const int N = 10;
      for (int i=0;i<N;i++){
        float k = 1.0 - uRadial*float(i)/float(N);
        vec2 uv = uCenter + d*k;
        col.r += texture2D(tDiffuse, uv + d*uChroma).r;
        col.g += texture2D(tDiffuse, uv).g;
        col.b += texture2D(tDiffuse, uv - d*uChroma).b;
      }
      col /= float(N);
      col = (col-0.5)*uContrast+0.5;
      float l = dot(col, vec3(0.299,0.587,0.114));
      col = mix(vec3(l), col, uSat);
      col += vec3(-0.012,0.004,0.02)*(1.-l) + vec3(0.02,0.008,-0.012)*l; // teal/orange split
      vec2 vd = d*vec2(uAspect/1.6,1.0);
      col *= 1.0 - uVig*smoothstep(0.25, 0.85, length(vd)*1.25);
      col += (hash(vUv*vec2(1920.,1080.)+fract(uTime)*91.7)-0.5)*uGrain;
      col = mix(col, vec3(1.), uFlash);
      col *= 1.0-uFade;
      gl_FragColor = vec4(clamp(col,0.,1.),1.);
    }`,
});
composer.addPass(finalPass);

// ------------------------------------------------------------------ animation state
// hero car path per shot
function heroCarState(t) {
  const s = shotAt(t).id;
  if (s === 'est') { const z = 160 - 40 * t; return { p: V3(1.6, 0, z), yaw: 0, v: 40, visible: true }; }
  if (s === 'driver') { const z = 150 - 42 * (t - 2.4); return { p: V3(1.6, 0, z), yaw: 0, v: 42 }; }
  if (s === 'chase') {
    const u = t - 4.0, z = 70 - 40 * u;
    const x = 0.8 + 1.6 * Math.sin(u * 2.3);
    const dx = 1.6 * 2.3 * Math.cos(u * 2.3);
    return { p: V3(x, 0, z), yaw: Math.atan2(dx, 40) * 0.9, roll: -dx * 0.012, v: 40 };
  }
  if (s === 'rival') { const z = 30 - 38 * (t - 6.4); return { p: V3(0.8, 0, z), yaw: 0, v: 38 }; }
  // from the drift onward the car is parked at the standoff
  const k = easeOut((t - 8.0) / 1.0);
  const z = lerp(-18, -63, k), x = lerp(0.6, 3.6, easeOut((t - 8.1) / 0.9));
  const yaw = -Math.PI / 2 * ease((t - 8.12) / 0.82);
  const v = 45 * (1 - clamp((t - 8.0) / 1.0));
  const roll = 0.06 * Math.sin(Math.PI * clamp((t - 8.1) / 0.9));
  return { p: V3(x, 0, z), yaw, roll, v };
}

function applyCar(car, st, t) {
  car.position.copy(st.p);
  car.rotation.set(0, st.yaw || 0, 0);
  car.userData.body.rotation.z = st.roll || 0;
  car.userData.body.position.y = Math.sin(t * 37) * 0.006 * Math.min(1, (st.v || 0) / 20);
  for (const w of car.userData.wheels) w.rotation.x = -(st.dist ?? t * (st.v || 0)) / 0.37;
}

// rival car: parked, then launched by the explosion
function rivalCarState(t) {
  const dt = t - T_EXPLODE;
  if (dt < 0) return { p: RIVAL_POS.clone(), yaw: Math.PI, rot: V3(0, 0, 0) };
  const v = V3(-1.2, 13, 4.0);
  const p = V3(RIVAL_POS.x + v.x * dt, Math.max(0, v.y * dt - 4.9 * dt * dt), RIVAL_POS.z + v.z * dt);
  return { p, yaw: Math.PI + dt * 1.4, rot: V3(dt * 2.6, 0, dt * 1.3) };
}

// grenade path
function grenadeState(t) {
  const s = shotAt(t).id;
  if (s === 'grenade') {
    const cam = V3(0.6, 0.35, -77.5), look = V3(3.2, 1.3, -65.4);
    const f = look.clone().sub(cam).normalize(), right = f.clone().cross(V3(0, 1, 0)).normalize();
    const start = V3(3.55, 1.85, -65.6);
    const end = cam.clone().addScaledVector(f, 1.25).addScaledVector(right, 0.36).add(V3(0, 0.04, 0));
    const ctrl = start.clone().lerp(end, 0.5).add(V3(0, 0.55, 0));
    const u = clamp((t - 9.8) / 2.0);
    const k = 0.15 + 0.85 * (u * 0.55 + 0.45 * easeIn(u));
    const p = start.clone().multiplyScalar((1 - k) * (1 - k)).addScaledVector(ctrl, 2 * (1 - k) * k).addScaledVector(end, k * k);
    return { p, spin: (1 - k) * 9.0, tumble: (1 - k) * 2.2, visible: true };
  }
  if (s === 'roll') {
    const u = clamp((t - 11.8) / 0.8);
    const a = V3(-0.6, 0, -74.6), b = V3(0.9, 0, -80.0);
    const p = vlerp(a, b, easeOut(u * 1.1));
    const bounce = Math.abs(Math.sin(u * Math.PI * 3)) * 0.9 * Math.exp(-u * 4.5);
    p.y = 0.21 + bounce;
    return { p, spin: u * 9, tumble: Math.PI / 2 * clamp(u * 3), visible: true, roll: true };
  }
  return { visible: false };
}

// ------------------------------------------------------------------ camera per shot
const params = {};
function setupShot(t) {
  const sh = shotAt(t), u = (t - sh.t0) / (sh.t1 - sh.t0);
  let pos, look, fov = 40, roll = 0;
  Object.assign(params, { bloom: 0.55, radial: 0, center: [0.5, 0.5], chroma: 0.0015, flash: 0, fade: 0, focus: V3(0, 0, 0), exposure: 1.0, sat: 1.08 });
  const shake = (amp, f = 1) => V3(noise1(t * 9 * f, 1) * amp, noise1(t * 9 * f, 7) * amp, noise1(t * 9 * f, 13) * amp * 0.5);

  switch (sh.id) {
    case 'est':
      pos = vlerp(V3(98, -5, 64), V3(82, -3.5, 44), ease(u));
      look = vlerp(V3(0, 7, -24), V3(0, 6, -34), ease(u));
      fov = 38; params.focus = V3(0, 0, 0); params.bloom = 0.65;
      params.fade = 1 - easeOut(t / 0.6);
      break;
    case 'driver': {
      const st = heroCarState(t);
      const local = vlerp(V3(-2.15, 1.38, -0.75), V3(-1.75, 1.34, -0.45), ease(u));
      const lk = V3(-0.42, 1.32, 0.32);
      pos = st.p.clone().add(local).add(shake(0.025, 2));
      look = st.p.clone().add(lk);
      fov = 34; params.focus = st.p; params.bloom = 0.45;
      break;
    }
    case 'chase': {
      const st = heroCarState(t);
      const dist = lerp(18, 3.2, easeIn(u));
      pos = V3(2.9 - u * 0.6, lerp(0.45, 0.75, u), st.p.z - dist).add(shake(0.04, 1.5));
      look = st.p.clone().add(V3(0, 0.7, 0));
      fov = lerp(30, 44, easeIn(u)); roll = -0.04 + u * 0.05;
      params.radial = 0.012 * u; params.focus = st.p; params.bloom = 0.65; params.chroma = 0.0025;
      break;
    }
    case 'rival':
      pos = vlerp(V3(4.2, 1.6, -78.6), V3(3.5, 1.55, -79.6), ease(u));
      look = V3(1.42, 1.38, -82.3);
      fov = 34; params.focus = RIVAL_POS; params.bloom = 0.6;
      break;
    case 'drift': {
      pos = vlerp(V3(-1.2, 1.5, -76.0), V3(-0.4, 1.35, -73.2), ease(u)).add(shake(0.03 * (1 - u), 2));
      const st = heroCarState(t);
      look = vlerp(V3(1.5, 1.0, -48), st.p.clone().add(V3(0, 0.9, 0)), easeOut(u * 1.4));
      fov = 40; params.focus = V3(2, 0, -63); params.bloom = 0.6;
      break;
    }
    case 'grenade':
      pos = vlerp(V3(0.6, 0.35, -77.5), V3(0.55, 0.36, -77.35), u);
      look = V3(3.2, 1.3, -65.4);
      fov = 42; params.focus = V3(2, 0, -70); params.bloom = 0.7; params.sat = 1.0;
      break;
    case 'roll': {
      const g = grenadeState(t).p;
      pos = vlerp(V3(-1.9, 0.3, -74.2), V3(-1.2, 0.26, -77.2), ease(u));
      look = g.clone().add(V3(0.1, 0.12, -0.4));
      fov = 34; params.focus = V3(0, 0, -78); params.bloom = 0.7;
      break;
    }
      break;
    case 'pose': {
      const dt = t - T_EXPLODE;
      const amp = dt > 0 ? 0.16 * Math.exp(-dt * 2.0) : 0;
      pos = vlerp(V3(-0.45, 1.05, -58.6), V3(-0.45, 1.0, -59.4), ease(u)).add(shake(amp, 3));
      look = V3(-0.55, 2.3, -68).add(shake(amp * 0.5, 3));
      fov = 42; params.focus = V3(0, 0, -70);
      params.bloom = dt > 0 ? 0.7 + 0.5 * Math.exp(-dt * 3) : 0.55;
      params.chroma = 0.0015 + (dt > 0 ? 0.006 * Math.exp(-dt * 3) : 0);
      params.flash = clamp((t - 14.92) / 0.28) ** 2 + (dt > 0 && dt < 0.12 ? 0.35 * (1 - dt / 0.12) : 0);
      break;
    }
  }
  camera.fov = fov;
  camera.position.copy(pos);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(look);
  camera.updateProjectionMatrix();
  return sh;
}

// ------------------------------------------------------------------ per-time scene update
function updateScene(t) {
  const sh = shotAt(t);
  const tau = animTime(t);
  sky.material.uniforms.uTime.value = tau;
  water.userData.tex.offset.set(tau * 0.01, tau * 0.006);

  // hero car
  const hs = heroCarState(t);
  applyCar(hero, hs, tau);
  hero.visible = sh.id !== 'est' && sh.id !== 'rival' ? true : sh.id === 'est';
  if (sh.id === 'rival') hero.visible = false;
  // rival car
  const rs = rivalCarState(t);
  rival.position.copy(rs.p);
  rival.rotation.set(rs.rot.x, rs.yaw, rs.rot.z);
  rival.userData.glows.forEach(g => (g.visible = t < T_EXPLODE));
  rival.userData.headMat.emissiveIntensity = t < T_EXPLODE ? 6 : 0;
  for (const w of rival.userData.wheels) w.rotation.x = 0;
  hero.userData.glows.forEach(g => (g.visible = !['drift', 'grenade', 'roll', 'pose'].includes(sh.id) || t < 8.6));

  // fires
  fires.forEach((f, i) => f.update(tau + i * 0.37, 1));
  // nearest fire lights
  const camP = camera.position;
  const near = fires.map((f, i) => [f.pos.distanceTo(camP), f]).sort((a, b) => a[0] - b[0]).slice(0, 4);
  near.forEach(([, f], i) => {
    const l = fireLights[i];
    l.position.copy(f.pos).add(V3(0, 1.5, 0));
    l.intensity = 60 * f.scale * (0.8 + 0.2 * Math.sin(tau * 13 + i) + 0.1 * Math.sin(tau * 31 + i * 2));
  });

  // explosions
  boom.update(t, T_EXPLODE, BOOM_POS);
  boom2.update(t, T_EXPLODE + 0.35, V3(-5.2, 0.8, -98));
  boom3.update(t, T_EXPLODE + 0.7, V3(5.2, 0.8, -42));

  // tire smoke during drift
  const wheelPos = (tb, side) => {
    const st = heroCarState(tb);
    const local = V3(side ? 0.9 : -0.9, 0, 1.34).applyAxisAngle(V3(0, 1, 0), st.yaw);
    return st.p.clone().add(local);
  };
  tireSmoke.update(t, 8.1, 9.05, wheelPos, (tb) => clamp((tb - 8.1) / 0.1) * clamp((9.05 - tb) / 0.2));
  if (!['drift', 'grenade', 'roll', 'pose'].includes(sh.id)) tireSmoke.p.forEach(p => (p.s.visible = false));
  impacts.update(t);

  // grenade
  const gs = grenadeState(t);
  grenade.visible = !!gs.visible;
  if (gs.visible) {
    grenade.position.copy(gs.p);
    if (gs.roll) { grenade.rotation.set(0, 0, 0); grenade.userData.spin.rotation.set(gs.spin, 0, gs.tumble); }
    else {
      grenade.lookAt(camera.position);
      grenade.userData.spin.rotation.set(gs.tumble * 0.4, gs.spin, gs.tumble * 0.25 + 0.25);
    }
  }

  // characters
  for (const c of Object.values(chars)) c.visible = false;
  const face = (c) => { c.lookAt(camera.position.x, c.position.y, camera.position.z); };
  if (sh.id === 'driver') {
    const c = chars.heroBust; c.visible = true;
    const p = V3(-0.42, 0.88, 0.32).applyAxisAngle(V3(0, 1, 0), hs.yaw).add(hs.p);
    c.position.copy(p); c.lookAt(camera.position);
    c.userData.base.material.color.setRGB(0.95, 0.85, 0.8);
    c.userData.rim.material.opacity = 0.9;
  }
  if (sh.id === 'chase') {
    const c = chars.heroBust; c.visible = true;
    const p = V3(-0.42, 0.88, 0.32).applyAxisAngle(V3(0, 1, 0), hs.yaw).add(hs.p);
    c.position.copy(p); face(c);
    c.userData.base.material.color.setRGB(0.6, 0.55, 0.55);
  }
  if (sh.id === 'rival' || sh.id === 'roll' || sh.id === 'grenade' || sh.id === 'drift' || (sh.id === 'pose' && t < T_EXPLODE)) {
    const c = chars.rivalBust; c.visible = true;
    const p = V3(-0.42, 0.82, 0.3).applyAxisAngle(V3(0, 1, 0), Math.PI).add(RIVAL_POS);
    c.position.copy(p); face(c);
    c.userData.base.material.color.setRGB(1.0, 0.95, 0.95);
    c.userData.rim.material.color.setRGB(1.6, 0.35, 0.3);
    c.userData.rim.material.opacity = 1.0;
  }
  if (sh.id === 'drift' && t > 9.1) {
    const c = chars.heroFull; c.visible = true;
    const k = easeOut((t - 9.1) / 0.5);
    c.position.copy(vlerp(V3(3.4, -0.9, -63.3), V3(3.15, 0, -64.9), k));
    face(c);
    c.userData.base.material.color.setRGB(0.8, 0.75, 0.75);
    c.userData.rim.material.opacity = 0.7;
  }
  if (sh.id === 'grenade') {
    const c = chars.heroFull; c.visible = true;
    c.position.set(3.15, 0, -64.9); face(c);
    c.userData.base.material.color.setRGB(0.7, 0.66, 0.66);
    c.userData.rim.material.opacity = 0.8;
  }
  if (sh.id === 'pose') {
    const c = chars.heroFull; c.visible = true;
    const u = (t - 12.6) / 2.6;
    c.position.set(-0.6, Math.abs(Math.sin(u * 9)) * 0.03, lerp(-66.2, -63.4, u));
    face(c);
    const dt = t - T_EXPLODE;
    const glow = dt > 0 ? Math.exp(-dt * 1.2) : 0;
    c.userData.base.material.color.setRGB(0.42 + 0.25 * glow, 0.36 + 0.12 * glow, 0.36);
    c.userData.rim.material.color.setRGB(1.0 + 3 * glow, 0.55 + 1.2 * glow, 0.25 + 0.3 * glow);
    c.userData.rim.material.opacity = 0.7 + 0.3 * glow;
  }

  // shadows follow the action
  const f = params.focus;
  sun.target.position.copy(f);
  sun.position.copy(f).addScaledVector(SUN_DIR, 150);
}

// ------------------------------------------------------------------ render
function renderAt(t, sub) {
  if (shotAt(t).id === 'logo') {
    updateLogo(t);
    renderer.setRenderTarget(rtScene);
    renderer.render(logo.scene, logo.cam);
  } else {
    setupShot(t);
    updateScene(t);
    renderer.setRenderTarget(rtScene);
    renderer.render(scene, camera);
  }
}

const SUBFRAMES = { est: 1, driver: 3, chase: 3, rival: 1, drift: 3, grenade: 2, roll: 2, pose: 2, logo: 2 };

window.renderFrame = (t) => {
  const sh = shotAt(t);
  const K = +(Q.get('mb') ?? -1) >= 0 ? +Q.get('mb') : SUBFRAMES[sh.id];
  const shutter = 0.5 / FPS;
  let a = 0;
  for (let k = 0; k < K; k++) {
    let ts = K > 1 ? t + (k / (K - 1) - 0.5) * shutter : t;
    // never blend across a cut
    ts = Math.min(Math.max(ts, sh.t0), sh.t1 - 1e-4);
    renderAt(ts, k);
    accQuad.material.uniforms.tNew.value = rtScene.texture;
    accQuad.material.uniforms.tPrev.value = rtAcc[1 - a].texture;
    accQuad.material.uniforms.w.value = 1 / (k + 1);
    renderer.setRenderTarget(rtAcc[a]);
    accQuad.render(renderer);
    a = 1 - a;
  }
  // final post using params of the center time
  if (sh.id === 'logo') {
    Object.assign(params, { bloom: 0.75, radial: 0, chroma: 0.0012, fade: clamp((t - 18.2) / 0.38), sat: 1.1 });
    params.flash = Math.max(0, 1 - (t - 15.2) / 0.35) ** 2;
  } else setupShot(t);
  texPass.map = rtAcc[1 - a].texture;
  bloom.strength = params.bloom;
  const U = finalPass.uniforms;
  U.uTime.value = t; U.uRadial.value = params.radial; U.uChroma.value = params.chroma;
  U.uFlash.value = params.flash; U.uFade.value = params.fade; U.uSat.value = params.sat;
  if (params.radial > 0) { const p = params.focus.clone().add(V3(0, 0.7, 0)).project(camera); U.uCenter.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5); }
  else U.uCenter.value.set(0.5, 0.5);
  renderer.setRenderTarget(null);
  composer.render();
  og.clearRect(0, 0, W, H);
  og.drawImage(renderer.domElement, 0, 0);
  drawOverlay(og, t, W, H);
  return true;
};
window.frameData = () => overlay.toDataURL('image/png');

(async () => {
  await document.fonts.load('120px Anton');
  await document.fonts.load('700 30px Rajdhani');
  // redraw grenade print now that Anton is loaded
  const T2 = makeTextures();
  grenade.traverse(o => { if (o.material && o.material.map === T.grenade) { o.material.map = T2.grenade; o.material.needsUpdate = true; } });
  await buildChars();
  await buildLogo();
  window.DURATION = DURATION;
  window.FPS = FPS;
  window.ready = true;
})().catch(e => { window.initError = String(e && e.stack || e); });
