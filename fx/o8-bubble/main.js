// o8 ぶくぶく：海の底から「ぷく」の泡が上がり、ぶつかるとくっついて大きくなり、水面で「ぱちん！」とはじける
// 群の動き：泡は大きいほど速く浮く（v = a + b·r）。上るほど水圧が下がって少しふくらむ
//           2つの泡が重なったら1つにまとめる：体積（2D なので面積）を足す → r = √(r1² + r2²)
// 1文字ずつ：大きさで文字が変わる（ぷ → ぷく → ぶく → ぼこっ）。くっついた瞬間にぷるぷる揺れる（減衰する sin）
// 演出：カメラは主役の泡を追って海底から水面へ、はじける瞬間に寄る
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutBack, easeOutExpo } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { SecondOrder } from '../lib/spring.js';
import { sprite, stamp, camera } from '../lib/onoma.js';

const LOOP = 11, SEABED = 2000, SURF = 200, INK = PAL.ink;
const FISH = [W / 2 - 520, SEABED - 230];
chip('ぶくぶく：大きい泡ほど速く浮く ／ くっつくと r = √(r1² + r2²) ／ ぷるぷるは減衰する sin<small>v = a + b·r ／ 面積の和 ／ e^(−kt)·sin(ωt)</small>');
const wordOf = r => r < 20 ? 'ぷ' : r < 36 ? 'ぷく' : r < 62 ? 'ぶく' : 'ぼこっ';

let bubbles, pops, rand, hero, camY, popAt;

function setup() {
  rand = rng(31); bubbles = []; pops = []; hero = null; popAt = -1;
  camY = new SecondOrder(0.5, 1, 0, SEABED - 420);
}

function spawn(x, y, r, extra = {}) { const b = { x, y, r, age: 0, seed: rand() * 50, jig: 0, jigT: -9, ...extra }; bubbles.push(b); return b; }

