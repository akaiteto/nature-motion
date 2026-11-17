// 3D 素材の言葉
// 「てつ」「ゴム」「とうふ」「プリン」「ガラス」を、その言葉どおりの素材で作って落とす。
//   ・見た目：three.js の材質（金属・つや消し・半透明・ガラス）＋プログラムで描いた模様
//   ・物理：cannon-es。言葉ごとに重さ・跳ね返り・摩擦を変える
//   ・壊れ方：とうふ＝四角く崩れる、ガラス＝破片が飛ぶ、プリン＝べちゃっとつぶれてぷるぷる、ゴム＝跳ね返す、てつ＝へこむだけ
// 文字の立体：フォントの輪郭（glyphs.json）を押し出す。当たり判定は輪郭をマス目にして小さな箱を並べたもの。
// ?capture を付けると自動再生を止め、window.__frame(n) で n コマ目まで進める（動画書き出し用）。
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1280, H = 720, FPS = 60, DT = 1 / FPS;
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
let seed = +(params.get('seed') || 1);
const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const range = (a, b) => a + (b - a) * rand();

const SIZE = 1.5, DEPTH = 0.45, GRID = 9;

// ---------- 言葉と素材 ----------
const WORDS = [
  { text: 'てつ', cap: 'てつ：重い・弾まない・へこむ', mass: 5, rest: 0.02, fric: 0.6, kind: 'iron' },
  { text: 'ゴム', cap: 'ゴム：よく弾む', mass: 0.8, rest: 0.92, fric: 0.9, kind: 'rubber' },
  { text: 'とうふ', cap: 'とうふ：軽い・崩れる', mass: 0.5, rest: 0.05, fric: 0.8, kind: 'tofu', breakAt: 3.2 },
  { text: 'プリン', cap: 'プリン：ぷるぷる・つぶれる', mass: 0.9, rest: 0.2, fric: 0.7, kind: 'pudding', splatAt: 4 },
  { text: 'ガラス', cap: 'ガラス：割れて飛び散る', mass: 1.2, rest: 0.35, fric: 0.3, kind: 'glass', breakAt: 4.5 }
];
const LANE = 5.6;
WORDS.forEach((w, i) => (w.x = (i - 2) * LANE));

// ---------- 画面 ----------
const wrap = document.getElementById('wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
wrap.prepend(renderer.domElement);
renderer.domElement.id = 'stage';
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); wrap.style.transformOrigin = 'center'; wrap.style.transform = `translate(-50%,-50%) scale(${s})`; }
addEventListener('resize', fit); fit();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#fbe9f2');
scene.fog = new THREE.Fog('#fbe9f2', 30, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 200);
camera.position.set(0, 4.4, 27); camera.lookAt(0, 2.6, 0);

scene.add(new THREE.HemisphereLight('#ffffff', '#f3c6d8', 0.9));
const sun = new THREE.DirectionalLight('#ffffff', 2.2);
sun.position.set(-8, 16, 10); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -6, near: 1, far: 50 });
sun.shadow.radius = 4;
scene.add(sun);

const floorMat = new THREE.MeshStandardMaterial({ color: '#e9bfd3', roughness: 0.95 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// レーンの線
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 9), new THREE.MeshBasicMaterial({ color: '#efc3d6' }));
  m.rotation.x = -Math.PI / 2; m.position.set((i - 2.5) * LANE, 0.002, 0); scene.add(m);
}

// ---------- 物理 ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0) });
world.allowSleep = false;
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 12;
const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material('ground') });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
// 奥と手前の見えない壁（レーンから落ちないように）
for (const z of [-2.2, 2.2]) {
  const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(40, 10, 0.1)) });
  wall.position.set(0, 10, z); world.addBody(wall);
}
// レーンの間の見えない仕切り（ゴムが隣に飛び込まないように）
for (let i = 0; i < 6; i++) {
  const wall = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(0.35, 12, 3)) }); wall.isWall = true;
  wall.position.set((i - 2.5) * LANE, 12, 0); world.addBody(wall);
}

