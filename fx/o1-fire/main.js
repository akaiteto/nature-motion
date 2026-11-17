// o1 めらめら：大きな「めらめら」に火がつき、小さな擬音の文字が炎になって立ちのぼる
// 群の動き：流体（Stable Fluids）。熱いところほど上へ浮く力を足す → 炎の形になる
// 1文字ずつ：温度で文字が変わる（ぼう → めら → ゆら → ぷす）。色・大きさ・ちらつきも温度で決める
import { W, H, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { perlin } from '../lib/noise.js';
import { Fluid } from '../lib/fluid.js';
import { sprite, stamp, textPoints, camera, shake } from '../lib/onoma.js';

const CELL = 20, NX = W / CELL, NY = H / CELL;     // 流体の格子：1マス 20px
const WORD = 'めらめら', WX = W / 2, WY = 760;      // 燃える大きな文字
const LOOP = 10;
// 温度の段：[この温度より上なら, 文字, 色, 大きさ]
const BANDS = [
  [0.72, 'ぼう', '#fff1b8', 54],
  [0.52, 'めら', '#ffcf3f', 48],
  [0.34, 'めら', '#ff8f35', 42],
  [0.18, 'ゆら', '#ff4f5e', 34],
  [0.0, 'ゆら', '#b8306f', 26],
];
const band = T => BANDS.find(b => T > b[0]) || BANDS[BANDS.length - 1];
chip('めらめら：熱いほど上へ浮く流れ（Stable Fluids）× 温度で変わる擬音<small>流体：Jos Stam 1999 ／ 文字：ぼう→めら→ゆら→ぷす</small>');

let fluid, parts, sparks, rand, edges, big, bigGlow;

function setup() {
  fluid = new Fluid(NX, NY, ['heat']);
  fluid.vorticity = 7; fluid.iterations = 20;
  parts = []; sparks = []; rand = rng(3);
  edges = textPoints(WORD, { size: 270, step: 9, edge: true });
  big = sprite(WORD, { size: 270, color: '#2e2338', stroke: '#5b3a4a', sw: 6 });
  bigGlow = sprite(WORD, { size: 270, color: 'rgba(0,0,0,0)', stroke: '#ff8a3c', sw: 7, glow: 30, glowColor: '#ff6a2a' });
}

// 導火線の火花の位置（文字の左端 → 右端）
const fuseX = t => lerp(WX - edges.w / 2 - 60, WX + edges.w / 2 + 40, easeInOutCubic(range01(t, 0.5, 1.9)));
// 火の強さ：つく → 燃えさかる → 消えていく
const power = t => clamp(range01(t, 0.5, 2.4) * (1 - easeInOutCubic(range01(t, 7.2, 8.8))));

function update(t, dt) {
  const P = power(t), fx = fuseX(t);
  // 1. 文字の上のふちから熱と上向きの流れを入れる（導火線の火花が通った所だけ）
  const lit = edges.filter(e => WX + e.x < fx);
  for (let k = 0; k < 14 * P && lit.length; k++) {
    const e = lit[Math.floor(rand() * lit.length)];
    const x = WX + e.x, y = WY + e.y;
    const wob = perlin(x * 0.01, t * 1.5);
    fluid.splat(x / CELL, y / CELL, 1.4, wob * 10, -14 * P, { heat: 0.12 * P });
    // 炎の文字を生む（1コマに数個だけ。多すぎると真っ白になる）
    if (k < 5 * P) parts.push({ tongue: clamp(Math.floor((e.x + edges.w / 2) / (edges.w / 4)), 0, 3), x: x + (rand() - 0.5) * 10, y: y + 10, T: 0.8 + rand() * 0.25, age: 0, seed: rand() * 100, rot: 0 });
  }
  // 2. 浮く力と冷え
  const h = fluid.f.heat;
  for (let i = 0; i < h.length; i++) { fluid.v[i] -= h[i] * 60 * dt; h[i] *= Math.exp(-1.8 * dt); }
  fluid.step(dt);
  // 3. 文字は流れに乗って動き、冷えていく
  for (const p of parts) {
    const u = fluid.sample(fluid.u, p.x / CELL, p.y / CELL) * CELL, v = fluid.sample(fluid.v, p.x / CELL, p.y / CELL) * CELL;
    // 炎の舌：文字ごとの中心へ、上へ行くほど寄せる → 先が細くなる
    const tx = WX + (p.tongue - 1.5) * edges.w / 4 + 50 * perlin(p.tongue * 3.1, t * 1.6);
    p.x += (u * 0.6 + 14 * perlin(p.seed, t * 2) + (tx - p.x) * 2.2 * (1 - clamp(p.T))) * dt;
    p.y += (v - 70) * dt;
    p.T -= (0.95 + 0.3 * (1 - P)) * dt;
    p.age += dt;
    p.rot = 0.35 * perlin(p.seed + 5, t * 3) + u * 0.0006;
  }
  parts = parts.filter(p => p.T > -0.35 && p.y > -100);
  // 4. はじける火の粉「ぱち」
  if (rand() < dt * 7 * P) {
    const e = edges[Math.floor(rand() * edges.length)];
    if (WX + e.x < fx) sparks.push({ x: WX + e.x, y: WY + e.y - 30, vx: (rand() - 0.5) * 420, vy: -300 - rand() * 380, age: 0, w: rand() < 0.5 ? 'ぱち' : 'ぱちっ' });
  }
  for (const s of sparks) { s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt; }
  sparks = sparks.filter(s => s.age < 1.3);
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  const P = power(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // 夜空（炎が強いほど、空も少し赤くなる）
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1630'); g.addColorStop(0.7, `rgb(${50 + 40 * P},${30 + 10 * P},${70})`); g.addColorStop(1, '#2a1b2e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // カメラ：導火線を追う → 引いて全体 → ゆっくり寄る → 消えたら煙を見上げる
  const pull = easeInOutCubic(range01(t, 1.8, 3.4)), push = easeInOutCubic(range01(t, 3.4, 7.2)), end = easeInOutCubic(range01(t, 7.4, 9.6));
  const fx = fuseX(t);
  const [kx, ky] = shake(t, 4 * P * (1 - end));
  camera(ctx, {
    x: lerp(lerp(fx, WX, pull), WX, push) + kx,
    y: lerp(lerp(WY - 40, 520, pull), 500, push) - 120 * end + ky,
    zoom: lerp(lerp(1.9, 0.95, pull), 1.05, push) * lerp(1, 0.92, end),
    rot: 0.012 * Math.sin(t * 0.8) * push,
  });

  // 地面の照り返し
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(WX, WY - 60, 30, WX, WY - 60, 900);
  glow.addColorStop(0, `rgba(255,120,60,${0.42 * P})`); glow.addColorStop(1, 'rgba(255,80,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(WX - 1000, WY - 1000, 2000, 2000);
  ctx.globalCompositeOperation = 'source-over';

  // 燃えている大きな文字（ふちが赤く光る）
  stamp(ctx, big, WX, WY);
  ctx.globalCompositeOperation = 'lighter';
  stamp(ctx, bigGlow, WX, WY, { a: 0.25 + 0.75 * P * (0.85 + 0.15 * Math.sin(t * 17)) });

  // 炎の体：熱い文字の後ろに、ぼんやり光る玉を足し算で重ねる
  const blob = glowDot();
  for (const p of parts) if (p.T > 0.15) stamp(ctx, blob, p.x, p.y, { s: 0.6 + p.T, a: 0.16 * p.T });
  ctx.globalCompositeOperation = 'source-over';
  // 炎の文字：冷えた文字から先に描き、熱い文字を上に重ねる
  const hot = parts.filter(p => p.T > 0).sort((a, b) => a.T - b.T);
  for (const p of hot) {
    const [, word, color, size] = band(p.T);
    const born = easeOutCubic(range01(p.age, 0, 0.15));
    const flick = 0.82 + 0.18 * perlin(p.seed, t * 12);
    stamp(ctx, sprite(word, { size, color }), p.x, p.y, { s: born * lerp(0.75, 1.1, clamp(p.T)), rot: p.rot, a: clamp(p.T * 2.2) * flick });
  }
  // 火の粉「ぱち」：出た瞬間にふくらむ
  for (const s of sparks) {
    const pop = 0.6 + 0.9 * expImpulse(s.age, 9);
    stamp(ctx, sprite(s.w, { size: 26, color: '#ffe680' }), s.x, s.y, { s: pop, rot: s.vx * 0.001, a: 1 - s.age / 1.3 });
  }
  // 導火線の火花「シュッ」
  if (t > 0.4 && t < 2.0) stamp(ctx, sprite('シュッ', { size: 44, color: '#fff3b0' }), fx + 30, WY - 150 + 8 * Math.sin(t * 40), { s: 1 + 0.15 * Math.sin(t * 50), rot: -0.15 });
  ctx.globalCompositeOperation = 'source-over';

  // 冷えた文字は煙「ぷす」になる
  for (const p of parts) {
    if (p.T > 0) continue;
    const k = -p.T / 0.35;
    stamp(ctx, sprite('ぷす', { size: 30, color: '#8b7f9a' }), p.x, p.y, { s: 1 + k * 0.8, rot: p.rot, a: (1 - k) * 0.55 });
  }
}

let _dot;
function glowDot() {
  if (_dot) return _dot;
  _dot = document.createElement('canvas'); _dot.width = _dot.height = 160;
  const g = _dot.getContext('2d'), r = g.createRadialGradient(80, 80, 0, 80, 80, 80);
  r.addColorStop(0, 'rgba(255,170,70,1)'); r.addColorStop(1, 'rgba(255,60,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 160, 160);
  return _dot;
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
