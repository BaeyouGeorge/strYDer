// "THE DROP" — STRYDER intro. Storm, skydive, crate standoff, lightning strike, logo.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeTextures, rng } from './world.js';
import { Explosion } from './fx.js';
import { makeStormSky, makeIsland, makeTower, makeCrate, makePlane, CloudDeck, Rain, makeBolt, strikeEnv, makeParachute, Flare } from './drop_world.js';
import { drawHeroFull, drawHeroSky, drawRivalBust, drawRivalFull, makeRim, loadCharacter } from './chars.js';
import { lowerThird, bigPunch, killfeed, boltIcon } from './overlay.js';
import { DROP_TEXT } from './config.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1280), H = +(Q.get('h') || 720);
const FPS = 30;
export const DURATION = 19.4;

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
  { id: 'storm', t0: 0.0, t1: 2.6 },
  { id: 'ramp', t0: 2.6, t1: 4.3 },
  { id: 'fall', t0: 4.3, t1: 6.0 },
  { id: 'dive', t0: 6.0, t1: 7.3 },
  { id: 'canopy', t0: 7.3, t1: 9.0 },
  { id: 'rivals', t0: 9.0, t1: 10.6 },
  { id: 'lookup', t0: 10.6, t1: 11.6 },
  { id: 'land', t0: 11.6, t1: 13.0 },
  { id: 'strike', t0: 13.0, t1: 15.2 },
  { id: 'logo', t0: 15.2, t1: DURATION },
];
const shotAt = (t) => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
const T_LAND = 12.35, T_STRIKE = 13.3;
const AERIAL = ['storm', 'ramp', 'fall', 'dive'];
const GROUND = ['rivals', 'lookup', 'land', 'strike'];

function animTime(t) {
  let tau = t;
  for (const [a, b, sp] of [[11.6, T_LAND, 0.3]]) if (t > a) tau -= (Math.min(t, b) - a) * (1 - sp);
  return tau;
}

const planePos = (t) => V3(-40, 600, 160 - 75 * t);
const JUMP = planePos(4.1).add(V3(0, -3, 16));
const heroFall = (t) => JUMP.clone().add(V3(0, -(t - 4.1) * 46, 0));
const RIVALS = [
  { start: V3(-7.5, 0, -26), end: V3(-4.6, 0, -4.4), v: 0 },
  { start: V3(1.5, 0, -30), end: V3(0.4, 0, -6.6), v: 1 },
  { start: V3(8.0, 0, -27), end: V3(4.5, 0, -4.8), v: 2 },
];
const FLARE_POS = V3(1.7, 0.05, 1.2);

// ------------------------------------------------------------------ setup
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const overlay = document.createElement('canvas');
overlay.width = W; overlay.height = H;
document.body.appendChild(overlay);
const og = overlay.getContext('2d');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0c0a18, 0.0008);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 4000);

const T = makeTextures();
const sky = makeStormSky(); scene.add(sky);
const pmrem = new THREE.PMREMGenerator(renderer);
{
  const envScene = new THREE.Scene(); envScene.add(makeStormSky());
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
}
scene.environmentIntensity = 1.5;

const hemi = new THREE.HemisphereLight(0x5a5a9a, 0x0a0a12, 0.7); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8a9cff, 0.5); moon.position.set(300, 400, 600); scene.add(moon);
const flashLight = new THREE.DirectionalLight(0xc8b8ff, 0);
flashLight.castShadow = true;
flashLight.shadow.mapSize.set(2048, 2048);
Object.assign(flashLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 800 });
flashLight.shadow.bias = -0.0005;
scene.add(flashLight); scene.add(flashLight.target);

scene.add(makeIsland());
const tower = makeTower(); tower.position.set(16, 0, -14); tower.rotation.y = 0.4; scene.add(tower);
const crate = makeCrate(); scene.add(crate);
const flare = new Flare(scene, T, FLARE_POS);
const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: new THREE.Color(3, 1.2, 5), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }));
beacon.position.copy(FLARE_POS); scene.add(beacon);

