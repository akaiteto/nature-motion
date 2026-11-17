// o2 もくもく：汽車の煙突から「もく」の煙が出て、ふくらみながら空へ。最後は空で大きな「もくもく」になる
// 群の動き：ひと吹き（パフ）ごとに、中心は上へ飛んで減速（指数の減速）、文字は中心からふくらむように離れる
//           ＋ カールノイズでゆらゆら。最後は「目標に近づくほどゆっくり」（arrive）で文字の形に集まる
// 1文字ずつ：ふくらむ（easeOutCubic）、ゆっくり回る、色が白 → 薄むらさきへ
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutCubic, easeOutBack } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { curl, perlin } from '../lib/noise.js';
import { SecondOrder } from '../lib/spring.js';
import { sprite, stamp, textPoints, camera } from '../lib/onoma.js';

const LOOP = 11, GROUND = 900, SPEED = 250, PUFF = 0.42, GATHER = 6.2;
const INK = PAL.ink;
chip('もくもく：ふくらむ煙のかたまり ＋ カールノイズ → 最後は文字へ集まる（arrive）<small>easeOutCubic ／ curl noise ／ Reynolds の arrive</small>');

let parts, puffs, rand, camX, camS, word, wordAt, sounds;
const trainX = t => 260 + SPEED * Math.min(t, GATHER + 1.2) - 40 * expImpulse(Math.max(0, t - GATHER - 1.2), 2);

function setup() {
  parts = []; puffs = []; sounds = []; rand = rng(11);
  camX = new SecondOrder(0.6, 0.9, 0, trainX(0));
  camS = 0;
  word = textPoints('もくもく', { size: 340, step: 30 });
  wordAt = null;
}