// ---------- 模様（プログラムで描くテクスチャ） ----------
function canvasTex(draw, size = 256, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ironTex = canvasTex((g, s) => {
  g.fillStyle = '#9aa0ad'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '40,40,55'},${range(0.02, 0.08)})`; g.fillRect(0, range(0, s), s, range(0.5, 2)); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(170,90,50,${range(0.15, 0.35)})`; g.beginPath(); g.arc(range(0, s), range(0, s), range(3, 14), 0, 7); g.fill(); }
}, 256, 2);
const tofuTex = canvasTex((g, s) => {
  g.fillStyle = '#fff3dc'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(230,215,190,${range(0.1, 0.35)})`; g.fillRect(range(0, s), range(0, s), 1.5, 1.5); }
}, 256, 2);
const rubberTex = canvasTex((g, s) => {
  g.fillStyle = '#ff7a9c'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(150,30,70,${range(0.05, 0.15)})`; g.fillRect(range(0, s), range(0, s), 2, 2); }
}, 256, 3);

const MATS = {
  iron: new THREE.MeshStandardMaterial({ map: ironTex, metalness: 1, roughness: 0.38, color: '#c9ced8' }),
  rubber: new THREE.MeshStandardMaterial({ map: rubberTex, roughness: 0.75 }),
  tofu: new THREE.MeshPhysicalMaterial({ map: tofuTex, roughness: 0.9, sheen: 0.6, sheenColor: new THREE.Color('#fff6e0') }),
  pudding: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: '#a9dcff', metalness: 0, roughness: 0.05, transmission: 0.92, thickness: 1.2, ior: 1.5, attenuationColor: new THREE.Color('#4aa8e8'), attenuationDistance: 0.9, specularIntensity: 1, clearcoat: 1 })
};

