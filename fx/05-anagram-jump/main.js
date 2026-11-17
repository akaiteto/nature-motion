// 05 バラバラに並んだ文字が、放物線を描いて飛び移り、「かわいいは、作れる！」に並び替わる
// 使う関数：parabola（キレス）、easeOutBack・easeInOutCubic（ペナー）、指数インパルス
import { RAINBOW, run, chip, range01, lerp, rng, css, domScene, setCamera } from '../lib/stage.js';
import { parabola, expImpulse } from '../lib/iq.js';
import { easeInOutCubic, easeOutBack, easeInOutSine } from '../lib/easing.js';

const TARGET = [...'かわいいは、作れる！'];
const SIZE = 160, STEP = 166, SWAP = 0.85, BEGIN = 1.0;
chip('parabola(x, k) = (4x(1−x))^k で山なりに跳ぶ<small>Inigo Quilez ／ 着地：easeOutBack</small>');
css(`.spark{position:absolute;left:0;top:0;width:24px;height:24px;margin:-12px;border-radius:50%;background:#fff;
  box-shadow:0 0 18px 8px rgba(255,226,122,.9)}`);

// 並び替えの手順を先に作る（選択ソート：左から正しい字を探して入れ替える）
const rand = rng(11);
const order = TARGET.map((c, i) => i);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
const swaps = [], cur = order.slice();
for (let i = 0; i < cur.length; i++) {
  const j = cur.indexOf(i);
  if (j !== i) { swaps.push([i, j]); [cur[i], cur[j]] = [cur[j], cur[i]]; }
}
const END = BEGIN + swaps.length * SWAP;

const world = domScene(1500);
const tiles = TARGET.map((c, id) => {
  const el = document.createElement('div'); el.className = 'ch'; el.textContent = c;
  el.style.fontSize = SIZE + 'px'; el.style.color = RAINBOW[id % RAINBOW.length];
  world.appendChild(el); return { el, id };
});
const sparks = Array.from({ length: 10 }, () => { const s = document.createElement('div'); s.className = 'spark'; world.appendChild(s); return s; });
const slotX = i => (i - (TARGET.length - 1) / 2) * STEP;

// 時刻 t の各文字の位置（何番目の手順の途中か）
function layout(t) {
  const pos = order.slice();                 // pos[スロット] = 文字の id
  const state = TARGET.map(() => ({ x: 0, y: 0, rot: 0, sx: 1, sy: 1 }));
  let active = null;
  for (let s = 0; s < swaps.length; s++) {
    const t0 = BEGIN + s * SWAP;
    if (t < t0) break;
    const [a, b] = swaps[s];
    if (t < t0 + SWAP) { active = { s, a, b, u: (t - t0) / SWAP }; break; }
    [pos[a], pos[b]] = [pos[b], pos[a]];
  }
  pos.forEach((id, slot) => { state[id].x = slotX(slot); });
  if (active) {
    const { a, b, u } = active;
    const ida = pos[a], idb = pos[b];
    const m = easeInOutCubic(Math.min(1, u * 1.15));
    // 一方は高く宙返りしながら、もう一方は低く跳んで、すれ違う
    state[ida].x = lerp(slotX(a), slotX(b), m); state[ida].y = -420 * parabola(Math.min(1, u * 1.15), 0.9); state[ida].rot = 360 * m;
    state[idb].x = lerp(slotX(b), slotX(a), m); state[idb].y = -150 * parabola(Math.min(1, u * 1.15), 1.2);
    // 着地でつぶれて戻る（easeOutBack で行き過ぎて戻る）
    const land = range01(u, 0.87, 1);
    if (land > 0) for (const id of [ida, idb]) { const k = easeOutBack(land); state[id].sx = lerp(1.3, 1, k); state[id].sy = lerp(0.7, 1, k); }
  }
  return { state, active };
}

function render(t) {
  const { state } = layout(t);
  const done = range01(t, END, END + 0.6);
  tiles.forEach(({ el, id }) => {
    const s = state[id];
    const hop = done > 0 ? -60 * expImpulse(Math.max(0, t - END - 0.05 * id), 7) : 0;   // 揃ったら端から順にぴょん
    el.style.transform = `translate3d(${s.x - SIZE / 2}px, ${s.y + hop - SIZE / 2}px, 0) rotate(${s.rot}deg) scale(${s.sx}, ${s.sy})`;
  });
  // 揃った瞬間のきらきら
  sparks.forEach((sp, i) => {
    const u = range01(t, END + 0.1, END + 1.2), a = (i / sparks.length) * Math.PI * 2;
    sp.style.opacity = u > 0 && u < 1 ? 1 - u : 0;
    sp.style.transform = `translate3d(${Math.cos(a) * 900 * easeInOutSine(u)}px, ${Math.sin(a) * 260 * easeInOutSine(u)}px, 0) scale(${1 - u})`;
  });
  const intro = easeInOutCubic(range01(t, 0, BEGIN));
  setCamera(world, { zoom: lerp(-500, cam.z, intro) + 120 * expImpulse(Math.max(0, t - END), 5), yaw: cam.yaw, pitch: lerp(-25, -8, intro), x: cam.fx, y: 30 });
}
const cam = { fx: 0, z: 0, yaw: 0 };
function setup() { cam.fx = 0; cam.z = 0; cam.yaw = 0; }
// カメラ：跳んでいる2文字の間を追いかけ、少し寄る（毎コマ、目標へ少しずつ近づける）
function update(t) {
  const { active } = layout(t);
  let fx = 0, z = 0, yaw = 0;
  if (active) {
    const mid = (slotX(active.a) + slotX(active.b)) / 2;
    fx = -mid * 0.55; z = 260; yaw = (active.b > active.a ? 1 : -1) * 10 * Math.sin(Math.PI * active.u);
  }
  cam.fx = lerp(cam.fx, fx, 0.06); cam.z = lerp(cam.z, z, 0.05); cam.yaw = lerp(cam.yaw, yaw, 0.08);
}

run({ setup, update, render, loop: END + 2.6, fonts: ['800 40px "M PLUS Rounded 1c"'] });
