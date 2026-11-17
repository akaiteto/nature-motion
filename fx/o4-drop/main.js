// o4 ぽたっ：蛇口の先に「ぷく」の文字が集まってしずくになり、くびれて、ぽたっと落ちて、ぴちゃんとはねる
// 群の動き：文字は「しずくの形の中の決まった席」へ、ばねで引っぱられる（席が動くと、遅れてぷるぷる追いかける）
//           しずくの形：ふくらむ → 下が重くなって伸びる → ちぎれる → 落ちる（速いほど縦に伸びる）
//           着水：文字は王冠のように放物線で飛び散る。水面には波紋（減衰する sin 波）
// 演出：しずくを追うカメラ、着水の瞬間のスローモーション、2滴目は引きの画で
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutBack, easeInOutSine, easeOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { sprite, stamp, camera, shake } from '../lib/onoma.js';

const LOOP = 10, PERIOD = 5, TIPX = W / 2, TIPY = 170, SURF = 880, N = 40, G = 2600;
const INK = PAL.ink, WATER = '#5cc3ff';
chip('ぽたっ：文字を「しずくの形の席」へばねで引く ／ 着水で放物線にはねる ／ 波紋は減衰する sin 波<small>F = −k(x − 席) − c·v ／ y = A·e^(−at)·sin(kr − ωt)</small>');

let hitT = -9, parts, rand, sim, drops, ripples, sounds, jets;
// しずくの席：ひまわりの種の並び（どの点も均等にちらばる）
const SEAT = [...Array(N)].map((_, i) => { const r = Math.sqrt((i + 0.5) / N), a = i * 2.39996; return [r * Math.cos(a), r * Math.sin(a)]; });
let ts = 1, lastHit = -9;   // スローモーションの速さ（着水の直前〜直後だけ 0.22 倍）

function setup() { hitT = -9; ts = 1; lastHit = -9; parts = []; rand = rng(4); sim = 0; drops = []; ripples = []; sounds = []; jets = []; newDrop(); }

function newDrop() {
  const d = { R: 14, y: TIPY, vy: 0, stretch: 1, phase: 'grow', age: 0 };
  drops.push(d);
  for (let i = 0; i < N; i++) parts.push({ d, seat: SEAT[i], x: TIPX + (rand() - 0.5) * 10, y: TIPY, vx: 0, vy: 0, seed: rand(), w: i % 3 ? 'ぷく' : 'とろ' });
}

function update(t, dt) {
  const near = drops.some(d => d.phase === 'fall' && d.y > SURF - 300) || sim - lastHit < 0.3;
  ts += ((near ? 0.22 : 1) - ts) * Math.min(1, dt * (near ? 14 : 3));
  const sdt = dt * ts;
  sim += sdt;
  const local = t % PERIOD;
  for (const d of drops) {
    d.age += sdt;
    if (d.phase === 'grow') {
      d.R = lerp(16, 92, easeInOutSine(clamp(local / 2.3)));
      d.stretch = 1 + 0.5 * easeInOutCubic(range01(local, 1.9, 2.55));     // 重くなって下に伸びる
      d.y = TIPY + d.R * d.stretch * 1.05;
      if (local >= 2.55) { d.phase = 'fall'; sounds.push({ w: 'ぷつっ', x: TIPX + 90, y: TIPY + 40, age: 0, size: 44 }); }
    } else if (d.phase === 'fall') {
      d.vy += G * sdt; d.y += d.vy * sdt;
      d.stretch = lerp(d.stretch, 1 + Math.min(0.6, d.vy / 2500), 0.2);
      if (d.y + d.R > SURF) {
        d.phase = 'gone'; lastHit = sim; hitT = t;
        ripples.push({ x: TIPX, t: sim });
        jets.push({ t: sim });
        sounds.push({ w: 'ぴちゃん！', x: TIPX + 230, y: SURF - 170, age: 0, size: 80 });
        // 王冠：文字を外向き・上向きに打ち上げる
        for (const p of parts) if (p.d === d) {
          const side = p.seat[0] >= 0 ? 1 : -1, a = (-Math.PI / 2) + side * (0.35 + 0.75 * rand());
          const sp = 600 + 600 * rand();
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.free = true; p.x = TIPX + p.seat[0] * 60; p.y = SURF - 10;
        }
      }
    }
  }
  if (Math.floor(t / PERIOD) !== Math.floor((t - dt) / PERIOD) && t > 0.1) newDrop();
  for (const p of parts) {
    if (p.free) {                       // 飛び散った文字：放物線
      p.vy += G * 0.7 * sdt; p.x += p.vx * sdt; p.y += p.vy * sdt;
      if (p.y > SURF + 10 && p.vy > 0) { p.dead = true; ripples.push({ x: p.x, t: sim, small: true }); }
      continue;
    }
    const d = p.d;
    // 席の位置：上は細く（しずく形）、下ほど重い
    const [u, v] = p.seat;
    const taper = 1 - 0.5 * Math.pow(Math.max(0, -v), 1.4) * (d.stretch - 0.6);
    const tx = TIPX + u * d.R * taper / Math.sqrt(d.stretch), ty = d.y + v * d.R * d.stretch;
    // ばね：k = 220、減衰 c = 14（少し揺れる）
    p.vx += ((tx - p.x) * 220 - p.vx * 14) * sdt; p.vy += ((ty - p.y) * 220 - p.vy * 14) * sdt;
    p.x += p.vx * sdt; p.y += p.vy * sdt;
  }
  parts = parts.filter(p => !p.dead);
  drops = drops.filter(d => d.phase !== 'gone');
  for (const s of sounds) s.age += sdt;
  sounds = sounds.filter(s => s.age < 1.4);
  ripples = ripples.filter(r => sim - r.t < 3);
}

