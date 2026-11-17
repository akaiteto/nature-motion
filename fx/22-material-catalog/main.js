// 22 素材カタログ：「かわいい」の4文字を、物理ベースの素材の4つの項目で作り分け、カメラが横に移動しながら1文字ずつ見せる
//   か＝透過＋分散（プリズムのガラス）  わ＝薄膜の虹色（しゃぼん玉）  い＝異方性（ヘアライン金属）  い＝シーン（ベルベット）
// three.js の MeshPhysicalMaterial の項目 ／ カメラ：トラック（真横への平行移動）
import { run, chip, range01, lerp, PAL } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { easeInOutCubic } from '../lib/easing.js';

const label = chip('');
const { scene, camera, render: draw } = threeStage({ bg: '#fff1f7' });
scene.environmentIntensity = 1.0;
shadowFloor(scene, -1.7, 0.12);

// 透けて見えるように、後ろに縞の壁を置く
const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
const g = c.getContext('2d');
[PAL.pink, PAL.yellow, PAL.mint, PAL.sky, PAL.lav, PAL.peach].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 1024 / 6, 0, 1024 / 6, 256); });
const stripes = new THREE.CanvasTexture(c); stripes.colorSpace = THREE.SRGBColorSpace; stripes.wrapS = THREE.RepeatWrapping; stripes.repeat.set(3, 1);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 14), new THREE.MeshBasicMaterial({ map: stripes }));
wall.position.set(0, 2, -6); scene.add(wall);

const MATS = [
  ['透過＋分散：ガラスの屈折と虹色のにじみ', 'transmission 1, ior 1.5, dispersion 6', new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 1.4, ior: 1.5, dispersion: 6, roughness: 0, color: '#ffffff' })],
  ['薄膜干渉：しゃぼん玉の虹色', 'iridescence 1, iridescenceIOR 1.6（暗い下地で虹色を目立たせる）', new THREE.MeshPhysicalMaterial({ color: '#2a2440', metalness: 0, roughness: 0.04, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 750], clearcoat: 1, specularIntensity: 1 })],
  ['異方性：筋に沿って伸びる光（ヘアライン金属）', 'metalness 1, anisotropy 1', new THREE.MeshPhysicalMaterial({ color: '#ffcf6b', metalness: 1, roughness: 0.28, anisotropy: 1, anisotropyRotation: Math.PI / 2 })],
  ['シーン：ベルベットの産毛の光', 'sheen 1, sheenColor ピンク', new THREE.MeshPhysicalMaterial({ color: '#7a1040', roughness: 1, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffb3d1') })]
];

const glyphs = await loadGlyphs('../lib/glyphs.json');
const SP = 6.5;
const letters = textGeometries('かわいい', glyphs, { size: 3.0, depth: 0.9, bevel: 0.05, bevelSeg: 5 }).map((p, i) => {
  const m = new THREE.Mesh(p.geo, MATS[i][2]);
  m.position.set((i - 1.5) * SP, 0.2, 0); m.castShadow = true;
  scene.add(m); return m;
});
const STOP = 2.2;                                   // 1文字あたりの時間

function render(t) {
  const idx = Math.min(3, Math.floor(t / STOP));
  const u = easeInOutCubic(range01(t % STOP, 0, 0.9));
  const from = (Math.max(0, idx - 1) - 1.5) * SP, to = (idx - 1.5) * SP;
  const x = idx === 0 ? to : lerp(from, to, u);
  letters.forEach((m, i) => { m.rotation.y = 0.5 * Math.sin(t * 0.8 + i); m.rotation.x = 0.12 * Math.sin(t * 0.6 + i); });
  // トラック：カメラの向きは変えず、横に平行移動するだけ
  camera.position.set(x + 1.0, 1.6, 14);
  camera.lookAt(x + 1.0, 0.2, 0);
  const [name, params] = MATS[idx];
  label.innerHTML = `${name}<small>${params}</small>`;
  draw();
}

run({ render, loop: STOP * 4 + 0.6, fonts: ['800 40px "M PLUS Rounded 1c"'] });
