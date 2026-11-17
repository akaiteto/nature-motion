// 14 ドミノ回転する立体文字：押し出した文字が、時間差でくるっと回る（横回転 → 縦回転 → リボンのねじれ）
// 定番の作り方：1文字ずつの立体にして、回転の始まりを左から少しずつ遅らせる（スタッガー）
// 使う関数：easeInOutBack・easeInOutCubic（ペナー）
import { run, chip, range01, lerp, VIVID, PAL } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { easeInOutBack, easeInOutCubic } from '../lib/easing.js';

const label = chip('');
const { scene, camera, render: draw } = threeStage({ bg: '#fff4ea' });
shadowFloor(scene, -1.6, 0.14);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const side = new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 0.5 });     // 側面は濃い色にして、立体感を出す
const letters = textGeometries('かわいいは、作れる！', glyphs, { size: 2.0, depth: 0.55, bevel: 0.02, bevelSeg: 3 }).map((g, i) => {
  const face = new THREE.MeshStandardMaterial({ color: VIVID[i % VIVID.length], roughness: 0.35 });
  const mesh = new THREE.Mesh(g.geo, [face, side]);    // ExtrudeGeometry は「表と裏」と「側面」で材質を分けられる
  mesh.castShadow = true;
  const pivot = new THREE.Group(); pivot.position.set(g.x, g.y, 0); pivot.add(mesh);
  scene.add(pivot);
  return { ...g, pivot };
});
const N = letters.length, STAGGER = 0.09;

// 三つの演目：[始まり, 1文字の長さ, 回す軸]
const ACTS = [[0.6, 0.9, 'x'], [3.0, 1.0, 'y'], [5.4, 2.6, 'twist']];

function render(t) {
  let name = '';
  for (const L of letters) {
    const r = new THREE.Euler(0, 0, 0);
    for (const [t0, len, axis] of ACTS) {
      const u = range01(t, t0 + L.i * STAGGER, t0 + L.i * STAGGER + len);
      if (axis === 'twist') r.x += Math.sin(Math.PI * u) * Math.sin(t * 3 - L.i * 0.55) * 1.1;   // リボンのように波打つ
      else r[axis] += Math.PI * 2 * easeInOutBack(u);                                       // 一回転（少し行き過ぎて戻る）
      if (t >= t0) name = axis;
    }
    L.pivot.rotation.copy(r);
  }
  label.innerHTML = { x: '横の軸で一回転：easeInOutBack ＋ 時間差<small>Robert Penner</small>', y: '縦の軸で一回転：easeInOutBack ＋ 時間差<small>Robert Penner</small>', twist: 'リボンのねじれ：sin を文字ごとにずらす<small>位相 = 文字の番号 × 0.55</small>' }[name] || '押し出した立体文字<small>ExtrudeGeometry</small>';
  // カメラ：低い位置から文字の列にそって横移動 → 引いて正面
  const k = easeInOutCubic(range01(t, 0, 7.5));
  orbit(camera, { yaw: lerp(-0.85, 0.25, k), pitch: lerp(0.06, 0.18, k), dist: lerp(11, 21.5, k), target: [lerp(-6, 0, k), -0.3, 0] });
  draw();
}

run({ render, loop: 8.5, fonts: [] });