// ---------- 文字の立体 ----------
let GLYPHS;
const geoCache = {};
function glyphData(ch) {
  if (geoCache[ch]) return geoCache[ch];
  const g = GLYPHS[ch];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const c of g.outline) for (let i = 1; i < c.length; i += 2) { minX = Math.min(minX, c[i]); maxX = Math.max(maxX, c[i]); minY = Math.min(minY, c[i + 1]); maxY = Math.max(maxY, c[i + 1]); }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  // 輪郭 → 形（em 座標を中心合わせして SIZE 倍）
  const sp = new THREE.ShapePath();
  const X = v => (v - cx) * SIZE, Y = v => (v - cy) * SIZE;
  for (const c of g.outline) {
    const [op, ...p] = typeof c === 'string' ? [c] : c;
    if (op === 'M') sp.moveTo(X(p[0]), Y(p[1]));
    else if (op === 'L') sp.lineTo(X(p[0]), Y(p[1]));
    else if (op === 'Q') sp.quadraticCurveTo(X(p[0]), Y(p[1]), X(p[2]), Y(p[3]));
    else if (op === 'C') sp.bezierCurveTo(X(p[0]), Y(p[1]), X(p[2]), Y(p[3]), X(p[4]), Y(p[5]));
  }
  const shapes = sp.toShapes(true);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -DEPTH / 2);
  geo.computeVertexNormals();
  // 当たり判定用のマス目：輪郭をキャンバスに塗って、塗られたマスを拾う
  const R = 128, cv = document.createElement('canvas'); cv.width = cv.height = R;
  const ctx = cv.getContext('2d');
  const span = Math.max(maxX - minX, maxY - minY);
  const toPx = (x, y) => [(x - cx) / span * R * 0.98 + R / 2, R / 2 - (y - cy) / span * R * 0.98];
  ctx.beginPath();
  for (const c of g.outline) {
    const [op, ...p] = typeof c === 'string' ? [c] : c;
    const pts = []; for (let i = 0; i < p.length; i += 2) pts.push(...toPx(p[i], p[i + 1]));
    if (op === 'M') ctx.moveTo(pts[0], pts[1]); else if (op === 'L') ctx.lineTo(pts[0], pts[1]);
    else if (op === 'Q') ctx.quadraticCurveTo(...pts); else if (op === 'C') ctx.bezierCurveTo(...pts); else ctx.closePath();
  }
  ctx.fill('nonzero');
  const img = ctx.getImageData(0, 0, R, R).data, cells = [], cs = R / GRID;
  for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
    let n = 0;
    for (let y = Math.floor(gy * cs); y < (gy + 1) * cs; y++) for (let x = Math.floor(gx * cs); x < (gx + 1) * cs; x++) if (img[(y * R + x) * 4 + 3] > 128) n++;
    if (n / (cs * cs) > 0.3) {
      const cell = span * SIZE * 0.98 / GRID;
      cells.push({ x: (gx + 0.5 - GRID / 2) * cell, y: (GRID / 2 - gy - 0.5) * cell, s: cell });
    }
  }
  return (geoCache[ch] = { geo, cells });
}
function puddingColors(geo) {
  // 上のほうはカラメル色、下はプリン色
  geo.computeBoundingBox();
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), b = geo.boundingBox;
  const a = new THREE.Color('#ffd86b'), c = new THREE.Color('#9a4f1c'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const k = THREE.MathUtils.smoothstep((pos.getY(i) - b.min.y) / (b.max.y - b.min.y), 0.62, 0.8);
    tmp.copy(a).lerp(c, k); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// ---------- 物体の管理 ----------
const things = []; // { mesh, body, word, kind, squash:{v,s}, ... }
const pending = [];
const physMat = {};
function bodyMat(w) {
  if (!physMat[w.kind]) {
    const m = new CANNON.Material(w.kind); m.friction = w.fric; m.restitution = w.rest;
    world.addContactMaterial(new CANNON.ContactMaterial(ground.material, m, { friction: w.fric, restitution: w.rest }));
    physMat[w.kind] = m;
  }
  return physMat[w.kind];
}

function spawnChar(w, ch, x, y, z) {
  const { geo, cells } = glyphData(ch);
  let g = geo;
  if (w.kind === 'pudding') { g = geo.clone(); puddingColors(g); }
  const mesh = new THREE.Mesh(g, MATS[w.kind]);
  mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  const body = new CANNON.Body({ mass: w.mass, material: bodyMat(w), linearDamping: 0.05, angularDamping: 0.15 });
  for (const c of cells) body.addShape(new CANNON.Box(new CANNON.Vec3(c.s / 2, c.s / 2, DEPTH / 2 + 0.04)), new CANNON.Vec3(c.x, c.y, 0));
  body.position.set(x, y, 0);
  // 文字が読めるように、手前を向いたまま画面の中だけで回る（奥行き方向には倒れない）
  body.angularFactor.set(0, 0, 1); body.linearFactor.set(1, 1, 0);
  body.quaternion.setFromEuler(0, 0, range(-0.35, 0.35));
  world.addBody(body);
  const t = { mesh, body, w, ch, cells, sq: 0, sqv: 0, splat: 0, broken: false };
  body.addEventListener('collide', e => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (w.kind === 'pudding') t.sqv += v * 1.6;
    if (w.kind === 'iron' && v > 5 && !t.dented) { t.dented = true; pending.push(() => dent(t)); }
    if (w.breakAt && v > w.breakAt && !t.broken && e.body.isBall) { t.broken = true; pending.push(() => shatter(t, e.body)); }
    if (w.splatAt && v > w.splatAt && e.body.isBall) t.splat = 1;
  });
  things.push(t);
  return t;
}

function dropWord(w, t0) {
  const chars = [...w.text];
  chars.forEach((ch, i) => {
    const x = w.x + (i - (chars.length - 1) / 2) * SIZE * 1.02;
    schedule(t0 + i * 0.12, () => spawnChar(w, ch, x + range(-0.05, 0.05), 7 + i * 0.4, range(-0.2, 0.2)));
  });
}