// 水面の高さ：波紋ごとに、中心から広がる減衰する sin 波を足す
function surfaceY(x) {
  let y = SURF;
  for (const r of ripples) {
    const age = sim - r.t, dist = Math.abs(x - r.x), front = age * 520;
    if (dist > front) continue;
    const A = (r.small ? 4 : 22) * Math.exp(-1.6 * age) * Math.exp(-dist / 700);
    y += A * Math.sin(dist * 0.045 - age * 23);
  }
  return y;
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#e9f8ff'); g.addColorStop(1, '#fdf2ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // カメラ：1滴目は蛇口に寄って、しずくを追いかけて下へ。2滴目は引きの画
  const first = t < PERIOD, local = t % PERIOD;
  const d = drops[0];
  const followY = d ? clamp(d.y, TIPY, SURF - 120) : SURF - 120;
  const hit = t >= hitT ? expImpulse(t - hitT, 5) : 0;
  const [qx, qy] = shake(t, 10 * hit);
  const wide = hitT < 0 ? 0 : easeInOutCubic(range01(t, hitT + 0.3, hitT + 1.5));
  const cam = first
    ? { x: TIPX + qx, y: lerp(followY + 40, 560, wide) + qy, zoom: lerp(2.0 - 0.6 * clamp((followY - TIPY) / 600), 1, wide) * (1 + 0.15 * hit), rot: 0 }
    : { x: TIPX + 120 * Math.sin(t * 0.3) + qx, y: 540 + qy, zoom: 1.0 + 0.06 * hit, rot: 0.01 * Math.sin(t * 0.5) };
  camera(ctx, cam);

  // 蛇口
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.fillStyle = '#c9d6e8';
  ctx.beginPath(); ctx.roundRect(TIPX - 420, TIPY - 150, 380, 90, 30); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(TIPX - 90, TIPY - 150, 130, 140, [30, 30, 20, 20]); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.roundRect(TIPX - 330, TIPY - 230, 140, 60, 24); ctx.fill(); ctx.stroke();

  // 水
  ctx.beginPath(); ctx.moveTo(-1400, H + 800);
  for (let x = -1400; x <= W + 1400; x += 12) ctx.lineTo(x, surfaceY(x));
  ctx.lineTo(W + 1400, H + 800); ctx.closePath();
  const wg = ctx.createLinearGradient(0, SURF, 0, SURF + 400);
  wg.addColorStop(0, '#9fe0ff'); wg.addColorStop(1, '#5cb8f0');
  ctx.fillStyle = wg; ctx.fill(); ctx.stroke();
  // 波紋の輪（上から見た楕円）
  for (const r of ripples) {
    const age = sim - r.t; if (r.small || age > 2.2) continue;
    for (let k = 0; k < 3; k++) {
      const a = age - k * 0.18; if (a <= 0) continue;
      const rr = 520 * a;
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - age / 2.2)})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(r.x, SURF + 30, rr, rr * 0.12, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // はね返りの柱（ワージントン・ジェット）と、ぴょんと上がる小さなしずく
  for (const j of jets) {
    const a = sim - j.t; if (a > 1.6) continue;
    const h = 170 * Math.sin(Math.PI * clamp(a / 0.6));
    if (h > 1) { ctx.fillStyle = '#9fe0ff'; ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(TIPX - 18, SURF - h, 36, h + 20, 18); ctx.fill(); ctx.stroke(); }
    const b = a - 0.35;
    if (b > 0 && b < 1.0) {
      const y = SURF - 170 - 520 * b + 0.5 * G * 0.75 * b * b;
      if (y < SURF) stamp(ctx, sprite('ぴょん', { size: 34, color: '#fff', stroke: WATER, sw: 5 }), TIPX, y, { s: 0.9 });
    }
  }

  // しずくの文字（落ちる速さで縦に伸びる）
  for (const p of parts) {
    const fall = p.free ? 0 : Math.min(0.6, Math.max(0, p.d.vy) / 2500);
    const sp = p.free ? Math.hypot(p.vx, p.vy) : 0;
    stamp(ctx, sprite(p.w, { size: 26, color: '#ffffff', stroke: '#3fa9ff', sw: 4 }), p.x, p.y,
      { sx: 1 - fall * 0.4, sy: 1 + fall, rot: p.free ? Math.atan2(p.vy, p.vx) + Math.PI / 2 : 0.2 * Math.sin(t * 3 + p.seed * 9), s: p.free ? 0.8 + sp / 4000 : 1 });
  }
  // 音の文字
  for (const s of sounds) {
    const pop = easeOutBack(clamp(s.age / 0.25)), k = s.age / 1.4;
    stamp(ctx, sprite(s.w, { size: s.size, color: s.size > 60 ? WATER : INK, stroke: '#fff', sw: 8 }), s.x, s.y - 30 * k, { s: pop, a: 1 - k * k, rot: -0.08 });
  }
  // 2滴目の終わり：タイトル
  if (!first) {
    const ti = easeOutBack(range01(local, 3.9, 4.4));
    if (ti > 0) stamp(ctx, sprite('ぽたっ', { size: 150, color: '#ffffff', stroke: '#3fa9ff', sw: 12 }), W / 2 + 470, 400, { s: ti * (1 - 0.3 * range01(local, 4.7, 5)), a: 1 - range01(local, 4.7, 5), rot: 0.05 });
  }
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
