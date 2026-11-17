// 13 結び目を流れる文字：トーラス結び目と、まわりの輪に、文字の帯が流れ続ける
// 定番の作り方：キャンバスに文字の帯を描いてテクスチャにし、形に巻きつけて、テクスチャの位置（UV）をずらし続ける
// 使う関数：easeInOutCubic・easeInOutSine（ペナー）
import { run, chip, range01, lerp, PAL, FONT } from '../lib/stage.js';
import { THREE, threeStage, orbit } from '../lib/three-stage.js';
import { easeInOutCubic, easeInOutSine } from '../lib/easing.js';

chip('文字の帯をテクスチャにして、形に巻きつけて流す<small>TorusKnotGeometry ／ テクスチャの offset を時間で動かす</small>');
const { scene, camera, render: draw } = threeStage({ bg: '#fff3f8', shadows: false });

// 文字の帯（横に長いキャンバス）
function band(text, bg, fg, h = 256) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `800 ${h * 0.62}px ${FONT}`;
  c.width = Math.ceil(g.measureText(text).width + h * 0.6); c.height = h;
  g.fillStyle = bg; g.fillRect(0, 0, c.width, h);
  g.font = `800 ${h * 0.62}px ${FONT}`; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.lineWidth = h * 0.08; g.strokeStyle = PAL.ink; g.lineJoin = 'round';
  g.strokeText(text, h * 0.3, h * 0.54); g.fillText(text, h * 0.3, h * 0.54);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 8;
  return tex;
}

const knotTex = band('かわいいは、作れる！ ♡ ', PAL.pink, '#ffffff');
knotTex.repeat.set(3, 2);          // 長さ方向に3回、太さの周りに2行
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(3.2, 0.95, 600, 48, 2, 3),
  new THREE.MeshStandardMaterial({ map: knotTex, roughness: 0.4 }));
scene.add(knot);

const ringTex = band('関数ひとつで、文字はおどりだす ★ ', '#ffffff', PAL.lav);
ringTex.repeat.set(4, 1);
const ring = new THREE.Mesh(new THREE.CylinderGeometry(7.4, 7.4, 1.5, 160, 1, true),
  new THREE.MeshStandardMaterial({ map: ringTex, side: THREE.DoubleSide, roughness: 0.5 }));
ring.rotation.set(0.35, 0, 0.25);
scene.add(ring);

function render(t) {
  knotTex.offset.x = -t * 0.12;          // 帯が結び目にそって流れる
  ringTex.offset.x = t * 0.035;          // 輪は逆向きに回る
  knot.rotation.set(0.2 * Math.sin(t * 0.4), t * 0.25, 0);
  ring.rotation.y = -t * 0.15;
  // カメラ：結び目の中をくぐるように寄ってから、引いて全体を見せる
  const k = easeInOutCubic(range01(t, 0, 4.5));
  const swing = easeInOutSine(range01(t, 4.5, 10));
  orbit(camera, { yaw: lerp(-0.9, 0.3, k) + 0.5 * swing, pitch: lerp(0.15, 0.35, k) - 0.25 * swing, dist: lerp(7.5, 23, k), target: [lerp(1.5, 0, k), 0, 0], roll: lerp(-0.3, 0, k) });
  draw();
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
