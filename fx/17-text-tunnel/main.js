// 17 文字のトンネル：文字を輪のように並べた環が奥へ何十個も続き、カメラがその中を飛び抜ける
// 定番の作り方：文字を描いた板（テクスチャ）を円周に並べ、環を奥へ並べる。カメラを z 方向に進めるだけ
// 使う関数：easeInOutSine・easeOutBack（ペナー）、expImpulse（キレス）
import { run, chip, range01, lerp, FONT, VIVID, PAL } from '../lib/stage.js';
import { THREE, threeStage } from '../lib/three-stage.js';
import { easeInOutSine, easeOutBack, easeInOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';

chip('文字を円周に並べた環を奥へ並べ、カメラが飛び抜ける<small>PlaneGeometry ＋ CanvasTexture ／ 速さは easeInOutSine</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#2a2140', shadows: false, fog: [20, 70] });

// 1文字のテクスチャ（同じ字は使い回す）
const texCache = {};
function charTex(ch, color) {
  const key = ch + color;
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.font = `800 200px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 22; g.strokeStyle = '#ffffff'; g.lineJoin = 'round';
  g.strokeText(ch, 128, 140); g.fillStyle = color; g.fillText(ch, 128, 140);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (texCache[key] = t);
}

const PHRASE = [...'かわいいは、作れる！'];
const RINGS = 26, PER = 14, R = 4.2, GAPZ = 4;
const plane = new THREE.PlaneGeometry(1.5, 1.5);
const rings = [];
for (let k = 0; k < RINGS; k++) {
  const ring = new THREE.Group();
  for (let j = 0; j < PER; j++) {
    const ch = PHRASE[(j + k) % PHRASE.length];
    const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map: charTex(ch, VIVID[(k + j) % VIVID.length]), transparent: true, side: THREE.DoubleSide, fog: true }));
    const a = (j / PER) * Math.PI * 2;
    m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    m.rotation.z = a - Math.PI / 2;                  // 文字の下側が外を向くように
    ring.add(m);
  }
  ring.position.z = -k * GAPZ;
  scene.add(ring); rings.push(ring);
}
// 出口のタイトル
const title = new THREE.Group();
PHRASE.forEach((ch, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: charTex(ch, VIVID[i % VIVID.length]), transparent: true, fog: false }));
  m.position.x = (i - (PHRASE.length - 1) / 2) * 1.9;
  title.add(m);
});
const END_Z = -RINGS * GAPZ - 30;
title.position.z = END_Z;
scene.add(title);
// 星くず
const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 1500 }, (_, i) => [(Math.sin(i * 12.9898) * 43758.5453 % 1) * 30, (Math.sin(i * 78.233) * 12543.1 % 1) * 30, -(i / 1500) * 130][i % 3]).flat(), 3)),
  new THREE.PointsMaterial({ color: PAL.yellow, size: 0.08 }));
scene.add(stars);

function render(t) {
  // 進み方：ゆっくり出て、加速して、出口で減速（easeInOutSine）
  const k = easeInOutSine(range01(t, 0.3, 7.5));
  const z = lerp(8, END_Z + 21, k);
  camera.position.set(0.6 * Math.sin(t * 0.7), 0.4 * Math.sin(t * 0.9), z);
  camera.up.set(Math.sin(t * 0.35), Math.cos(t * 0.35), 0);     // ゆっくり回転しながら進む
  camera.lookAt(0, 0, z - 10);
  rings.forEach((r, i) => { r.rotation.z = t * (i % 2 ? 0.35 : -0.35); });
  // 出口：タイトルの文字が一つずつ前に出てくる
  title.children.forEach((m, i) => {
    const u = range01(t, 5.6 + i * 0.07, 6.4 + i * 0.07);
    m.scale.setScalar(Math.max(0.001, easeOutBack(u)) * (1 + 0.15 * expImpulse(Math.max(0, t - 8 - i * 0.05), 7)));
  });
  const fin = easeInOutCubic(range01(t, 7.5, 8.5));
  camera.up.lerp(new THREE.Vector3(0, 1, 0), fin);
  camera.lookAt(0, 0, z - 10);
  draw();
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
