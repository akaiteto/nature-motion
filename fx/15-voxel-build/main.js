// 15 ブロックで積み上がる文字：ドット絵の文字を立方体にして、下の段から順に空から落として積み上げる
// 定番の作り方：文字をキャンバスに描いて点を拾い、1点 = 1個の立方体（InstancedMesh で何千個でも軽い）
// 使う関数：easeOutBounce（ペナー）、cubicPulse（キレス）
import { W, H, run, chip, range01, lerp, rng, FONT, VIVID } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { samplePoints } from '../lib/glyph.js';
import { easeOutBounce, easeInOutCubic } from '../lib/easing.js';
import { cubicPulse } from '../lib/iq.js';

chip('文字の点 → 立方体を下の段から落として積む<small>InstancedMesh ／ easeOutBounce ／ 波：cubicPulse</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#eef6ff' });
const STEP = 14, U = 0.13;                         // 点の間隔(px)と、立方体1個の大きさ
const floorY = -1.9;
shadowFloor(scene, floorY, 0.2);

const rand = rng(8);
const pts = samplePoints('かわいいは、作れる！', `800 180px ${FONT}`, STEP, W, H);
let minY = Infinity, maxY = -Infinity;
for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
const cubes = [];
for (const [x, y] of pts) for (let z = 0; z < 2; z++) {           // 奥行き2段
  const row = (maxY - y) / STEP;                                   // 下から何段目か
  cubes.push({
    x: ((x - W / 2) / STEP) * U, y: floorY + U / 2 + row * U, z: (z - 0.5) * U,
    start: 0.3 + row * 0.12 + rand() * 0.5 + z * 0.05,
    color: VIVID[Math.floor(((x - 150) / (W - 300)) * VIVID.length) % VIVID.length]
  });
}
const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(U * 0.94, U * 0.94, U * 0.94), new THREE.MeshStandardMaterial({ roughness: 0.4 }), cubes.length);
mesh.castShadow = true; mesh.receiveShadow = true;
const col = new THREE.Color();
cubes.forEach((c, i) => mesh.setColorAt(i, col.set(c.color)));
scene.add(mesh);
const built = Math.max(...cubes.map(c => c.start)) + 0.9;
const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();

function render(t) {
  const wave = ((t - built - 0.4) * 9) % 40 - 8;             // 積み終わったら、左から右へ波が通る
  cubes.forEach((c, i) => {
    const u = range01(t, c.start, c.start + 0.9);
    const y = lerp(c.y + 6, c.y, easeOutBounce(u));
    const bump = t > built ? 0.35 * cubicPulse(wave, 4, c.x / (U * 4) + 20) : 0;
    e.set((1 - u) * 3, (1 - u) * 2, 0);
    p.set(c.x, y + bump, c.z); q.setFromEuler(e); s.setScalar(u > 0 ? 1 : 0);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  // カメラ：上からのぞき込み → ぐるっと回って正面やや下から
  const k = easeInOutCubic(range01(t, 0, built));
  orbit(camera, { yaw: lerp(0.9, 0, k) + 0.08 * Math.sin(t * 0.5), pitch: lerp(0.75, 0.1, k), dist: lerp(24, 16.5, k), target: [0, lerp(-1.5, -0.6, k), 0] });
  draw();
}

run({ render, loop: built + 4, fonts: ['800 40px "M PLUS Rounded 1c"'] });
