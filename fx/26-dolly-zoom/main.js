// 26 めまいショット（ドリーズーム）：カメラが近づきながら画角を広げる。文字の大きさは同じなのに、後ろの景色だけがぐわっと伸びる
// 映画の撮影用語：ドリー（カメラごと前後）＋ ズーム（画角）を逆向きに。ヒッチコック『めまい』（1958）で有名
// 計算：文字の幅 w が画面に同じ大きさで映る距離 = (w/2) ÷ tan(画角/2)
import { run, chip, range01, lerp, VIVID, PAL } from '../lib/stage.js';
import { THREE, threeStage } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { easeInOutSine } from '../lib/easing.js';

const label = chip('');
const { scene, camera, render: draw } = threeStage({ bg: '#fdeaf3', fog: [40, 160] });

// 主役の文字
const glyphs = await loadGlyphs('../lib/glyphs.json');
textGeometries('かわいい', glyphs, { size: 2.4, depth: 0.7, bevel: 0.05, bevelSeg: 4 }).forEach((p, i) => {
  const m = new THREE.Mesh(p.geo, [new THREE.MeshStandardMaterial({ color: VIVID[i], roughness: 0.3 }), new THREE.MeshStandardMaterial({ color: PAL.ink })]);
  m.position.set(p.x, p.y, 0); m.castShadow = true; scene.add(m);
});
// 後ろの景色：市松の床と、奥へ並ぶ柱（伸び縮みがよく分かる）
const c = document.createElement('canvas'); c.width = c.height = 64;
const g = c.getContext('2d'); g.fillStyle = '#ffd6e8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#fff6fb'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
const chk = new THREE.CanvasTexture(c); chk.colorSpace = THREE.SRGBColorSpace; chk.wrapS = chk.wrapT = THREE.RepeatWrapping; chk.repeat.set(60, 60); chk.magFilter = THREE.NearestFilter;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.receiveShadow = true; scene.add(floor);
const pillar = new THREE.CylinderGeometry(0.6, 0.6, 9, 24);
for (let k = 0; k < 14; k++) for (const sx of [-1, 1]) {
  const m = new THREE.Mesh(pillar, new THREE.MeshStandardMaterial({ color: VIVID[(k + (sx > 0 ? 3 : 0)) % VIVID.length], roughness: 0.5 }));
  m.position.set(sx * (5 + k * 0.4), 2.9, -6 - k * 7); scene.add(m);
}

const WIDTH = 13;                     // 画面に映したい文字列の幅
function render(t) {
  // 画角 15° → 80° → 15°（行って戻る）
  const k = easeInOutSine(range01(t, 0.6, 4.4)) * (1 - easeInOutSine(range01(t, 5.4, 9.2)));
  const fov = lerp(14, 82, k);
  camera.fov = fov; camera.updateProjectionMatrix();
  const vfov = THREE.MathUtils.degToRad(fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (WIDTH / 2) / Math.tan(hfov / 2);            // 文字の幅がいつも同じに映る距離
  camera.position.set(0, 0.6 + dist * 0.06, dist);
  camera.lookAt(0, 0.2, 0);
  label.innerHTML = `ドリーズーム：画角 ${fov.toFixed(0)}°、距離 ${dist.toFixed(1)}<small>文字の大きさは同じまま、背景だけが伸び縮みする</small>`;
  draw();
}

run({ render, loop: 10, fonts: [] });