function update(t, dt) {
  // ひと吹き：PUFF 秒ごと（汽笛の時は大きく）
  const n = Math.floor(t / PUFF), prev = Math.floor((t - dt) / PUFF);
  if (n !== prev && t < GATHER) {
    const big = n % 6 === 5;
    const cx = trainX(t) + 120, cy = GROUND - 250;
    const puff = { x: cx, y: cy, vx: -40, vy: big ? -520 : -360, age: 0 };
    puffs.push(puff);
    const m = big ? 18 : 11;
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + rand() * 0.4;
      parts.push({ puff, a, r: (big ? 110 : 75) * (0.4 + 0.6 * rand()), age: 0, seed: rand() * 50, w: rand() < 0.7 ? 'もく' : 'もわ', x: cx, y: cy, size: big ? 1.25 : 1 });
    }
    sounds.push({ x: cx + 40, y: cy - 30, age: 0, w: big ? 'ぽっぽー！' : 'しゅっ', big });
  }
  // パフの中心：上へ飛び、空気の抵抗で減速。少し浮く
  for (const p of puffs) {
    p.vx *= Math.exp(-1.2 * dt); p.vy *= Math.exp(-1.6 * dt);
    p.x += (p.vx - 60) * dt; p.y += (p.vy - 25) * dt; p.age += dt;
  }
  // 集まり始める時：空にある文字に、目標の点を割り当てる
  if (t >= GATHER && !wordAt) {
    wordAt = { x: trainX(GATHER) - 380, y: 230 };
    // 点の数より煙の文字が少なければ、近くの煙から分ける
    while (parts.length < word.length) { const q = parts[Math.floor(rand() * parts.length)]; parts.push({ ...q, seed: rand() * 50 }); }
    const order = parts.slice().sort((a, b) => a.x - b.x);
    word.forEach((w, i) => { const p = order[Math.floor(i * order.length / word.length)]; if (p && !p.goal) p.goal = { x: wordAt.x + w.x, y: wordAt.y + w.y, d: rand() * 0.6 }; });
    for (const p of parts) if (!p.goal) p.fade = t;
  }
  for (const p of parts) {
    p.age += dt;
    if (p.goal) {
      // arrive：目標に近いほどゆっくり。ばねではなく「残りの距離の一定割合」を毎コマ進む
      const k = range01(t, GATHER + p.goal.d, GATHER + p.goal.d + 0.4);
      const sp = 3.2 * easeInOutCubic(k);
      p.x += (p.goal.x - p.x) * (1 - Math.exp(-sp * dt));
      p.y += (p.goal.y - p.y) * (1 - Math.exp(-sp * dt));
      continue;
    }
    const grow = easeOutCubic(clamp(p.age / 2.6));
    const [cx, cy] = curl(p.x * 0.004, p.y * 0.004, t * 0.3);
    const tx = p.puff.x + Math.cos(p.a) * p.r * (0.3 + 2.0 * grow), ty = p.puff.y + Math.sin(p.a) * p.r * (0.3 + 1.5 * grow);
    p.x = lerp(p.x, tx, 0.25) + cx * 40 * dt * p.age * 4;
    p.y = lerp(p.y, ty, 0.25) + cy * 40 * dt * p.age * 4;
  }
  for (const s of sounds) s.age += dt;
  sounds = sounds.filter(s => s.age < 0.8);
  camX.update(dt, t < GATHER ? trainX(t) + 200 : trainX(GATHER) - 380);
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#fff1f7');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // カメラ：煙突に寄って始まり → 引いて汽車を追う → 最後は空を見上げる
  const pull = easeInOutCubic(range01(t, 0.3, 2.2)), up = easeInOutCubic(range01(t, GATHER - 0.4, GATHER + 1.4));
  camera(ctx, {
    x: camX.y,
    y: lerp(lerp(GROUND - 300, GROUND - 400, pull), wordAt ? wordAt.y + 60 : 400, up),
    zoom: lerp(lerp(1.7, 0.85, pull), 1.0, up),
    rot: 0.015 * Math.sin(t * 0.7) * (1 - up),
  });

  // 遠くの丘と線路
  ctx.fillStyle = '#c9f0d9';
  for (let i = -2; i < 12; i++) { ctx.beginPath(); ctx.ellipse(i * 700, GROUND + 40, 520, 180, 0, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = '#a8e2c0'; ctx.fillRect(-2000, GROUND, 8000, 600);
  ctx.strokeStyle = INK; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-2000, GROUND + 4); ctx.lineTo(6000, GROUND + 4); ctx.stroke();
  for (let x = -2000; x < 6000; x += 60) { ctx.fillStyle = '#b48a6a'; ctx.fillRect(x, GROUND + 8, 36, 10); }

  // 集まった後：文字の下に白い雲の下地をふくらませる
  const cloud = easeOutBack(range01(t, GATHER + 1.6, GATHER + 2.4));
  if (cloud > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const p of parts) if (p.goal) { ctx.beginPath(); ctx.arc(p.x, p.y, 34 * cloud, 0, Math.PI * 2); ctx.fill(); }
  }
  // 煙（古いパフほど後ろ）
  for (const p of parts) {
    const grow = easeOutCubic(clamp(p.age / 1.8));
    let a = 1;
    if (p.fade) a = 1 - range01(t, p.fade, p.fade + 0.8);
    const col = p.goal && t > GATHER + 0.5 ? '#ffffff' : (p.age > 2.5 ? '#f3eeff' : '#ffffff');
    const pop = p.goal ? 1 + 0.25 * expImpulse(Math.max(0, t - GATHER - p.goal.d - 1.2), 5) : 1;
    stamp(ctx, sprite(p.w, { size: 52, color: col, stroke: '#b9a6ff', sw: 5 }), p.x, p.y,
      { s: p.goal ? lerp((0.45 + 0.75 * grow) * p.size, 0.78, range01(t, GATHER, GATHER + 1.5)) * pop : (0.45 + 0.75 * grow) * p.size, rot: p.goal ? 0 : 0.4 * perlin(p.seed, t * 0.5), a });
  }

  // 汽車
  drawTrain(ctx, trainX(t), GROUND, t);
  // 音の文字「しゅっ」「ぽっぽー！」
  for (const s of sounds) {
    const k = s.age / 0.8, pop = easeOutBack(clamp(s.age / 0.2));
    stamp(ctx, sprite(s.w, { size: s.big ? 64 : 40, color: s.big ? PAL.pink : INK, stroke: '#fff', sw: 6 }), s.x + 60 * k, s.y - 40 * k, { s: pop, a: 1 - k * k, rot: -0.15 });
  }
}

function drawTrain(ctx, x, y, t) {
  const bob = 3 * Math.sin(t * 18);
  ctx.save(); ctx.translate(x, y - 40 + bob);
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  const box = (bx, by, w, h, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(bx, by, w, h, r); ctx.fill(); ctx.stroke(); };
  box(70, -230, 70, 90, 14, '#7a6a8f');          // 煙突
  box(50, -240, 110, 30, 12, '#7a6a8f');
  box(-20, -150, 260, 120, 50, PAL.pink);         // ボイラー
  box(-200, -230, 190, 200, 26, PAL.sky);         // 運転室
  box(-170, -200, 120, 70, 16, '#fffaf0');        // 窓
  box(-230, -40, 490, 40, 18, '#7a6a8f');         // 台
  ctx.fillStyle = INK; ctx.font = `800 54px "M PLUS Rounded 1c", sans-serif`; ctx.textAlign = 'center';
  ctx.fillText('ぽ', 110, -72);
  ctx.restore();
  // 車輪（回る）
  for (const wx of [-140, 0, 170]) {
    ctx.save(); ctx.translate(x + wx, y - 26); ctx.rotate(t * SPEED / 46);
    ctx.fillStyle = PAL.yellow; ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(40, 0); ctx.moveTo(0, -40); ctx.lineTo(0, 40); ctx.stroke();
    ctx.restore();
  }
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
