// o7 ぴか：ばらばらに光っていたほたるが、となりに合わせるうちに、一斉に「ぴか」と光るようになる。最後は文字に集まる
// 群の動き：蔵本モデル。どのほたるも自分のリズム ω で光るが、みんなの平均（r と ψ）に少しずつ引っぱられる
//             dθ/dt = ω + K·r·sin(ψ − θ)      K：引っぱりの強さ（だんだん強くする）
//           飛び方はノイズの流れ。最後は「目標に近いほどゆっくり」（arrive）で文字の形へ
// 1文字ずつ：光る瞬間に「・」→「ぴか」に変わり、ふくらんで、ふわっと消える
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutBack } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { perlin } from '../lib/noise.js';
import { sprite, stamp, textPoints, camera } from '../lib/onoma.js';

const LOOP = 13, N = 150, WATER = 840, GATHER = 8.4, TAU = Math.PI * 2;
chip('ぴか：蔵本モデル dθ/dt = ω + K·r·sin(ψ − θ) ／ 平均に引っぱられて、光がそろう<small>Kuramoto 1975 ／ 文字へは arrive（Reynolds）</small>');
// 引っぱりの強さ：最初は 0（ばらばら）→ だんだん強く
const K = t => 4.2 * easeInOutCubic(range01(t, 2.2, 6.5));

let flies, rand, word, R = 0, PSI = 0;
const pulse = th => { const d = ((th % TAU) + TAU) % TAU; return Math.exp(-d * 2.6); };   // 位相が 0 を過ぎた直後に光る

function setup() {
  rand = rng(17); R = 0;
  word = textPoints('ぴかっ', { size: 420, step: 26 });
  flies = [...Array(N)].map((_, i) => ({
    x: 260 + rand() * (W - 520), y: 200 + rand() * 560,
    th: rand() * TAU, w: TAU * (0.85 + 0.3 * rand()), seed: rand() * 100, flash: 0,
    goal: word[Math.floor(i * word.length / N)], gd: rand() * 0.8,
  }));
}

function update(t, dt) {
  // みんなの平均：r（そろい具合 0〜1）と ψ（平均の位相）
  let cx = 0, cy = 0;
  for (const f of flies) { cx += Math.cos(f.th); cy += Math.sin(f.th); }
  R = Math.hypot(cx, cy) / N; PSI = Math.atan2(cy, cx);
  const k = K(t);
  for (const f of flies) {
    const before = ((f.th % TAU) + TAU) % TAU;
    f.th += (f.w + k * R * Math.sin(PSI - f.th)) * dt;
    const after = ((f.th % TAU) + TAU) % TAU;
    if (after < before) f.flash = 0;          // 0 をまたいだ＝光った瞬間
    f.flash += dt;
    // 飛び方：ノイズの流れ ／ 最後は文字の点へ arrive
    const g = clamp(range01(t, GATHER + f.gd, GATHER + f.gd + 0.3));
    if (g > 0) {
      const gx = W / 2 + f.goal.x, gy = 470 + f.goal.y;
      f.x += (gx - f.x) * (1 - Math.exp(-3.2 * g * dt)); f.y += (gy - f.y) * (1 - Math.exp(-3.2 * g * dt));
      f.x += 6 * perlin(f.seed, t * 2) * dt; f.y += 6 * perlin(f.seed + 3, t * 2) * dt;
    } else {
      f.x += 70 * perlin(f.x * 0.002, f.y * 0.002, t * 0.2 + f.seed * 0.01) * dt;
      f.y += 50 * perlin(f.y * 0.002 + 9, f.x * 0.002, t * 0.2) * dt - 4 * dt;
      f.y = Math.min(f.y, WATER - 60);
    }
  }
}

