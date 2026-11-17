// 24 ネオンの文字：輪郭をガラス管にして光らせ（ブルーム）、ちらついて点灯し、跳ねると光の残像が尾を引く
// 後処理：UnrealBloomPass（光のにじみ）→ AfterimagePass（残像）→ OutputPass ／ 文字の輪郭 → TubeGeometry
// 動き：点灯のちらつき（乱数の段差）、跳ね：cubicPulse（キレス）
import { W, H, run, chip, range01, lerp, rng } from '../lib/stage.js';
import { THREE, threeStage, orbit } from '../lib/three-stage.js';
import { loadGlyphs, contoursOf } from '../lib/glyph.js';
import { cubicPulse } from '../lib/iq.js';
import { easeInOutCubic } from '../lib/easing.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

chip('ネオン：輪郭を管にして光らせ、UnrealBloomPass でにじませる<small>残像：AfterimagePass ／ three.js の後処理</small>');
const { renderer, scene, camera } = threeStage({ bg: '#1d1630', shadows: false });
scene.environmentIntensity = 0.2;

// 壁（暗いレンガ風の縞）
const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshStandardMaterial({ color: '#2b2240', roughness: 0.9 }));
wall.position.z = -0.6; scene.add(wall);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const TEXT = [...'かわいい'], SIZE = 3.6, COLORS = ['#ff4fa3', '#4ff3ff', '#ffe066', '#b98bff'];
let pen = -TEXT.reduce((s, ch) => s + glyphs[ch].adv + 0.08, -0.08) / 2;
const rand = rng(4);
const letters = TEXT.map((ch, i) => {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS[i]).multiplyScalar(1.5), toneMapped: false });
  for (const poly of contoursOf(glyphs[ch], 6)) {
    const pts = poly.filter((_, k) => k % 2 === 0).map(([x, y]) => new THREE.Vector3((x - 0.5) * SIZE, (y - 0.38) * SIZE, 0));
    if (pts.length < 4) continue;
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 4, 0.075, 8, true), mat));
  }
  group.position.x = (pen + glyphs[ch].adv / 2) * SIZE + (glyphs[ch].adv / 2 - 0.5) * 0;
  pen += glyphs[ch].adv + 0.08;
  scene.add(group);
  // 点灯の台本：ちらちら（オン・オフを乱数で刻む）→ ずっとオン
  const flick = Array.from({ length: 8 }, () => rand() < 0.55);
  return { group, mat, base: new THREE.Color(COLORS[i]).multiplyScalar(1.5), start: 0.5 + i * 0.55, flick };
});

const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.85, 0.5, 0.25));
const after = new AfterimagePass(0.86);
composer.addPass(after);
composer.addPass(new OutputPass());

function render(t) {
  letters.forEach((L, i) => {
    const u = t - L.start;
    const on = u < 0 ? 0 : u < 0.8 ? (L.flick[Math.floor(u * 10)] ? 1 : 0.08) : 1;
    L.mat.color.copy(L.base).multiplyScalar(on);
    // 全部点いたら、左から右へ波が通って文字が跳ねる（残像が尾を引く）
    const wave = (t - 3.6) * 2.2 % 6 - 1;
    const hop = t > 3.6 ? cubicPulse(wave, 0.9, i) : 0;
    L.group.position.y = 1.4 * hop;
    L.group.rotation.z = 0.15 * hop * (i % 2 ? 1 : -1);
  });
  const k = easeInOutCubic(range01(t, 0, 3.4));
  orbit(camera, { yaw: lerp(-0.35, 0.12, k) + 0.05 * Math.sin(t * 0.7), pitch: lerp(-0.05, 0.06, k), dist: lerp(15, 17.5, k), target: [0, 0.2, 0] });
  composer.render();
}

run({ render, loop: 9, fonts: [] });
