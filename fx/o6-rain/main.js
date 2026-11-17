// o6 ぽつぽつ → しとしと → ざあざあ：擬音そのものが雨粒になって降る。段階ごとに、数・速さ・風・文字が変わる
// 群の動き：雨粒は「風で斜めに、まっすぐ落ちる」だけ。段階で 1秒あたりの数と速さを上げる
//           かさに当たると「ぱちっ」、地面に当たると「ぴちゃ」がはねて（放物線）、水たまりに波紋
// 1文字ずつ：速いほど縦に伸びる（つぶしと伸ばし）。段階ごとに文字が変わる（ぽ・つ → し・と → ざ・あ）
// 演出：段階の名前がぽんと出る、カメラはだんだん引く、ざあざあで手ぶれと雷、最後は虹
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutBack, easeOutElastic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { sprite, stamp, camera, shake, mix } from '../lib/onoma.js';

const LOOP = 13, GROUND = 900, UX = W / 2 + 120, UY = 560, UR = 250;
const INK = PAL.ink;
// 段階：[始まる秒, 名前, 1秒の数, 落ちる速さ, 風, 文字, 大きさ, 空の色]
const STAGES = [
  [0.0, 'ぽつぽつ', 7, 700, 0.02, ['ぽ', 'つ'], 50, '#cfe8ff'],
  [3.4, 'しとしと', 55, 1000, 0.1, ['し', 'と'], 38, '#b9c9e6'],
  [6.8, 'ざあざあ', 330, 1700, 0.28, ['ざ', 'あ'], 32, '#8d93b8'],
  [10.4, 'やんだ！', 0, 700, 0.0, ['ぽ'], 40, '#d8f0ff'],
];
const stageAt = t => { let i = 0; while (i + 1 < STAGES.length && t >= STAGES[i + 1][0]) i++; return i; };
chip('雨：数と速さだけを段階で上げる ／ 速いほど縦に伸びる ／ はねは放物線<small>y = y0 + v·t ／ はね：y = v0·t + ½·g·t² ／ 伸び：sy = 1 + v/1500</small>');

let drops, splats, rings, rand;
function setup() { drops = []; splats = []; rings = []; rand = rng(21); }

