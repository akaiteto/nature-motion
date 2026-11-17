// 27 ピント送りとホイップパン：手前・真ん中・奥の言葉へ、順にピントを送る。最後はカメラを素早く振って（ホイップパン）次の言葉へ
// 後処理：BokehPass（被写界深度＝ボケ）、AfterimagePass（素早く振ったときの流れ）／ 撮影用語：ピント送り、ホイップパン
import { W, H, run, chip, range01, lerp, VIVID, PAL } from '../lib/stage.js';
import { THREE, threeStage } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { easeInOutCubic, easeInOutExpo } from '../lib/easing.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const label = chip('');
const { renderer, scene, camera } = threeStage({ bg: '#ffd3e6', shadows: false });
const glyphs = await loadGlyphs('../lib/glyphs.json');
const side = new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 0.5 });
function word(text, size, pos, rotY = 0, ci = 0) {
  const grp = new THREE.Group();
  textGeometries(text, glyphs, { size, depth: 0.5, bevel: 0.04, bevelSeg: 3 }).forEach((p, i) => {
    const m = new THREE.Mesh(p.geo, [new THREE.MeshStandardMaterial({ color: VIVID[(i + ci) % VIVID.length], roughness: 0.35 }), side]);
    m.position.set(p.x, p.y, 0); grp.add(m);
  });
  grp.position.set(...pos); grp.rotation.y = rotY; scene.add(grp); return grp;
}
const CAM = new THREE.Vector3(0, 1.0, 14);
// 正面の3段（手前・真ん中・奥）
const near = word('ぷるん', 1.6, [-3.6, -0.5, 6], 0.25, 0);
const mid = word('かわいいは、', 1.8, [0.8, 0.9, -1], 0, 2);
const far = word('作れる！', 2.6, [5.0, 4.4, -10], -0.1, 4);
// 左を向くと見える言葉（ホイップパンの行き先）
const side1 = word('ふわふわ', 2.2, [CAM.x - 13, 1.0, CAM.z + 0.5], Math.PI / 2, 1);
const TARGETS = [['手前：ぷるん', near], ['真ん中：かわいいは、', mid], ['奥：作れる！', far]];

const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 9, aperture: 0.006, maxblur: 0.016 });
composer.addPass(bokeh);
const after = new AfterimagePass(0); composer.addPass(after);
composer.addPass(new OutputPass());
camera.fov = 40; camera.updateProjectionMatrix();

const dist = g => CAM.distanceTo(g.getWorldPosition(new THREE.Vector3()));
function render(t) {
  // ピント送り：手前 → 真ん中 → 奥（それぞれ1.4秒止めて、0.8秒で送る）
  let f = dist(near), name = TARGETS[0][0];
  for (let k = 1; k < 3; k++) {
    const u = easeInOutCubic(range01(t, k * 2.2 - 0.8, k * 2.2));
    if (u > 0) { f = lerp(dist(TARGETS[k - 1][1]), dist(TARGETS[k][1]), u); name = u > 0.5 ? TARGETS[k][0] : name; }
  }
  // ホイップパン：7.0 秒から 0.35 秒で左へ 90° 振る（振っている間だけ残像を強く）
  const w = easeInOutExpo(range01(t, 7.0, 7.45));
  const yaw = w * Math.PI / 2;
  const whipping = t > 6.95 && t < 7.55;
  after.uniforms.damp.value = whipping ? 0.82 : 0;
  if (w > 0) { f = lerp(f, CAM.distanceTo(side1.position), w); name = '左へホイップパン → ふわふわ'; }
  bokeh.uniforms.focus.value = f;
  camera.position.copy(CAM);
  camera.lookAt(CAM.x - Math.sin(yaw) * 10, 1.0 + 0.3 * (1 - w), CAM.z - Math.cos(yaw) * 10);
  label.innerHTML = `${w > 0 ? 'ホイップパン：素早く振って場面を変える' : 'ピント送り：ボケの位置を動かして視線を運ぶ'}<small>${name} ／ BokehPass focus ${f.toFixed(1)}</small>`;
  composer.render();
}

run({ render, loop: 9.5, fonts: [] });