const plane = makePlane(); scene.add(plane);
const clouds = new CloudDeck(scene, T, {
  n: 300, area: 2600, y0: 430, y1: 520, size: 170, seed: 3, cz: -200,
  clusters: [
    { p: V3(JUMP.x, 525, JUMP.z), r: 70, h: 90, n: 45, size: 48 },
    { p: V3(-22, 400, -42), r: 45, h: 150, n: 55, size: 42 },
  ],
});
const rain = new Rain(scene, 3200);

// lightning events: bolt geometry fixed in world space
const P085 = planePos(0.85), P205 = planePos(2.05), P33 = planePos(3.3);
const EVENTS = [
  { t: 0.85, a: P085.clone().add(V3(-140, -40, -260)), b: P085.clone().add(V3(-70, -330, -300)), w: 2.2, s: 1.0 },
  { t: 2.05, a: P205.clone().add(V3(110, -20, -380)), b: P205.clone().add(V3(170, -330, -350)), w: 2.4, s: 0.9 },
  { t: 3.3, a: P33.clone().add(V3(40, -30, 320)), b: P33.clone().add(V3(70, -330, 300)), w: 2.4, s: 1.0 },
  { t: 5.0, a: JUMP.clone().add(V3(160, 60, -260)), b: JUMP.clone().add(V3(110, -260, -300)), w: 2.4, s: 0.9 },
  { t: 6.7, a: V3(-160, 520, -260), b: V3(-120, 330, -230), w: 2.2, s: 0.8 },
  { t: 8.1, a: V3(-220, 380, -520), b: V3(-170, 0, -480), w: 2.0, s: 0.9 },
  { t: 10.05, a: V3(40, 330, -300), b: V3(26, 0, -280), w: 1.6, s: 0.8 },
  { t: 11.05, a: V3(-30, 420, 200), b: V3(-20, 200, 180), w: 1.6, s: 1.0, hidden: true },
  { t: T_STRIKE, a: V3(10, 300, -140), b: V3(0, 2.9, 0), w: 0.22, s: 1.0, dur: 0.55 },
];
EVENTS.forEach((e, i) => { e.bolt = makeBolt(e.a, e.b, 100 + i, { width: e.w }); scene.add(e.bolt); });

const burst = new Explosion(scene, T, {
  n: 80, scale: 0.55, seed: 7, nDebris: 0, ringColor: 0xa060ff,
  palette: { hot: [1.1, 0.55, 2.6], ember: [0.35, 0.1, 0.8], soot: [0.03, 0.02, 0.06], core: [0.5, 0.25, 1.0], spark: [2.0, 1.2, 4.5], light: 0xa070ff, lightScale: 0.12, smoke: [0.7, 0.5, 1.4] },
});
const dust = new Explosion(scene, T, {
  n: 40, scale: 0.4, seed: 3, nDebris: 0, ringColor: 0x7a50ff,
  palette: { hot: [0.32, 0.3, 0.36], ember: [0.2, 0.18, 0.22], soot: [0.07, 0.065, 0.075], core: [0.08, 0.06, 0.12], spark: [0.3, 0.25, 0.6], light: 0x8060ff, lightScale: 0.1, smoke: [1.0, 0.95, 1.0] },
});

// characters as billboards (base + additive rim layer)
function billboard(cnv, height, rimColor, anchor = 0) {
  const grp = new THREE.Group();
  const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace;
  const aspect = cnv.width / cnv.height;
  const geo = new THREE.PlaneGeometry(height * aspect, height); geo.translate(0, anchor === 0 ? height / 2 : 0, 0);
  const base = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, fog: true }));
  const rimTex = new THREE.CanvasTexture(makeRim(cnv, Math.round(cnv.height / 110)));
  const rim = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: rimTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: rimColor }));
  rim.position.z = 0.002;
  grp.add(base); grp.add(rim);
  grp.userData = { base, rim };
  return grp;
}

