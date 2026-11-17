// o5 じりじり：原稿用紙の手紙が角から燃えていき、燃え跡から下に隠れていた「またね！」が出てくる
// 群の動き：燃えるふち（前線）が広がる。マスが燃える時刻 = 火元からの距離 ÷ 速さ ＋ ノイズ
//           燃えたマスは、火の粉「ちり」になって上へ（カールノイズ）、灰「はら」になって下へ（ひらひら）
// 1文字ずつ：燃える前にじりじり震えて茶色に焦げ → 赤く光って「じり」に変わり → 消える
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutBack, easeOutElastic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { perlin, curl } from '../lib/noise.js';
import { sprite, stamp, camera, mix } from '../lib/onoma.js';

const LOOP = 11, COLS = 20, ROWS = 10, CS = 58;
const PX = W / 2 - COLS * CS / 2, PY = 540 - ROWS * CS / 2 - 10;   // 紙の左上
const FIRE = [PX + COLS * CS - 10, PY + ROWS * CS - 10];           // 火元：右下の角
const IGNITE = 1.3, SPEED = 265;
const MSG = 'きょうもいちにちおつかれさま。あしたもいいひになりますように。ことばはもえても、きもちはのこるよ。';
const INK = PAL.ink;
chip('じりじり：燃える時刻 ＝ 火元からの距離 ÷ 速さ ＋ ノイズ → 火の粉は上へ、灰は下へ<small>前線の伝わり ／ カールノイズ ／ ひらひら（sin の揺れ）</small>');

let cells, embers, ashes, flames, rand;

function setup() {
  rand = rng(8); embers = []; ashes = []; flames = [];
  cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = PX + c * CS + CS / 2, y = PY + r * CS + CS / 2;
    const d = Math.hypot(x - FIRE[0], y - FIRE[1]);
    cells.push({ x, y, ch: MSG[(r * COLS + c) % MSG.length], burn: IGNITE + d / SPEED + 0.9 * (perlin(x * 0.006, y * 0.006) + 0.5), gone: false });
  }
}

