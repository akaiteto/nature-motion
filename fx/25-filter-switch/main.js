// 25 フィルターの着せ替え：同じ立体文字の場面に、three.js の後処理を順番にかけ替える
//   網点（HalftonePass）→ ピクセル化（RenderPixelatedPass）→ ドット（DotScreenPass）→ フィルム（FilmPass）→ グリッチ（GlitchPass）→ なし
import { W, H, run, chip, range01, VIVID } from '../lib/stage.js';
import { THREE, threeStage, shadowFloor, orbit } from '../lib/three-stage.js';
import { textGeometries } from '../lib/text3d.js';
import { loadGlyphs } from '../lib/glyph.js';
import { expImpulse } from '../lib/iq.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const label = chip('');
const { renderer, scene, camera } = threeStage({ bg: '#ffd3e6' });
shadowFloor(scene, -1.6, 0.15);
const glyphs = await loadGlyphs('../lib/glyphs.json');
const letters = textGeometries('かわいいは、作れる！', glyphs, { size: 2.0, depth: 0.6, bevel: 0.04, bevelSeg: 3 }).map((p, i) => {
  const m = new THREE.Mesh(p.geo, [new THREE.MeshStandardMaterial({ color: VIVID[i % VIVID.length], roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: '#4a3b5c', roughness: 0.5 })]);
  m.position.set(p.x, p.y, 0); m.castShadow = true; scene.add(m); return m;
});

// フィルターの一覧：[名前, 説明, 後処理（なければ null）]
const FILTERS = [
  ['HalftonePass', '網点：漫画の印刷のような点', new HalftonePass({ radius: 5, scatter: 0, shape: 1, blending: 1, blendingMode: 1, greyscale: false })],
  ['RenderPixelatedPass', 'ピクセル化：レトロゲーム風', new RenderPixelatedPass(7, scene, camera)],
  ['DotScreenPass', 'ドットスクリーン：白黒の網目', new DotScreenPass(new THREE.Vector2(0, 0), 0.6, 1.6)],
  ['FilmPass', 'フィルム：粒と走査線', new FilmPass(0.9, false)],
  ['GlitchPass', 'グリッチ：電波の乱れ', new GlitchPass()],
  ['（なし）', '後処理なし：元の絵', null]
];
const SLOT = 1.6;
const composers = FILTERS.map(([, , pass]) => {
  const c = new EffectComposer(renderer); c.setPixelRatio(1); c.setSize(W, H);
  if (!(pass instanceof RenderPixelatedPass)) c.addPass(new RenderPass(scene, camera));
  if (pass) c.addPass(pass);
  c.addPass(new OutputPass());
  return c;
});

function render(t) {
  const i = Math.floor(t / SLOT) % FILTERS.length;
  const local = t - Math.floor(t / SLOT) * SLOT;
  // かけ替えの瞬間、文字が一斉にぴょんと跳ねる
  letters.forEach((m, k) => { m.position.y = -0.1 + 0.9 * expImpulse(Math.max(0, local - k * 0.03), 9); m.rotation.y = 0.3 * Math.sin(t * 0.9 + k * 0.4); });
  orbit(camera, { yaw: 0.35 * Math.sin(t * 0.4), pitch: 0.18, dist: 21.5, target: [0, 0, 0] });
  label.innerHTML = `${FILTERS[i][1]}<small>${FILTERS[i][0]} ／ three.js の後処理</small>`;
  composers[i].render();
}

run({ render, loop: SLOT * FILTERS.length, fonts: [] });