const chars = {};
let chute;
async function buildChars(brand) {
  const hf = await loadCharacter('hero_full', drawHeroFull);
  chars.heroFull = billboard(hf.canvas, 1.9, new THREE.Color(0.8, 0.6, 1.6));
  chars.heroSky = billboard(drawHeroSky(), 2.4, new THREE.Color(0.8, 0.6, 1.6), 1);
  chars.rivalBust = billboard((await loadCharacter('rival_bust', drawRivalBust)).canvas, 1.0, new THREE.Color(1, 0.4, 0.4));
  chars.rivals = RIVALS.map(r => billboard(drawRivalFull(r.v), 1.95, new THREE.Color(1.0, 0.5, 0.6)));
  for (const c of [chars.heroFull, chars.heroSky, chars.rivalBust, ...chars.rivals]) { c.visible = false; scene.add(c); }
  chute = makeParachute(brand.wordmark); chute.visible = false; scene.add(chute);
}

// ------------------------------------------------------------------ logo scene
const logo = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(32, W / H, 0.1, 200), letters: [] };
logo.scene.background = new THREE.Color(0x000000);
logo.scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
logo.scene.environmentIntensity = 0.6;

async function loadTex(url) {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

async function buildLogo() {
  const word = await loadTex('/brand/wordmark.png');
  const sub = await loadTex('/brand/subtitle.png');
  const tag = await loadTex('/brand/tagline.png');
  const WW = 7.4, WH = WW * word.image.height / word.image.width;
  // letter strips (u ranges) so the wordmark can assemble letter by letter
  const cuts = [0, 0.2, 0.335, 0.47, 0.6, 0.735, 0.845, 1];
  const rr = rng(66);
  const delays = [0, 0.32, 0.12, 0.44, 0.2, 0.36, 0.06];
  for (let i = 0; i < cuts.length - 1; i++) {
    const u0 = cuts[i], u1 = cuts[i + 1], w = (u1 - u0) * WW;
    const g = new THREE.PlaneGeometry(w, WH);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setX(k, u0 + uv.getX(k) * (u1 - u0));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: word, transparent: true, depthWrite: false, color: new THREE.Color(1.5, 1.5, 1.6) }));
    const final = V3(-WW / 2 + (u0 + u1) / 2 * WW, 0.2, 0);
    const ang = rr() * Math.PI * 2;
    const start = V3(Math.cos(ang) * (5 + rr() * 4), Math.sin(ang) * (3 + rr() * 3), -6 + rr() * 14);
    m.userData = { final, start, rot: V3((rr() - 0.5) * 7, (rr() - 0.5) * 9, (rr() - 0.5) * 5), delay: delays[i] * 0.9 };
    logo.scene.add(m); logo.letters.push(m);
  }
  logo.total = WW;
  const plane = (tex, width, y, col) => {
    const h = width * tex.image.height / tex.image.width;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0, color: col }));
    m.position.set(0, y, 0.05); logo.scene.add(m); return m;
  };
  logo.sub = plane(sub, 5.0, -0.85, new THREE.Color(1.4, 1.4, 1.5));
  logo.tag = plane(tag, 2.1, -1.65, new THREE.Color(1.3, 1.3, 1.4));
  const add = (tex, color) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); logo.scene.add(s); return s; };
  logo.rays = add(T.rays, new THREE.Color(0.25, 0.2, 0.75)); logo.rays.position.z = -3;
  logo.rays2 = add(T.rays, new THREE.Color(0.45, 0.12, 0.6)); logo.rays2.position.z = -3.2;
  logo.streak = add(T.streak, new THREE.Color(0.9, 0.7, 2.2)); logo.streak.position.z = -0.5;
  logo.glint = add(T.glow, new THREE.Color(2.5, 2.5, 3));
  logo.glintH = add(T.streak, new THREE.Color(1.8, 1.8, 2.4));
  logo.sparks = [];
  for (let i = 0; i < 80; i++) {
    const c = rr() < 0.5 ? new THREE.Color(0.6, 1.0, 3.0) : new THREE.Color(2.0, 0.7, 3.0);
    const s = add(T.glow, c); logo.sparks.push({ s, a: rr() * 6.28, sp: 1.5 + rr() * 5, y: (rr() - 0.5) * 2, z: (rr() - 0.5) * 3, t0: rr() * 0.6 });
  }
}

