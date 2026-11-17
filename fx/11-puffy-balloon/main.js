// 11 ぷっくり風船文字：平らな文字に空気が入って膨らみ、つつくとぷるんと揺れる
// 定番の作り方：押し出しを薄く、角の丸み（ベベル）を大きくすると、風船のような立体になる
// 使う関数：easeOutElastic（ペナー）、ばね（二次の動き）、expImpulse（キレス）
import { run, chip, range01, lerp, VIVID } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { easeOutElastic, easeInOutCubic } from '../lib/easing.js';
import { SecondOrder } from '../lib/spring.js';
import { expImpulse } from '../lib/iq.js';

chip('押し出し＋大きなベベル＝風船文字<small>MeshPhysicalMaterial（クリアコート）／ easeOutElastic で膨らむ</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#ffeef6' });
shadowFloor(scene, -1.25, 0.16);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const COLORS = [VIVID[0], VIVID[2], VIVID[3], VIVID[4]];
const letters = textGeometries('ぷっくり', glyphs, { size: 3.4, depth: 0.02, bevel: 0.075, bevelSeg: 10, gap: 0.02 }).map((g, i) => {
  const mat = new THREE.MeshPhysicalMaterial({ color: COLORS[i], roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
  const mesh = new THREE.Mesh(g.geo, mat);
  mesh.castShadow = true;
  scene.add(mesh);
  return { ...g, mesh, start: 0.4 + i * 0.35, wob: null };
});
const POKES = [[4.2, 1], [4.9, 3], [5.5, 0], [5.6, 2]];   // [時刻, 何文字目をつつくか]

function setup() { for (const L of letters) L.wob = new SecondOrder(2.2, 0.18, 0, 1); }

function update(t, dt) {
  for (const L of letters) {
    // つつかれた瞬間、目標の大きさを一瞬つぶす → ばねで、ぷるぷる戻る
    let poke = 0;
    for (const [pt, idx] of POKES) if (Math.abs(idx - L.i) <= 1) poke += (idx === L.i ? 1 : 0.4) * expImpulse(Math.max(0, t - pt), 18) * (t > pt ? 1 : 0);
    L.s = L.wob.update(dt, 1 - 0.45 * poke);
  }
}

function render(t) {
  for (const L of letters) {
    const u = range01(t, L.start, L.start + 2.2);
    const inflate = easeOutElastic(u);                         // 厚み方向に膨らむ
    const s = L.s;
    L.mesh.scale.set((0.85 + 0.15 * inflate) * (2 - s), (0.85 + 0.15 * inflate) * s, Math.max(0.02, inflate) * (2 - s));
    L.mesh.position.set(L.x, L.y + 0.12 * Math.sin(t * 1.6 + L.i) * range01(t, 2, 3), 0);
    L.mesh.rotation.set(0.05 * Math.sin(t * 1.1 + L.i), 0.08 * Math.sin(t * 0.9 + L.i * 2), 0.04 * Math.sin(t * 1.3 + L.i));
  }
  // カメラ：真正面（平らに見える）→ 横へ回り込んで厚みを見せる → 正面寄りに戻る
  const a = easeInOutCubic(range01(t, 0.8, 3.6)), b = easeInOutCubic(range01(t, 6.2, 7.8));
  orbit(camera, { yaw: lerp(0, -0.75, a) + lerp(0, 0.6, b), pitch: lerp(0.05, 0.22, a), dist: lerp(16, 19, a), target: [0, -0.1, 0] });
  draw();
}

run({ setup, update, render, loop: 8.5, fonts: [] });