// ---------- 壊れ方 ----------
const fragGeo = { tofu: new THREE.BoxGeometry(1, 1, 1), glass: new THREE.TetrahedronGeometry(0.75) };
function shatter(t, ball) {
  console.log('[mw] break', t.w.kind, t.ch, time.toFixed(2));
  removeThing(t);
  const q = new THREE.Quaternion(t.body.quaternion.x, t.body.quaternion.y, t.body.quaternion.z, t.body.quaternion.w);
  const center = new THREE.Vector3(t.body.position.x, t.body.position.y, t.body.position.z);
  const hit = ball ? new THREE.Vector3(ball.position.x, ball.position.y, ball.position.z) : center.clone().add(new THREE.Vector3(0, 1, 0));
  const pieces = t.w.kind === 'glass' ? 2 : 1;
  for (const c of t.cells) for (let k = 0; k < pieces; k++) {
    const local = new THREE.Vector3(c.x + range(-0.3, 0.3) * c.s * (pieces > 1), c.y + range(-0.3, 0.3) * c.s * (pieces > 1), range(-0.1, 0.1));
    const p = local.applyQuaternion(q).add(center);
    const s = t.w.kind === 'glass' ? c.s * range(0.7, 1.05) : c.s * range(0.75, 0.95);
    const mesh = new THREE.Mesh(fragGeo[t.w.kind], MATS[t.w.kind]);
    mesh.scale.setScalar(s); mesh.castShadow = true; scene.add(mesh);
    const body = new CANNON.Body({ mass: t.w.mass / t.cells.length, material: physMat[t.w.kind], shape: new CANNON.Box(new CANNON.Vec3(s / 2, s / 2, s / 2)), angularDamping: 0.2 });
    body.position.set(p.x, p.y, p.z);
    const away = p.clone().sub(hit).setY(0.2).normalize().multiplyScalar(t.w.kind === 'glass' ? range(4, 8) : range(0.5, 1.6));
    body.velocity.set(away.x, Math.abs(away.y) + (t.w.kind === 'glass' ? range(2, 5) : range(0, 1)), away.z * 0.3);
    body.angularVelocity.set(range(-8, 8), range(-8, 8), range(-8, 8));
    world.addBody(body);
    things.push({ mesh, body, w: t.w, frag: true, sq: 0, sqv: 0 });
  }
  burst(center, t.w.kind === 'glass' ? '#e8fbff' : '#fff8e8', t.w.kind === 'glass' ? 40 : 20);
}
function dent(t) {
  console.log('[mw] dent', t.ch, time.toFixed(2));
  t.mesh.scale.set(1.04, 0.9, 1.04);
  burst(new THREE.Vector3(t.body.position.x, t.body.position.y + 0.6, t.body.position.z), '#ffd27a', 14, true);
}
function removeThing(t) {
  scene.remove(t.mesh); world.removeBody(t.body);
  things.splice(things.indexOf(t), 1);
}

// 小さな粒（ガラスのきらめき・火花・とうふのくず）
const sparks = [];
const sparkGeo = new THREE.SphereGeometry(0.05, 6, 4);
function burst(p, color, n, hot = false) {
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat); m.position.copy(p); scene.add(m);
    sparks.push({ m, v: new THREE.Vector3(range(-4, 4), range(2, hot ? 9 : 6), range(-2, 2)), life: range(0.4, 0.9) });
  }
}

// ---------- ボール ----------
const ballMat = new THREE.MeshPhysicalMaterial({ color: '#7fd9ff', roughness: 0.25, clearcoat: 1 });
const ballCM = new CANNON.Material('ball');
function dropBall(x, y = 11, vy = -4) {
  const r = 0.62;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), ballMat);
  mesh.castShadow = true; scene.add(mesh);
  const body = new CANNON.Body({ mass: 6, shape: new CANNON.Sphere(r), material: ballCM, linearDamping: 0.02 });
  body.isBall = true; body.linearFactor.set(1, 1, 0);
  body.position.set(x, y, 0); body.velocity.set(0, vy, 0);
  world.addBody(body);
  things.push({ mesh, body, ball: true, sq: 0, sqv: 0 });
}