let _dot;
function glowDot() {
  if (_dot) return _dot;
  _dot = document.createElement('canvas'); _dot.width = _dot.height = 128;
  const g = _dot.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(230,255,140,1)'); r.addColorStop(0.3, 'rgba(170,255,120,.5)'); r.addColorStop(1, 'rgba(120,255,160,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return _dot;
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const all = flies.reduce((s, f) => s + pulse(f.th), 0) / N;     // いまどれくらい光っているか
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141a3a'); g.addColorStop(1, `rgb(${30 + 30 * all},${40 + 50 * all},${70 + 20 * all})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // カメラ：数匹に寄って始まり → だんだん引く → 文字の正面へ
  const out = easeInOutCubic(range01(t, 0.5, 6)), word2 = easeInOutCubic(range01(t, GATHER, GATHER + 1.6));
  camera(ctx, {
    x: lerp(lerp(W / 2 - 300, W / 2, out), W / 2, word2) + 30 * Math.sin(t * 0.3),
    y: lerp(lerp(420, 520, out), 520, word2),
    zoom: lerp(lerp(1.7, 0.98, out), 1.04, word2) * (1 + 0.03 * all * word2),
  });

  // 池と草
  ctx.fillStyle = '#1d2a4e'; ctx.fillRect(-1000, WATER, W + 2000, 800);
  ctx.fillStyle = '#16203e';
  for (let i = 0; i < 70; i++) {
    const x = -400 + i * 40, h = 90 + 70 * Math.abs(Math.sin(i * 1.7)), sway = 8 * Math.sin(t * 1.2 + i);
    ctx.beginPath(); ctx.moveTo(x - 14, WATER); ctx.quadraticCurveTo(x + sway, WATER - h * 0.6, x + sway * 2, WATER - h); ctx.quadraticCurveTo(x + 6, WATER - h * 0.5, x + 14, WATER); ctx.fill();
  }

  const dot = glowDot();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of flies) {
    const b = pulse(f.th);
    // 水面の映りこみ（下にさかさま、少しゆらゆら）
    const ry = 2 * WATER - f.y + 6 * Math.sin(t * 3 + f.x * 0.02);
    stamp(ctx, dot, f.x + 4 * Math.sin(t * 2 + f.y * 0.03), ry, { s: 0.3 + 0.9 * b, a: 0.25 * (0.15 + b) });
    stamp(ctx, dot, f.x, f.y, { s: 0.25 + 0.8 * b, a: 0.2 + 0.55 * b });
  }
  for (const f of flies) {
    const b = pulse(f.th);
    const pop = 1 + 0.5 * expImpulse(f.flash, 14);
    if (b > 0.25) stamp(ctx, sprite('ぴか', { size: 30, color: '#f4ff9a' }), f.x, f.y - 2, { s: pop * (0.75 + 0.35 * b), a: b, rot: 0.2 * perlin(f.seed, t) });
    else stamp(ctx, sprite('・', { size: 30, color: '#9fe0a0' }), f.x, f.y, { a: 0.6 });
  }
  ctx.globalCompositeOperation = 'source-over';

  // そろい度メーター（画面に固定）
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const mx = 1380, my = 70;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(mx, my, 460, 46, 23); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8ff8a'; ctx.beginPath(); ctx.roundRect(mx + 6, my + 6, 448 * R, 34, 17); ctx.fill();
  stamp(ctx, sprite(`そろい度 r = ${R.toFixed(2)}`, { size: 34, color: '#ffffff' }), mx + 230, my + 86);
  const label = R > 0.85 ? 'そろった！' : R > 0.45 ? 'そろってきた' : 'ばらばら';
  stamp(ctx, sprite(label, { size: 58, color: R > 0.85 ? '#f4ff9a' : '#ffffff', stroke: '#141a3a', sw: 8 }), 250, 110, { s: R > 0.85 ? 1 + 0.08 * all : 1 });
  stamp(ctx, sprite(`ひっぱり K = ${K(t).toFixed(1)}`, { size: 30, color: '#c9d6ff' }), 250, 180);
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