function update(t, dt) {
  // 魚のくちから「ぷく」と、海底の穴から細かい泡
  if (rand() < dt * 5 && t < 8.5) spawn(FISH[0] + 120, FISH[1] - 10, 10 + rand() * 10);
  if (rand() < dt * 9 && t < 8.5) spawn(W / 2 + 300 + (rand() - 0.5) * 60, SEABED - 40, 8 + rand() * 14);
  if (rand() < dt * 4 && t < 8.5) spawn(200 + rand() * (W - 400), SEABED - 40, 8 + rand() * 10);
  if (!hero && t > 0.8) hero = spawn(FISH[0] + 130, FISH[1] - 20, 38, { hero: true });
  for (const b of bubbles) {
    const v = (90 + 3.4 * b.r) * (b.hero ? 0.62 : 1);       // 大きいほど速い（主役はゆっくり見せる）
    b.y -= v * dt; b.age += dt;
    b.x += 40 * Math.sin(b.age * (6 - Math.min(4, b.r / 20)) + b.seed) * dt;   // ゆらゆら
    if (b.hero) b.x += (W / 2 - 60 - b.x) * 0.6 * dt;          // 主役は真ん中寄りに
    b.r += b.r * 0.00006 * v * dt * 10;                        // 上るほど、少しふくらむ
  }
  // くっつく：重なった2つを1つに
  for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
    const a = bubbles[i], b = bubbles[j];
    if (a.dead || b.dead) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.85) {
      const [big, small] = (a.hero || (!b.hero && a.r >= b.r)) ? [a, b] : [b, a];
      const A1 = big.r * big.r, A2 = small.r * small.r;
      big.x = (big.x * A1 + small.x * A2) / (A1 + A2); big.y = (big.y * A1 + small.y * A2) / (A1 + A2);
      big.r = Math.sqrt(A1 + A2); big.jigT = t; small.dead = true;
    }
  }
  // 水面ではじける
  for (const b of bubbles) if (!b.dead && b.y - b.r < SURF + 10) {
    b.dead = true;
    pops.push({ x: b.x, y: SURF, r: b.r, t, big: !!b.hero });
    if (b.hero) popAt = t;
  }
  bubbles = bubbles.filter(b => !b.dead);
  pops = pops.filter(p => t - p.t < 1.6);
  camY.update(dt, popAt > 0 ? SURF - 40 : hero && !hero.dead ? Math.max(SURF + 330, hero.y - 80) : SEABED - 420);
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#123'; ctx.fillRect(0, 0, W, H);
  const hit = popAt > 0 ? expImpulse(t - popAt, 4) : 0;
  const after = popAt > 0 ? easeInOutCubic(range01(t, popAt + 0.4, popAt + 1.6)) : 0;
  camera(ctx, { x: W / 2 + 20 * Math.sin(t * 0.4), y: camY.y - 120 * after, zoom: lerp(1.15, 0.95, after) * (1 + 0.25 * hit), rot: 0.01 * Math.sin(t * 0.6) });

  // 空と海（深いほど濃い青）
  const sky = ctx.createLinearGradient(0, SURF - 900, 0, SURF);
  sky.addColorStop(0, '#bfe6ff'); sky.addColorStop(1, '#fff3f8');
  ctx.fillStyle = sky; ctx.fillRect(-500, SURF - 1200, W + 1000, 1200);
  const sea = ctx.createLinearGradient(0, SURF, 0, SEABED);
  sea.addColorStop(0, '#7fd3ff'); sea.addColorStop(1, '#2f5fb8');
  ctx.fillStyle = sea; ctx.fillRect(-500, SURF, W + 1000, SEABED - SURF + 600);
  // 光の筋
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  for (let i = 0; i < 6; i++) { const x = i * 380 + 80 * Math.sin(t * 0.4 + i); ctx.beginPath(); ctx.moveTo(x, SURF); ctx.lineTo(x + 140, SURF); ctx.lineTo(x - 260, SEABED); ctx.lineTo(x - 520, SEABED); ctx.fill(); }
  // 水面（波）
  ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath();
  for (let x = -500; x <= W + 500; x += 20) {
    let y = SURF + 8 * Math.sin(x * 0.01 + t * 2);
    for (const p of pops) { const a = t - p.t, d = Math.abs(x - p.x); if (d < a * 600) y += (p.big ? 30 : 6) * Math.exp(-2 * a) * Math.sin(d * 0.05 - a * 20) * Math.exp(-d / 500); }
    x === -500 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // 海底・海藻・魚
  ctx.fillStyle = '#ffe1b8'; ctx.beginPath(); ctx.ellipse(W / 2, SEABED + 140, 1500, 200, 0, Math.PI, 0); ctx.fill();
  for (let i = 0; i < 9; i++) {
    const x = 120 + i * 220, h = 220 + 90 * Math.sin(i * 2.3);
    ctx.strokeStyle = i % 2 ? '#3fcf9f' : '#2fb58a'; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, SEABED);
    for (let s = 1; s <= 8; s++) ctx.lineTo(x + 26 * Math.sin(t * 1.5 + s * 0.6 + i), SEABED - h * s / 8);
    ctx.stroke();
  }
  drawFish(ctx, t);

  // 泡：うすい円 ＋ 中に文字。くっついた直後はぷるぷる（減衰する sin）
  for (const b of bubbles.slice().sort((p, q) => (p.hero ? 1 : 0) - (q.hero ? 1 : 0))) {
    const a = t - b.jigT, jig = a < 1 ? Math.exp(-5 * a) * Math.sin(a * 30) : 0;
    const sx = 1 + 0.18 * jig, sy = 1 - 0.18 * jig;
    const born = easeOutBack(clamp(b.age / 0.3));
    ctx.save(); ctx.translate(b.x, b.y); ctx.scale(sx * born, sy * born);
    ctx.fillStyle = b.hero ? 'rgba(255,190,220,.3)' : 'rgba(255,255,255,.18)'; ctx.strokeStyle = b.hero ? '#ffd6e8' : 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(3, b.r * 0.08);
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(-b.r * 0.4, -b.r * 0.45, b.r * 0.2, b.r * 0.12, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    const w = wordOf(b.r);
    stamp(ctx, sprite(w, { size: 64, color: '#ffffff', stroke: b.hero ? '#e0558f' : '#3a7fd0', sw: 6 }), b.x, b.y + 2, { s: born * b.r * 1.5 / (64 * Math.max(1.3, w.length * 0.9)), sx, sy, rot: 0.15 * Math.sin(b.age * 2 + b.seed) });
  }
  // はじける：しずくの輪 ＋「ぱちん！」
  for (const p of pops) {
    const a = t - p.t, k = easeOutExpo(clamp(a / 0.5));
    const n = p.big ? 14 : 6;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI * (i + 0.5) / n, rr = p.r * (1 + 2.4 * k);
      stamp(ctx, sprite('ぱ', { size: 26, color: '#ffffff', stroke: '#3a7fd0', sw: 4 }), p.x + Math.cos(ang) * rr, p.y + Math.sin(ang) * rr * 0.8 + 400 * a * a, { a: 1 - a / 1.2, s: p.big ? 1.2 : 0.7 });
    }
    if (p.big) stamp(ctx, sprite('ぱちん！', { size: 150, color: PAL.yellow, stroke: INK, sw: 12 }), p.x + 30, p.y - 140, { s: easeOutBack(clamp(a / 0.3)), a: 1 - range01(a, 1.1, 1.6), rot: -0.08 });
  }
  if (popAt > 0) {
    const ti = easeOutBack(range01(t, popAt + 1.2, popAt + 1.7));
    stamp(ctx, sprite('ぶくぶく', { size: 130, color: '#ffffff', stroke: '#3a7fd0', sw: 12 }), W / 2, SURF - 280, { s: ti, rot: 0.03 * Math.sin(t * 3) });
  }
}

function drawFish(ctx, t) {
  const [x, y] = FISH, puff = 1 + 0.08 * Math.sin(t * 10);
  ctx.save(); ctx.translate(x, y + 10 * Math.sin(t * 1.4));
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.fillStyle = PAL.peach;
  ctx.beginPath(); ctx.moveTo(-110, 0); ctx.lineTo(-180, -60 + 10 * Math.sin(t * 6)); ctx.lineTo(-180, 60 + 10 * Math.sin(t * 6)); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 120 * puff, 86 * puff, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(52, -20, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,143,184,.7)'; ctx.beginPath(); ctx.ellipse(40, 18, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(112, -8, 12, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