// ---------- 段取り（時間で決まる演出） ----------
const events = [];
function schedule(t, fn) { events.push({ t, fn }); events.sort((a, b) => a.t - b.t); }
let time = 0;

function setup() {
  WORDS.forEach((w, i) => dropWord(w, 0.3 + i * 0.35));
  WORDS.forEach((w, i) => schedule(5 + i * 1.1, () => { const n = [...w.text].length, k = Math.floor(rand() * n); dropBall(w.x + (k - (n - 1) / 2) * SIZE * 1.02, 11, -10); }));
  // ゴム同士・ボールとの接触は、言葉の素材の値を使う
  for (const w of WORDS) world.addContactMaterial(new CANNON.ContactMaterial(ballCM, bodyMat(w), { friction: 0.4, restitution: w.rest }));
  world.addContactMaterial(new CANNON.ContactMaterial(ballCM, ground.material, { friction: 0.4, restitution: 0.4 }));
  // 字幕
  for (const w of WORDS) {
    const d = document.createElement('div'); d.className = 'cap'; d.textContent = w.cap; wrap.appendChild(d); w.capEl = d;
  }
}

function step() {
  while (events.length && events[0].t <= time) events.shift().fn();
  world.step(DT);
  while (pending.length) pending.shift()();
  for (const t of things) {
    // 字は自分のレーンから出ない（はみ出したら壁で跳ね返ったことにする）
    if (t.w && !t.frag) {
      const half = LANE / 2 - 0.75, b = t.body;
      if (b.position.x < t.w.x - half) { b.position.x = t.w.x - half; b.velocity.x = Math.abs(b.velocity.x) * t.w.rest; }
      if (b.position.x > t.w.x + half) { b.position.x = t.w.x + half; b.velocity.x = -Math.abs(b.velocity.x) * t.w.rest; }
    }
    t.mesh.position.copy(t.body.position); t.mesh.quaternion.copy(t.body.quaternion);
    if (t.w && t.w.kind === 'pudding' && !t.frag) {
      // ぷるぷる：ばね（速く揺れて、ゆっくり止まる）
      t.sqv += (-90 * t.sq - 3 * t.sqv) * DT; t.sq += t.sqv * DT;
      const s = Math.max(-0.25, Math.min(0.35, t.sq * 0.05));
      const flat = t.splat ? Math.min(1, (t.flat = (t.flat || 0) + DT * 5)) : 0;
      t.mesh.scale.set(1 + s * 0.6 + flat * 0.35, 1 - s - flat * 0.5, 1 + s * 0.6 + flat * 0.35);
    }
  }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]; s.life -= DT; s.v.y -= 14 * DT; s.m.position.addScaledVector(s.v, DT);
    s.m.scale.setScalar(Math.max(0.01, s.life * 1.5));
    if (s.life <= 0 || s.m.position.y < 0) { scene.remove(s.m); sparks.splice(i, 1); }
  }
  time += DT;
}

function render() {
  for (const w of WORDS) {
    const p = new THREE.Vector3(w.x, 0, 2.2).project(camera);
    w.capEl.style.left = ((p.x + 1) / 2 * W) + 'px';
  }
  renderer.render(scene, camera);
}

// クリックでボール
renderer.domElement.addEventListener('pointerdown', e => {
  const r = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3(); ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit);
  if (hit) dropBall(Math.max(-12, Math.min(12, hit.x)), 11, -8);
});

const res = await fetch('glyphs.json');
GLYPHS = (await res.json()).glyphs;
setup();
document.getElementById('loading').remove();
let frame = 0;
if (CAPTURE) {
  window.__frame = n => { while (frame < n) { step(); frame++; } render(); return frame; };
} else {
  let last = performance.now(), acc = 0;
  renderer.setAnimationLoop(now => {
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) { step(); frame++; acc -= DT; }
    render();
  });
}
window.__ready = true;
