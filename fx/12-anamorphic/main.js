// 12 見る角度で読める文字（アナモルフォーシス）：空中にばらまかれたブロックが、ある一点から見たときだけ文字になる
// 定番の作り方：文字の点ごとに「魔法の視点」からの光線を引き、その線上のばらばらの奥行きにブロックを置く。
//              遠くに置くものほど大きくすると、魔法の視点からは同じ大きさに見える
// 使う関数：easeInOutCubic（ペナー）、乱数
import { W, H, run, chip, range01, lerp, rng, FONT, VIVID } from '../lib/stage.js';
import { THREE, threeStage, orbit } from '../lib/three-stage.js';
import { samplePoints } from '../lib/glyph.js';
import { easeInOutCubic, easeInOutSine } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';

chip('アナモルフォーシス：魔法の視点からだけ文字に見える<small>光線の上の、ばらばらの奥行きにブロックを置く</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#f6efff', shadows: false });

const EYE = new THREE.Vector3(0, 0, 22);           // 魔法の視点
const SCALE = 0.0135;                              // 画面 1px = 0.0135（z=0 の面で）
const rand = rng(21);
const pts = samplePoints('かわいいは、作れる！', `800 170px ${FONT}`, 9, W, H);
const box = new THREE.BoxGeometry(1, 1, 1);
const mesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.05 }), pts.length);
const m = new THREE.Matrix4(), q = new THREE.Quaternion(), color = new THREE.Color();
pts.forEach(([x, y], i) => {
  const P = new THREE.Vector3((x - W / 2) * SCALE, -(y - H / 2) * SCALE, 0);
  const dir = P.clone().sub(EYE);
  const k = lerp(0.45, 1.7, rand());                 // 光線のどこに置くか（1 で z=0 の面）
  const pos = EYE.clone().add(dir.multiplyScalar(k));
  const s = 9 * SCALE * k * 0.98;                    // 遠いほど大きく
  q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
  // 魔法の視点からは四角に見えるよう、回転は視線のまわりだけにする
  q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), EYE.clone().sub(pos).normalize());
  m.compose(pos, q, new THREE.Vector3(s, s, s));
  mesh.setMatrixAt(i, m);
  mesh.setColorAt(i, color.set(VIVID[Math.floor(((x - 150) / (W - 300)) * VIVID.length) % VIVID.length]));
});
scene.add(mesh);
// まわりに飾りの浮遊ブロック（どこから見ても文字にならない）
const deco = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), 160);
for (let i = 0; i < 160; i++) {
  const p = new THREE.Vector3((rand() - 0.5) * 40, (rand() - 0.5) * 22, (rand() - 0.5) * 30 - 6);
  m.compose(p, q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, 0)), new THREE.Vector3(0.18, 0.18, 0.18));
  deco.setMatrixAt(i, m);
}
scene.add(deco);

function render(t) {
  // カメラ：横から（ばらばら）→ 魔法の視点に着地（文字が現れる）→ また反対側へ回り込む
  const into = easeInOutCubic(range01(t, 0.3, 4.6));
  const away = easeInOutCubic(range01(t, 6.6, 9.4));
  const yaw = lerp(1.15, 0, into) + lerp(0, -1.05, away);
  const pitch = lerp(0.5, 0, into) + lerp(0, -0.35, away);
  const dist = lerp(30, 22, into) + lerp(0, 8, away);
  orbit(camera, { yaw, pitch, dist, target: [0, 0, 0], roll: lerp(0.25, 0, into) });
  // ぴったり合った瞬間に、ブロック全体が少しだけ跳ねる（揃った合図）
  mesh.scale.setScalar(1 + 0.012 * expImpulse(Math.max(0, t - 4.6), 6));
  deco.rotation.y = t * 0.05;
  draw();
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
