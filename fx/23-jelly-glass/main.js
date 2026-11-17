// 23 ゼリーの文字：透き通った「ぷるん」が、後ろで流れる模様をゆがめて映し、つつかれるたびにぷるぷる揺れる
// 素材：透過（transmission）＋厚み（thickness）＋吸収の色（attenuationColor）／ 動き：ばね（二次の動き）、expImpulse
import { run, chip, range01, lerp, PAL } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { SecondOrder } from '../lib/spring.js';
import { expImpulse } from '../lib/iq.js';
import { easeInOutSine } from '../lib/easing.js';

chip('透過＋厚み＋吸収の色＝ゼリー<small>transmission 1, thickness 2, ior 1.33, attenuationColor ／ 後ろの模様が屈折して見える</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#fff6fb' });
scene.environmentIntensity = 0.9;
shadowFloor(scene, -1.75, 0.1);

// 後ろの壁：水玉が流れ続ける（屈折のゆがみが動いて見える）
const c = document.createElement('canvas'); c.width = c.height = 256;
const g = c.getContext('2d');
g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 256, 256);
[[64, 64, PAL.pink], [192, 192, PAL.sky], [192, 64, PAL.mint], [64, 192, PAL.lav]].forEach(([x, y, col]) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, 44, 0, 7); g.fill(); });
const dots = new THREE.CanvasTexture(c); dots.colorSpace = THREE.SRGBColorSpace; dots.wrapS = dots.wrapT = THREE.RepeatWrapping; dots.repeat.set(12, 4);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(48, 16), new THREE.MeshBasicMaterial({ map: dots }));
wall.position.set(0, 2.5, -4); scene.add(wall);

const glyphs = await loadGlyphs('../lib/glyphs.json');
const COLORS = ['#ff5c9a', '#ffb02e', '#2fcf9f'];
const letters = textGeometries('ぷるん', glyphs, { size: 3.6, depth: 1.2, bevel: 0.08, bevelSeg: 8 }).map((p, i) => {
  const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, thickness: 2, ior: 1.33, roughness: 0.04,
    attenuationColor: new THREE.Color(COLORS[i]), attenuationDistance: 1.7, clearcoat: 1, clearcoatRoughness: 0.05 });
  const m = new THREE.Mesh(p.geo, mat); m.castShadow = true;
  m.position.set(p.x * 1.08, p.y, 0); scene.add(m);
  return { m, i, spring: null };
});
const POKES = [1.2, 1.5, 1.8, 4.2, 4.3, 4.4, 6.8];

function setup() { letters.forEach(L => (L.spring = new SecondOrder(2.4, 0.2, 0, 1))); }
function update(t, dt) {
  letters.forEach(L => {
    let p = 0;
    POKES.forEach((pt, k) => { if (k % 3 === L.i || k === 6) p += expImpulse(Math.max(0, t - pt), 16) * (t > pt ? 1 : 0); });
    L.s = L.spring.update(dt, 1 - 0.22 * p);
  });
}

function render(t) {
  dots.offset.set(t * 0.08, t * 0.03);
  letters.forEach(L => { const s = L.s; const w = 1 + (1 - s) * 0.5; L.m.scale.set(w, s, w); L.m.position.y = -1.75 + 1.75 * s;   // 縦につぶれたら横に広がる L.m.rotation.y = 0.25 * Math.sin(t * 0.7 + L.i); });
  orbit(camera, { yaw: 0.35 * Math.sin(easeInOutSine(range01(t, 0, 9)) * Math.PI * 2), pitch: 0.12, dist: 15, target: [0, 0.2, 0] });
  draw();
}

run({ setup, update, render, loop: 9, fonts: [] });