function updateLogo(t) {
  const lt = t - 15.2;
  logo.cam.position.set(Math.sin(lt * 0.3) * 0.5, 0.0, lerp(14.5, 12.0, easeOut(lt / 3.6)));
  logo.cam.lookAt(0, -0.2, 0);
  logo.letters.forEach((m) => {
    const d = m.userData;
    const a = lt - 0.15 - d.delay;
    const k = easeOutExpo(a / 0.85);
    m.visible = a > 0;
    m.position.copy(vlerp(d.start, d.final, k));
    m.rotation.set(d.rot.x * (1 - k), d.rot.y * (1 - k), d.rot.z * (1 - k));
    m.scale.setScalar(lerp(0.3, 1, k));
    // energy flicker once assembled
    const f = 1.45 + 0.12 * Math.sin(lt * 23 + d.delay * 40) * Math.exp(-Math.max(0, a - 0.8) * 1.5);
    m.material.color.setRGB(f, f, f * 1.07);
    m.material.opacity = clamp(a / 0.15);
  });
  const settled = lt - 1.25;
  logo.sub.material.opacity = clamp((lt - 1.45) / 0.4);
  logo.sub.position.y = -0.85 - (1 - easeOut((lt - 1.45) / 0.5)) * 0.25;
  logo.tag.material.opacity = clamp((lt - 2.3) / 0.5);
  logo.tag.position.x = (1 - easeOut((lt - 2.3) / 0.6)) * -0.6;
  const pulse = settled > 0 ? Math.exp(-settled * 2.5) : 0;
  for (const [r, dir] of [[logo.rays, 1], [logo.rays2, -1]]) {
    r.visible = lt > 0.9;
    r.material.opacity = clamp((lt - 0.9) / 0.4) * (0.55 + 0.6 * pulse);
    const rs = 7.5 + pulse * 3 + lt * 0.3;
    r.scale.set(rs * 1.7, rs, 1);
    r.material.rotation = lt * 0.1 * dir + (dir < 0 ? 0.6 : 0);
  }
  logo.streak.visible = lt > 1.0;
  logo.streak.material.opacity = clamp((lt - 1.0) / 0.2) * (0.35 + 1.2 * pulse);
  logo.streak.scale.set(18 + pulse * 8, 0.35, 1);
  const gk = (lt - 1.85) / 0.6;
  logo.glint.visible = logo.glintH.visible = gk > 0 && gk < 1;
  const gx = lerp(-logo.total / 2 - 0.5, logo.total / 2 + 0.5, ease(gk));
  logo.glint.position.set(gx, 0.45, 0.4); logo.glint.scale.set(0.5, 0.5, 1);
  logo.glintH.position.set(gx, 0.45, 0.42); logo.glintH.scale.set(2.4, 0.12, 1);
  logo.glint.material.opacity = logo.glintH.material.opacity = 0.6 * Math.sin(Math.PI * clamp(gk));
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


// ------------------------------------------------------------------ lightning state
function lightning(t) {
  let best = { v: 0, e: null };
  for (const e of EVENTS) {
    const v = strikeEnv(t, e.t, e.dur || 0.35) * e.s;
    e.bolt.visible = !e.hidden && v > 0.3;
    if (e.bolt.visible) e.bolt.userData.mats[1].opacity = 0.35 * v;
    if (v > best.v) best = { v, e };
  }
  return best;
}

// ------------------------------------------------------------------ cameras
const params = {};
function setupShot(t) {
  const sh = shotAt(t), u = (t - sh.t0) / (sh.t1 - sh.t0);
  let pos, look, fov = 40, roll = 0, up = null;
  Object.assign(params, { bloom: 0.6, radial: 0, chroma: 0.0015, flash: 0, fade: 0, sat: 1.1, focus: V3(0, 0, 0) });
  const shake = (amp, f = 1) => V3(noise1(t * 9 * f, 1) * amp, noise1(t * 9 * f, 7) * amp, noise1(t * 9 * f, 13) * amp * 0.5);
  const P = planePos(t);
  switch (sh.id) {
    case 'storm':
      pos = P.clone().add(V3(-62 + 10 * u, 14 - 4 * u, 34 - 14 * u)).add(shake(0.15, 0.6));
      look = P.clone().add(V3(4, -2, -4));
      fov = 38; params.fade = 1 - easeOut(t / 0.7); roll = 0.05;
      break;
    case 'ramp': {
      const lp = V3(0.45, 0.25, 0.5 + u * 2.5), ll = V3(0, -0.6, 16);
      pos = plane.localToWorld(lp).add(shake(0.04, 2)); look = plane.localToWorld(ll);
      fov = 46; params.bloom = 0.7;
      break;
    }
    case 'fall': {
      const Hh = heroFall(t);
      pos = Hh.clone().add(V3(1.2, -5.2, 2.8)).add(shake(0.12, 2));
      look = Hh.clone().add(V3(0, 1.2, 0));
      fov = 52; roll = 0.25 * Math.sin(t * 1.3); params.chroma = 0.003;
      break;
    }
    case 'dive':
      pos = vlerp(V3(-30, 470, -60), V3(-14, 300, -26), easeIn(u * 0.7 + 0.3 * u));
      look = V3(0, 0, 0); up = V3(0, 0, -1);
      fov = 58; params.radial = 0.012; params.focus = V3(0, 0, 0); params.chroma = 0.003;
      break;
    case 'canopy': {
      const G = canopyPos(t);
      pos = G.clone().add(V3(5.6, -1.4, 6.2)).add(shake(0.06 + (t < 7.8 ? 0.2 * Math.exp(-(t - 7.42) * 6) * (t > 7.42) : 0), 2));
      look = G.clone().add(V3(0, 3.0, 0));
      fov = 44;
      break;
    }
    case 'rivals':
      pos = vlerp(V3(1.9, 0.5, 5.4), V3(1.3, 0.58, 4.4), ease(u));
      look = V3(-0.6, 1.5, -12);
      fov = 40; params.bloom = 0.7;
      break;
    case 'lookup': {
      const R = RIVALS[1].end;
      pos = vlerp(V3(R.x + 0.45, 1.2, R.z + 2.5), V3(R.x + 0.35, 1.25, R.z + 2.15), ease(u));
      look = V3(R.x, 1.55, R.z);
      fov = 36;
      break;
    }
    case 'land': {
      pos = vlerp(V3(-2.7, 0.32, 3.7), V3(-2.4, 0.3, 3.2), ease(u));
      const dt = t - T_LAND;
      if (dt > 0) pos.add(shake(0.12 * Math.exp(-dt * 4), 3));
      look = V3(0, 2.1 - 0.4 * ease((t - T_LAND) / 0.6), 0);
      fov = 44; params.bloom = 0.75;
      break;
    }
    case 'strike': {
      const dt = t - T_STRIKE;
      const amp = dt > 0 ? 0.2 * Math.exp(-dt * 2.2) : 0;
      pos = vlerp(V3(0.3, 1.0, 7.8), V3(0.3, 1.1, 6.6), ease(u)).add(shake(amp, 3));
      look = V3(0, 2.1, 0).add(shake(amp * 0.5, 3));
      fov = 44;
      params.bloom = dt > 0 ? 0.6 + 0.35 * Math.exp(-dt * 3) : 0.6;
      params.chroma = 0.0015 + (dt > 0 ? 0.007 * Math.exp(-dt * 3) : 0);
      params.flash = clamp((t - 14.92) / 0.28) ** 2 + (dt > 0 && dt < 0.1 ? 0.3 * (1 - dt / 0.1) : 0);
      break;
    }
  }
  camera.fov = fov;
  camera.position.copy(pos);
  camera.up.copy(up || V3(Math.sin(roll), Math.cos(roll), 0));
  camera.lookAt(look);
  camera.updateProjectionMatrix();
  return sh;
}

function canopyPos(t) {
  const u = clamp((t - 7.3) / 1.7);
  return V3(-10 + 4 * u, 72 - 16 * u, -16 + 6 * u);
}

function rivalPos(i, t) {
  const r = RIVALS[i];
  const k = easeOut((t - 9.0) / 2.6);
  const p = vlerp(r.start, r.end, k);
  // flinch back after the landing
  const away = r.end.clone().setY(0).normalize();
  p.addScaledVector(away, 0.5 * easeOut((t - T_LAND) / 0.4));
  // blown away by the strike
  const dt = t - T_STRIKE - 0.03;
  let rot = 0, fade = 1;
  if (dt > 0) {
    p.addScaledVector(away, 11 * easeOut(dt / 0.9));
    p.y += Math.max(0, 6 * dt - 9 * dt * dt);
    rot = -Math.sign(r.end.x || 1) * Math.min(1.4, dt * 3.5);
    fade = clamp(1.6 - dt * 1.4);
  }
  const walking = k < 0.98 && dt <= 0;
  p.y += walking ? Math.abs(Math.sin(t * 7 + i)) * 0.05 : 0;
  return { p, rot, fade };
}

// ------------------------------------------------------------------ per-time scene update
function updateScene(t) {
  const sh = shotAt(t), tau = animTime(t);
  const L = lightning(t);
  const flash = L.v;
  const fpos = L.e ? L.e.b.clone().lerp(L.e.a, 0.5) : V3(0, 300, -300);

  sky.material.uniforms.uTime.value = tau;
  sky.material.uniforms.uFlash.value = flash;
  sky.material.uniforms.uFlashDir.value.copy(fpos).sub(camera.position).normalize();
  clouds.update(flash, fpos);

  const aerial = AERIAL.includes(sh.id) || sh.id === 'canopy';
  scene.fog.density = aerial ? 0.0006 : 0.022;
  const fc = Math.min(flash, 1);
  scene.fog.color.setRGB(0.045 + 0.06 * fc, 0.04 + 0.05 * fc, 0.08 + 0.1 * fc);
  hemi.intensity = (aerial ? 1.6 : 0.7) + 1.2 * fc;
  moon.intensity = aerial ? 1.4 : 0.5;
  flashLight.intensity = 3 * fc;
  flashLight.position.copy(fpos);
  flashLight.target.position.set(0, 0, 0);
  if (sh.id === 'strike' && L.e && L.e.t === T_STRIKE) { flashLight.position.set(10, 300, -140); }

  // plane
  plane.position.copy(planePos(t));
  plane.visible = ['storm', 'ramp'].includes(sh.id);
  plane.rotation.set(0, 0, 0.04 * Math.sin(t * 0.8));
  plane.updateMatrixWorld(true);
  plane.userData.nav.forEach((n, i) => (n.visible = i < 2 || (t * 1.5) % 1 < 0.12));

  flare.update(tau, true);
  beacon.visible = ['dive', 'canopy'].includes(sh.id);
  beacon.scale.setScalar(sh.id === 'dive' ? 70 : 22);
  rain.update(tau, camera, GROUND.includes(sh.id) || sh.id === 'canopy');

  burst.update(t, T_STRIKE + 0.03, V3(0, 1.4, 0));
  dust.update(t, T_LAND, V3(0, 0.6, 0));

  // characters
  for (const c of [chars.heroFull, chars.heroSky, chars.rivalBust, ...chars.rivals]) c.visible = false;
  chute.visible = false;
  const face = (c) => c.lookAt(camera.position.x, c.position.y, camera.position.z);
  const hf = chars.heroFull;

  if (sh.id === 'ramp') {
    hf.visible = true;
    let lp;
    if (t < 3.7) lp = V3(0, -1.6, lerp(5.5, 11.2, easeOut((t - 2.6) / 1.1)));
    else if (t < 4.0) lp = V3(0, -1.6, 11.2);
    else { const k = (t - 4.0) / 0.3; lp = V3(0, -1.6 - 3 * k * k, 11.2 + 4 * k); }
    hf.position.copy(plane.localToWorld(lp));
    face(hf);
    const f = strikeEnv(t, 3.3) ;
    hf.userData.base.material.color.setRGB(0.25 + 0.4 * f, 0.12 + 0.35 * f, 0.14 + 0.6 * f);
    hf.userData.rim.material.color.setRGB(1.6 + 2 * f, 0.4 + 1.6 * f, 0.4 + 3 * f);
    hf.userData.rim.material.opacity = 1;
  }
  if (sh.id === 'fall') {
    const c = chars.heroSky; c.visible = true;
    const Hh = heroFall(t);
    const k = easeIn((t - 5.6) / 0.4);
    c.position.copy(Hh).add(V3(1.2, -5.2, 2.8).multiplyScalar(k * 1.25));
    c.lookAt(camera.position);
    c.userData.base.material.color.setRGB(0.7 + 0.8 * flash, 0.65 + 0.7 * flash, 0.8 + 1.0 * flash);
    c.userData.rim.material.opacity = 0.6 + flash;
  }
  if (sh.id === 'canopy') {
    const G = canopyPos(t);
    hf.visible = true; hf.position.copy(G); face(hf);
    hf.userData.base.material.color.setRGB(0.55 + flash, 0.5 + flash, 0.7 + flash);
    hf.userData.rim.material.opacity = 0.7 + flash;
    chute.visible = t > 7.42;
    chute.position.copy(G).add(V3(0, 1.7, 0));
    chute.rotation.set(0, 0.5, 0.05 * Math.sin(t * 2));
    const o = clamp((t - 7.42) / 0.38);
    const s = o < 1 ? 0.15 + 0.85 * easeOutExpo(o) * (1 + 0.12 * Math.sin(o * 9) * (1 - o)) : 1;
    chute.scale.set(s, lerp(0.4, 1, o), s);
  }
  const showRivals = ['rivals', 'land', 'strike'].includes(sh.id);
  if (showRivals) {
    chars.rivals.forEach((c, i) => {
      const st = rivalPos(i, t);
      c.visible = st.fade > 0.01;
      c.position.copy(st.p); face(c);
      c.rotateZ(st.rot);
      c.userData.base.material.color.setRGB(0.55 + 0.6 * fc, 0.52 + 0.55 * fc, 0.62 + 0.8 * fc);
      c.userData.base.material.opacity = st.fade;
      c.userData.rim.material.opacity = (0.5 + flash) * st.fade;
    });
  }
  if (sh.id === 'lookup') {
    const R = RIVALS[1].end, c = chars.rivalBust;
    c.visible = true; c.position.set(R.x, 0.95, R.z); c.lookAt(camera.position);
    c.userData.base.material.color.setRGB(0.6 + 0.7 * fc, 0.58 + 0.65 * fc, 0.7 + 0.9 * fc);
    c.userData.rim.material.opacity = 0.8 + flash;
  }
  if (sh.id === 'land' || sh.id === 'strike') {
    hf.visible = true;
    const k = easeIn((t - 11.6) / (T_LAND - 11.6));
    const y = t < T_LAND ? lerp(16, 1.1, k) : 1.1;
    hf.position.set(0, y, 0); face(hf);
    const sq = t > T_LAND ? 1 - 0.08 * Math.exp(-(t - T_LAND) * 8) * Math.cos((t - T_LAND) * 20) : 1;
    hf.scale.set(1, sq, 1);
    const ds = t - T_STRIKE;
    const glow = ds > 0 ? Math.exp(-ds * 1.3) : 0;
    hf.userData.base.material.color.setRGB(0.5 + 0.5 * fc + 0.3 * glow, 0.48 + 0.45 * fc + 0.15 * glow, 0.6 + 0.7 * fc + 0.5 * glow);
    hf.userData.rim.material.color.setRGB(0.8 + 2 * glow, 0.6 + 1.2 * glow, 1.6 + 3 * glow);
    hf.userData.rim.material.opacity = 0.8 + 0.2 * glow;
  }
}

// ------------------------------------------------------------------ render
function renderAt(t) {
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

const SUBFRAMES = { storm: 2, ramp: 2, fall: 3, dive: 3, canopy: 2, rivals: 1, lookup: 1, land: 2, strike: 2, logo: 2 };

function drawDropOverlay(g, t) {
  const S = H / 1080, X = DROP_TEXT;
  lowerThird(g, t, 0.45, 2.5, [{ text: X.hook1, size: 140 }], 130 * S, H - 120 * S, S);
  lowerThird(g, t, 2.85, 4.25, [{ text: X.hook2, size: 120 }], 130 * S, H - 120 * S, S);
  lowerThird(g, t, 6.1, 7.25, [{ text: X.beat3, size: 78 }], 130 * S, H - 120 * S, S);
  bigPunch(g, t, 13.45, 14.95, X.punch, W, H, S, ['#ffffff', '#cbbcff', '#8a4dff', 'rgba(140,80,255,0.95)']);
  killfeed(g, t, 13.75, 15.0, X.kills, W, H, S, boltIcon);
}

window.renderFrame = (t) => {
  const sh = shotAt(t);
  const K = +(Q.get('mb') ?? -1) >= 0 ? +Q.get('mb') : SUBFRAMES[sh.id];
  const shutter = 0.5 / FPS;
  let a = 0;
  for (let k = 0; k < K; k++) {
    let ts = K > 1 ? t + (k / (K - 1) - 0.5) * shutter : t;
    ts = Math.min(Math.max(ts, sh.t0), sh.t1 - 1e-4);
    renderAt(ts);
    accQuad.material.uniforms.tNew.value = rtScene.texture;
    accQuad.material.uniforms.tPrev.value = rtAcc[1 - a].texture;
    accQuad.material.uniforms.w.value = 1 / (k + 1);
    renderer.setRenderTarget(rtAcc[a]);
    accQuad.render(renderer);
    a = 1 - a;
  }
  if (sh.id === 'logo') {
    Object.assign(params, { bloom: 0.75, radial: 0, chroma: 0.0012, fade: clamp((t - 19.0) / 0.38), sat: 1.1 });
    params.flash = Math.max(0, 1 - (t - 15.2) / 0.35) ** 2;
  } else setupShot(t);
  texPass.map = rtAcc[1 - a].texture;
  bloom.strength = params.bloom;
  const U = finalPass.uniforms;
  U.uTime.value = t; U.uRadial.value = params.radial; U.uChroma.value = params.chroma;
  U.uFlash.value = params.flash; U.uFade.value = params.fade; U.uSat.value = params.sat;
  if (params.radial > 0) { const p = params.focus.clone().project(camera); U.uCenter.value.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5); }
  else U.uCenter.value.set(0.5, 0.5);
  renderer.setRenderTarget(null);
  composer.render();
  og.clearRect(0, 0, W, H);
  og.drawImage(renderer.domElement, 0, 0);
  drawDropOverlay(og, t);
  return true;
};
window.frameData = () => overlay.toDataURL('image/png');

(async () => {
  await document.fonts.load('120px Anton');
  await document.fonts.load('700 30px Rajdhani');
  const loadImg = async (u) => { const i = new Image(); i.src = u; await i.decode(); return i; };
  const brand = { wordmark: await loadImg('/brand/wordmark.png') };
  await buildChars(brand);
  await buildLogo();
  window.DURATION = DURATION;
  window.FPS = FPS;
  window.ready = true;
})().catch(e => { window.initError = String(e && e.stack || e); });
