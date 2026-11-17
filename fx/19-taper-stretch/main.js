// 19 細める・伸ばす：「びよーん」がゴムのように引き伸ばされ（ストレッチ）、先細り（テーパー）で遠近をおおげさにする
// 使う変形：ストレッチ・テーパー（lib/deform.js、Barr 1984）／ 動き：ばね（二次の動き）、easeInOutSine
import { run, chip, range01, lerp, VIVID } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { mergedText, makeDeformer, faceSideColors } from '../lib/deform.js';
import { SecondOrder } from '../lib/spring.js';
import { easeInOutSine, easeInOutCubic } from '../lib/easing.js';

const label = chip('');
const { scene, camera, render: draw } = threeStage({ bg: '#eefaf4' });
shadowFloor(scene, -2.4, 0.14);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const geo = mergedText(textGeometries('びよーん', glyphs, { size: 2.6, depth: 0.8, bevel: 0.03, bevelSeg: 2 }), 0.12);
geo.computeBoundingBox();
const x0 = geo.boundingBox.min.x, x1 = geo.boundingBox.max.x, COLORS = [VIVID[3], VIVID[4], VIVID[5], VIVID[0]];
faceSideColors(geo, x => new THREE.Color(COLORS[Math.min(3, Math.floor(((x - x0) / (x1 - x0)) * 4))]));
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }));
mesh.castShadow = true; scene.add(mesh);
const deform = makeDeformer(geo);

// 伸びの目標：ぐーっと引っぱる → 離す（ばねで行き過ぎて、ぷるぷる戻る）
const pull = t => (t > 0.6 && t < 2.6 ? lerp(1, 2.1, easeInOutSine(range01(t, 0.6, 2.2))) : 1);
let spring;
function setup() { spring = new SecondOrder(1.8, 0.16, 0, 1); }
let s = 1;
function update(t, dt) { s = spring.update(dt, pull(t)); }

function render(t) {
  // テーパー：右が大きく左が小さい ↔ 逆、を行き来する（遠近のおおげさ）
  const tp = 0.75 * Math.sin(Math.PI * 2 * easeInOutCubic(range01(t, 4.8, 8.4)));
  deform({ stretch: Math.max(0.4, s), taper: tp });
  label.innerHTML = t < 4.6 ? `ストレッチ：x 方向に ${s.toFixed(2)} 倍、断面は 1/√${s.toFixed(2)} 倍<small>ばね（f=1.8, ζ=0.16）で戻る</small>`
    : `テーパー：x に応じて太さを変える<small>係数 ${tp.toFixed(2)} ／ Barr 1984・Blender シンプル変形</small>`;
  // カメラ：伸びるときは横に引いて追い、テーパーでは少し斜めから
  const k = easeInOutCubic(range01(t, 4.4, 5.4)) * (1 - easeInOutCubic(range01(t, 8.6, 9.6)));
  orbit(camera, { yaw: lerp(0.1, 0.42, k), pitch: lerp(0.12, 0.1, k), dist: lerp(lerp(17, 23, range01(s, 1, 2)), 18, k), target: [0, 0, 0] });
  draw();
}

run({ setup, update, render, loop: 10, fonts: [] });