function update(t, dt) {
  const i = stageAt(t), [, , rate, speed, wind, chars, size] = STAGES[i];
  // 段階の切り替わりは急にせず、0.6秒かけて混ぜる
  const k = i > 0 ? easeInOutCubic(range01(t, STAGES[i][0], STAGES[i][0] + 0.6)) : 1;
  const prev = STAGES[Math.max(0, i - 1)];
  const r = lerp(prev[2], rate, k), sp = lerp(prev[3], speed, k), wd = lerp(prev[4], wind, k);
  let n = r * dt; while (n > 0) { if (rand() < n) drops.push({ x: -300 + rand() * (W + 900), y: -100 - rand() * 200, vx: -wd * sp, vy: sp * (0.9 + rand() * 0.2), ch: chars[Math.floor(rand() * chars.length)], size }); n -= 1; }
  // 最後の段階：大きな「ぽつ」を一粒だけ、かさのてっぺんに
  if (i === 3 && !drops.last && t > STAGES[3][0] + 0.9) { drops.last = true; drops.push({ x: UX + 40, y: -100, vx: 0, vy: 600, ch: 'ぽつ', size: 56 }); }
  for (const d of drops) {
    d.x += d.vx * dt; d.y += d.vy * dt;
    const dx = d.x - UX, dy = d.y - UY;
    if (dy < 0 && dx * dx + dy * dy < UR * UR) { d.dead = 'umb'; }
    else if (d.y > GROUND) d.dead = 'ground';
    if (d.dead) {
      const big = d.size > 45;
      if (d.dead === 'umb' || rand() < (big ? 1 : 0.35)) {
        for (let j = 0; j < (big ? 3 : 1); j++)
          splats.push({ x: d.x, y: d.dead === 'umb' ? UY - Math.sqrt(Math.max(0, UR * UR - dx * dx)) : GROUND, vx: (rand() - 0.5) * 420 + (d.dead === 'umb' ? dx * 1.2 : 0), vy: -200 - rand() * 260, age: 0, w: d.dead === 'umb' ? 'ぱちっ' : 'ぴちゃ', big });
      }
      if (d.dead === 'ground' && rand() < (big ? 1 : 0.25)) rings.push({ x: d.x, age: 0, big });
    }
  }
  drops = Object.assign(drops.filter(d => !d.dead), { last: drops.last });
  for (const s of splats) { s.vy += 1600 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.age += dt; }
  splats = splats.filter(s => s.age < 0.6);
  for (const r of rings) r.age += dt;
  rings = rings.filter(r => r.age < 1);
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  const i = stageAt(t), st = STAGES[i];
  const k = i > 0 ? easeInOutCubic(range01(t, st[0], st[0] + 0.8)) : 1;
  const sky = mix(STAGES[Math.max(0, i - 1)][7], st[7], k);
  // 雷：ざあざあの途中で2回
  const bolt = i === 2 ? Math.max(expImpulse(Math.max(0, t - 8.6), 12), expImpulse(Math.max(0, t - 9.1), 16)) : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = mix(sky, '#ffffff', bolt * 0.8); ctx.fillRect(0, 0, W, H);

  // カメラ：段階ごとに引いていく。ざあざあでは揺れる
  const zoom = [1.55, 1.18, 0.98, 1.05][i], zprev = [1.55, 1.55, 1.18, 0.98][i];
  const z = lerp(zprev, zoom, easeInOutCubic(range01(t, st[0], st[0] + 1.6)));
  const [qx, qy] = shake(t, i === 2 ? 6 + 20 * bolt : 0);
  camera(ctx, { x: lerp(UX, W / 2, clamp((1.55 - z) / 0.5)) + qx, y: lerp(UY + 90, 540, clamp((1.55 - z) / 0.5)) + qy, zoom: z, rot: i === 2 ? -0.02 : 0 });

  // 虹（最後）
  const bow = easeOutElastic(range01(t, STAGES[3][0] + 1.2, STAGES[3][0] + 2.4));
  if (bow > 0) {
    ['#ff8fb8', '#ffc29f', '#ffe27a', '#8fe3cf', '#9fd8ff', '#b9a6ff'].forEach((c, j) => {
      ctx.strokeStyle = c; ctx.lineWidth = 34;
      ctx.beginPath(); ctx.arc(W / 2, GROUND + 200, (900 - j * 34) * bow, Math.PI, 0); ctx.stroke();
    });
  }
  // 地面と水たまり
  ctx.fillStyle = mix('#a8e2c0', '#6e8f9a', i === 2 ? k : i === 3 ? 1 - k : 0); ctx.fillRect(-2000, GROUND, 6000, 800);
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-2000, GROUND); ctx.lineTo(6000, GROUND); ctx.stroke();
  const puddle = [0.3, 0.6, 1, 1][i];
  ctx.fillStyle = 'rgba(160,210,255,.7)';
  for (const px of [W / 2 - 520, W / 2 + 560, W / 2 - 60]) { ctx.beginPath(); ctx.ellipse(px, GROUND + 40, 200 * puddle, 26 * puddle, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const r of rings) {
    ctx.strokeStyle = `rgba(255,255,255,${1 - r.age})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(r.x, GROUND + 24, 70 * r.age * (r.big ? 2 : 1), 10 * r.age * (r.big ? 2 : 1), 0, 0, Math.PI * 2); ctx.stroke();
  }

  // かさの下の子
  drawFriend(ctx, t, i);
  drawUmbrella(ctx, t, i);

  // 雨粒の文字：速いほど縦に伸びる。傾きは落ちる向きに合わせる
  for (const d of drops) {
    const sp = Math.hypot(d.vx, d.vy);
    stamp(ctx, sprite(d.ch, { size: d.size, color: '#ffffff', stroke: '#5aa8e6', sw: 4 }), d.x, d.y,
      { sx: 1 / Math.sqrt(1 + sp / 1500), sy: 1 + sp / 1500, rot: Math.atan2(-d.vx, d.vy), a: d.size > 45 ? 1 : 0.92 });
  }
  for (const s of splats) stamp(ctx, sprite(s.w, { size: s.big ? 34 : 22, color: '#ffffff', stroke: '#5aa8e6', sw: 3 }), s.x, s.y, { a: 1 - s.age / 0.6, s: 0.6 + 0.6 * expImpulse(s.age, 12) });
  if (bolt > 0.05) stamp(ctx, sprite('ゴロゴロ…', { size: 90, color: PAL.yellow, stroke: INK, sw: 10 }), W / 2 + 600, 260, { a: clamp(bolt * 3), rot: -0.1, s: 1 + 0.2 * bolt });

  // 段階の名前（左上）。切り替わると、ぽんと出る
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pop = easeOutBack(range01(t, st[0] + 0.1, st[0] + 0.5));
  stamp(ctx, sprite(st[1], { size: 110, color: '#ffffff', stroke: INK, sw: 12 }), 330, 140, { s: pop, rot: -0.05 + 0.02 * Math.sin(t * 2) });
  stamp(ctx, sprite(i < 3 ? `1秒に ${st[2]} つぶ` : 'あめあがり', { size: 40, color: INK, stroke: '#fff', sw: 6 }), 330, 240, { s: pop });
}

function drawUmbrella(ctx, t, i) {
  const sway = 0.03 * Math.sin(t * 1.3) + (i === 2 ? 0.05 * Math.sin(t * 7) : 0);
  ctx.save(); ctx.translate(UX, UY); ctx.rotate(sway);
  ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 280); ctx.arc(-24, 280, 24, 0, Math.PI); ctx.stroke();
  ctx.fillStyle = PAL.pink;
  ctx.beginPath(); ctx.arc(0, 0, UR, Math.PI, 0);
  for (let j = 4; j >= 0; j--) { const x0 = -UR + j * (UR * 2 / 5); ctx.quadraticCurveTo(x0 + UR / 5 + UR / 5 - UR / 5, 34, x0, 0); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -UR, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawFriend(ctx, t, i) {
  const x = UX - 10, y = GROUND - 90, hop = i === 3 ? 30 * Math.abs(Math.sin(t * 6)) : 0;
  ctx.save(); ctx.translate(x, y - hop);
  ctx.fillStyle = PAL.mint; ctx.strokeStyle = INK; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(0, 0, 110, 92, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  for (const ex of [-36, 36]) { ctx.beginPath(); ctx.arc(ex, -10, 9, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,143,184,.6)';
  for (const ex of [-62, 62]) { ctx.beginPath(); ctx.ellipse(ex, 16, 16, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath();
  if (i === 3) ctx.arc(0, 14, 16, 0, Math.PI); else ctx.arc(0, 26, 10, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