function update(t, dt) {
  for (const c of cells) {
    const e = t - c.burn;
    // 光っている間は、小さな炎「めら」を出す
    if (e > 0 && e < 0.35 && rand() < dt * 9) flames.push({ x: c.x + (rand() - 0.5) * CS, y: c.y, age: 0, life: 0.5 + rand() * 0.4, seed: rand() * 50 });
    if (e > 0.35 && !c.gone) {
      c.gone = true;
      embers.push({ x: c.x, y: c.y, vx: (rand() - 0.5) * 60, vy: -80 - rand() * 120, age: 0, seed: rand() * 50, w: rand() < 0.5 ? 'ちり' : 'ぱち' });
      if (rand() < 0.6) ashes.push({ x: c.x, y: c.y, vy: 40 + rand() * 40, age: 0, seed: rand() * 50 });
    }
  }
  for (const f of flames) { f.age += dt; f.y -= 150 * dt; f.x += 30 * perlin(f.seed, t * 3) * dt; }
  for (const p of embers) {
    const [cx, cy] = curl(p.x * 0.003, p.y * 0.003, t * 0.4);
    p.vx += cx * 300 * dt; p.vy += (cy * 300 - 60) * dt;
    p.vx *= Math.exp(-0.8 * dt); p.vy *= Math.exp(-0.8 * dt);
    p.x += p.vx * dt; p.y += p.vy * dt; p.age += dt;
  }
  for (const a of ashes) { a.age += dt; a.y += a.vy * dt; a.x += Math.sin(a.age * 3 + a.seed) * 60 * dt; }
  flames = flames.filter(f => f.age < f.life);
  embers = embers.filter(p => p.age < 2.4);
  ashes = ashes.filter(a => a.age < 3);
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 机（木目）
  ctx.fillStyle = '#c99a72'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,80,50,.25)'; ctx.lineWidth = 3;
  for (let y = 20; y < H; y += 46) { ctx.beginPath(); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y + 8 * Math.sin(x * 0.01 + y)); ctx.stroke(); }

  // 前線の中心（いま光っているマスの平均）をカメラが追う
  let fx = 0, fy = 0, n = 0;
  for (const c of cells) { const e = t - c.burn; if (e > -0.3 && e < 0.4) { fx += c.x; fy += c.y; n++; } }
  const front = n ? [fx / n, fy / n] : FIRE;
  const intro = easeInOutCubic(range01(t, 0.2, IGNITE + 0.6)), reveal = easeInOutCubic(range01(t, 6.2, 8.0));
  camera(ctx, {
    x: lerp(lerp(FIRE[0] - 60, front[0], intro), W / 2, reveal),
    y: lerp(lerp(FIRE[1] - 40, front[1], intro), 520, reveal),
    zoom: lerp(lerp(2.2, 1.45, intro), 0.95, reveal),
    rot: lerp(-0.04, 0.0, reveal) + 0.008 * Math.sin(t * 0.9),
  });

  // 紙の下に隠れている「またね！」（紙の影も）
  const pop = easeOutElastic(range01(t, 7.6, 8.8));
  const beat = 1 + 0.05 * expImpulse(Math.max(0, (t - 8.8) % 0.8), 8) * (t > 8.8 ? 1 : 0);
  stamp(ctx, sprite('またね！', { size: 230, color: PAL.yellow, stroke: INK, sw: 16 }), W / 2, 540, { s: (0.92 + 0.08 * pop) * beat, rot: -0.03 });
  ctx.fillStyle = 'rgba(70,40,30,.25)';
  for (const c of cells) if (!c.gone) ctx.fillRect(c.x - CS / 2 + 12, c.y - CS / 2 + 16, CS, CS);

  // 紙のマス
  for (const c of cells) {
    if (c.gone) continue;
    const e = t - c.burn;
    const scorch = clamp((e + 0.6) / 0.6);            // 0：白い紙 → 1：真っ黒
    let bg = mix('#fffaf0', '#7a4a32', Math.pow(scorch, 1.5));
    if (e > 0) bg = mix('#5a2a20', '#2a1a1a', clamp(e / 0.35));
    ctx.fillStyle = bg; ctx.fillRect(c.x - CS / 2 - 0.5, c.y - CS / 2 - 0.5, CS + 1, CS + 1);
    // 原稿用紙の赤い線
    if (scorch < 0.3) { ctx.strokeStyle = 'rgba(255,120,140,.55)'; ctx.lineWidth = 2; ctx.strokeRect(c.x - CS / 2 + 4, c.y - CS / 2 + 4, CS - 8, CS - 8); }
    if (e > 0) {
      // 光る：ふちを橙色に
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,${120 + 80 * Math.sin(t * 20 + c.x)},40,${0.7 * (1 - e / 0.35)})`;
      ctx.fillRect(c.x - CS / 2, c.y - CS / 2, CS, CS); ctx.restore();
      stamp(ctx, sprite('じり', { size: 26, color: '#ffd36b' }), c.x, c.y, { rot: 0.3 * Math.sin(t * 30 + c.x), s: 1 + 0.2 * Math.sin(t * 25 + c.y) });
    } else {
      // じりじり震える（焦げ始めると強く）
      const jit = scorch > 0 ? 2.5 * scorch : 0;
      const col = mix(INK, '#3a2016', scorch);
      stamp(ctx, sprite(c.ch, { size: 38, color: col, weight: 800 }), c.x + jit * Math.sin(t * 60 + c.y), c.y + jit * Math.cos(t * 55 + c.x), { rot: 0.08 * scorch * Math.sin(t * 40 + c.x) });
    }
  }

  // 炎・火の粉・灰
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flames) {
    const k = f.age / f.life;
    const col = k < 0.3 ? '#fff0a0' : k < 0.6 ? '#ffb33c' : '#ff5a4a';
    stamp(ctx, sprite('めら', { size: 30, color: col }), f.x, f.y, { s: 1.1 - 0.6 * k, a: 1 - k, rot: 0.3 * perlin(f.seed, t * 4) });
  }
  for (const p of embers) {
    const tw = 0.6 + 0.4 * Math.sin(t * 14 + p.seed * 7);
    stamp(ctx, sprite(p.w, { size: 22, color: '#ffc24a' }), p.x, p.y, { a: (1 - p.age / 2.4) * tw, rot: p.vx * 0.003 });
  }
  ctx.globalCompositeOperation = 'source-over';
  for (const a of ashes) stamp(ctx, sprite('はら', { size: 22, color: '#5a4a4a' }), a.x, a.y, { a: 0.8 * (1 - a.age / 3), rot: 0.6 * Math.sin(a.age * 3 + a.seed), sx: Math.cos(a.age * 4 + a.seed) });

  // 火をつけるマッチ「シュッ」と、前線の「じりじり」
  if (t < IGNITE + 0.4) {
    const s = easeOutBack(range01(t, 0.4, 0.8));
    stamp(ctx, sprite('シュッ', { size: 46, color: '#fff', stroke: INK, sw: 6 }), FIRE[0] + 70, FIRE[1] - 90, { s, rot: -0.2, a: 1 - range01(t, IGNITE, IGNITE + 0.4) });
    ctx.globalCompositeOperation = 'lighter';
    const m = sprite('ぼっ', { size: 40, color: '#ffcf4a' });
    stamp(ctx, m, FIRE[0] + 10, FIRE[1] - 30, { s: s * (1 + 0.1 * Math.sin(t * 30)) });
    ctx.globalCompositeOperation = 'source-over';
  }
  const fa = n ? clamp(range01(t, IGNITE + 0.3, IGNITE + 0.8)) * (1 - range01(t, 6.5, 7.2)) : 0;
  if (fa > 0) stamp(ctx, sprite('じりじり…', { size: 54, color: '#fff3d0', stroke: '#7a3a2a', sw: 7 }), front[0] - 60, front[1] - 120 + 6 * Math.sin(t * 6), { a: fa, rot: -0.06, s: 1 + 0.04 * Math.sin(t * 12) });
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
