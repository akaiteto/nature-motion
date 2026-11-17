// 18 ねじる・曲げる：一列の文字を、雑巾をしぼるようにツイストし、次にベンドで丸めて輪にする
// 使う変形：ツイスト・ベンド（lib/deform.js、Barr 1984）／ 動き：easeInOutCubic・easeOutElastic（ペナー）
import { run, chip, range01, lerp, VIVID } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { mergedText, makeDeformer, faceSideColors } from '../lib/deform.js';
import { easeInOutCubic, easeOutElastic } from '../lib/easing.js';

const label = chip('');
const { scene, camera, render: draw } = threeStage({ bg: '#fff3ea' });
shadowFloor(scene, -3.2, 0.12);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const parts = textGeometries('かわいいは、作れる！', glyphs, { size: 1.9, depth: 0.7, bevel: 0.02, bevelSeg: 2 });
const geo = mergedText(parts, 0.12);
geo.computeBoundingBox();
const x0 = geo.boundingBox.min.x, x1 = geo.boundingBox.max.x;
faceSideColors(geo, x => new THREE.Color(VIVID[Math.min(VIVID.length - 1, Math.floor(((x - x0) / (x1 - x0)) * VIVID.length))]));
const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide }));
mesh.castShadow = true;
scene.add(mesh);
const deform = makeDeformer(geo);

function render(t) {
  // ツイスト：0 → 2周 → ゴムのように戻る
  const tw = easeInOutCubic(range01(t, 0.8, 2.8)) * (1 - easeOutElastic(range01(t, 3.2, 4.6)));
  // ベンド：0 → ほぼ一周の輪 → 戻る
  const bd = easeInOutCubic(range01(t, 5.0, 6.8)) * (1 - easeInOutCubic(range01(t, 8.4, 9.6)));
  deform({ twist: tw * Math.PI * 2, bend: -bd * Math.PI * 0.94 });   // 負の角度＝下向きに曲げる（文字が輪の外側で正立する）
  mesh.position.y = bd * 3.1;                        // 輪は下に垂れるので、そのぶん持ち上げる
  label.innerHTML = bd > 0.01 ? `ベンド：x 軸を円弧に曲げる<small>角度 ${(bd * 338).toFixed(0)}° ／ Barr 1984・Blender シンプル変形</small>`
    : `ツイスト：x に比例した角度で断面を回す<small>角度 ${(tw * 720).toFixed(0)}° ／ Barr 1984・Blender シンプル変形</small>`;
  // カメラ：ツイストは斜め横から、ベンドは正面の少し上から
  const k = easeInOutCubic(range01(t, 4.2, 5.4)) * (1 - easeInOutCubic(range01(t, 9, 10)));
  orbit(camera, { yaw: lerp(-0.6, 0.05, k) + 0.1 * Math.sin(t * 0.6), pitch: lerp(0.18, 0.3, k), dist: lerp(26, 19, k), target: [0, lerp(0, 0.2, k), 0] });
  draw();
}

run({ render, loop: 10, fonts: [] });
