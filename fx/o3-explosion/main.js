// o3 ドカーン：導火線「じじじ」→ ため → 爆発。火の玉の文字が飛び散って煙のきのこ雲になる
// 群の動き：中心から一斉に飛び出し、空気の抵抗で急に止まる（速度が毎秒 e^-k 倍に減る＝指数の減速）
//           冷えた文字は煙になって浮き上がる。破片は重力で落ちて一回はねる
// 1文字ずつ：温度で「ボン → ボ → ゴォ → もわ」と変わる。破片はくるくる回る
// 演出：ため（easeInBack でふくらむ）、白い閃光、スローモーション、手ぶれ、衝撃波の輪
import { W, H, PAL, run, chip, rng, range01, lerp, clamp } from '../lib/stage.js';
import { easeInOutCubic, easeOutExpo, easeInBack, easeOutElastic, easeOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';
import { perlin } from '../lib/noise.js';
import { sprite, stamp, camera, shake } from '../lib/onoma.js';

const LOOP = 10, BX = W / 2, GROUND = 860, BY = GROUND - 95, BOOM = 2.4;
const INK = PAL.ink;
const FUSE = [[BX - 560, GROUND - 20], [BX - 380, GROUND - 260], [BX - 140, GROUND - 330], [BX + 20, BY - 100]];
const fuseAt = k => { const u = 1 - k, [a, b, c, d] = FUSE; return [0, 1].map(i => u * u * u * a[i] + 3 * u * u * k * b[i] + 3 * u * k * k * c[i] + k * k * k * d[i]); };
const BANDS = [[0.8, 'ボン', '#fff3a6', 66], [0.58, 'ボン', '#ffd23f', 62], [0.36, 'ボ', '#ff9a3d', 58], [0.08, 'ゴォ', '#ff5f6d', 52], [-9, 'もわ', '#d9cfee', 56]];
const band = T => BANDS.find(b => T > b[0]);
chip('ドカーン：中心から飛び出し、指数の減速でぴたっと止まる → 冷えると煙へ<small>v ← v·e^(−k·dt) ／ easeInBack（ため）・easeOutElastic（タイトル）</small>');

let parts, debris, sparks, rand, sim, booms;
// スローモーション：爆発の瞬間だけ時間がゆっくり進む
const timescale = t => t < BOOM ? 1 : lerp(0.22, 1, easeInOutCubic(range01(t, BOOM + 0.25, BOOM + 1.1)));

function setup() { parts = []; debris = []; sparks = []; rand = rng(5); sim = 0; booms = false; }

function update(t, dt) {
  const sdt = dt * timescale(t);
  sim += sdt;
  // 導火線の火花「じ」
  if (t < BOOM) {
    const [x, y] = fuseAt(range01(t, 0.2, BOOM - 0.25));
    for (let i = 0; i < 2; i++) sparks.push({ x, y, vx: (rand() - 0.5) * 300, vy: -100 - rand() * 250, age: 0 });
  }
  for (const s of sparks) { s.vy += 600 * sdt; s.x += s.vx * sdt; s.y += s.vy * sdt; s.age += sdt; }
  sparks = sparks.filter(s => s.age < 0.5);
  // 爆発：一度だけ文字をまく
  if (t >= BOOM && !booms) {
    booms = true;
    for (let i = 0; i < 260; i++) {
      const a = -Math.PI * (rand() * 1.1 - 0.05), sp = 500 + 2400 * Math.pow(rand(), 1.2);
      parts.push({ x: BX + (rand() - 0.5) * 40, y: BY, vx: Math.cos(a) * sp * 1.15, vy: Math.sin(a) * sp, T: 0.9 + rand() * 0.3, seed: rand() * 99, age: 0 });
    }
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI * (0.1 + 0.8 * rand()), sp = 900 + 700 * rand();
      debris.push({ x: BX, y: BY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: 0, vr: (rand() - 0.5) * 20, w: ['ドカ', 'バン', 'ガラ', 'ドッ'][i % 4], bounced: false });
    }
  }
  for (const p of parts) {
    const k = p.T > 0.1 ? 3.4 : 1.8;                 // 熱いうちは強いブレーキ
    p.vx *= Math.exp(-k * sdt); p.vy *= Math.exp(-k * sdt);
    p.vy -= (p.T > 0.1 ? 120 : 170) * sdt;            // 熱い空気・煙は浮く
    // 煙はきのこの形に：中心の柱へ寄りながら上がり、上で横に広がる
    if (p.T < 0.1) { const up = clamp((BY - 300 - p.y) / 300); p.vx += ((BX - p.x) * 1.4 * (1 - up) + (p.x - BX) * 1.2 * up) * sdt; }
    p.x += p.vx * sdt; p.y += p.vy * sdt;
    if (p.y > GROUND - 20) { p.y = GROUND - 20; p.vy *= -0.3; }
    p.T -= (0.5 + 0.4 * (p.seed % 1)) * sdt; p.age += sdt;
  }
  for (const d of debris) {
    d.vy += 1500 * sdt; d.x += d.vx * sdt; d.y += d.vy * sdt; d.rot += d.vr * sdt;
    if (d.y > GROUND - 30 && d.vy > 0) { d.y = GROUND - 30; d.vy *= -0.45; d.vx *= 0.6; d.vr *= 0.5; d.bounced = true; }
  }
}

function render(t) {
  const ctx = document.getElementById('stage').getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#ffe9f3'); g.addColorStop(1, '#fff8ea');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // カメラ：火花を追う → 爆弾に寄って「ため」→ 爆発で引き、ぶるぶる揺れる
  const k = range01(t, 0.2, BOOM - 0.25), [fx, fy] = fuseAt(k);
  const near = easeInOutCubic(range01(t, 1.4, BOOM)), out = easeOutExpo(range01(t, BOOM, BOOM + 1.2));
  const quake = 46 * expImpulse(Math.max(0, t - BOOM), 2.2) + 5 * near * (1 - out);
  const [qx, qy] = shake(t, quake, 24);
  camera(ctx, {
    x: lerp(lerp(fx, BX, near), BX, out) + qx,
    y: lerp(lerp(fy, BY - 40, near), 470, out) + qy,
    zoom: lerp(lerp(1.5, 2.1, near), 0.88, out) * (1 + 0.02 * Math.sin(t * 0.6) * out),
    rot: 0.02 * Math.sin(t * 31) * expImpulse(Math.max(0, t - BOOM), 3),
  });

  // 地面
  ctx.fillStyle = '#ffe1b8'; ctx.fillRect(-2000, GROUND, 6000, 800);
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-2000, GROUND); ctx.lineTo(6000, GROUND); ctx.stroke();

  if (t < BOOM) {
    // 導火線（燃えた所まで消える）と爆弾
    ctx.strokeStyle = '#8a7a9a'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath();
    for (let u = k; u <= 1.001; u += 0.02) { const [x, y] = fuseAt(Math.min(1, u)); u === k ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    const charge = easeInBack(range01(t, BOOM - 0.55, BOOM));       // ためて、ふくらむ
    const jit = 4 * near * Math.sin(t * 70);
    const s = 1 + 0.35 * Math.max(0, charge), sy = 1 - 0.12 * Math.max(0, charge) + 0.04 * Math.sin(t * 40) * near;
    ctx.save(); ctx.translate(BX + jit, BY); ctx.scale(s, s * sy);
    ctx.fillStyle = '#4e4266'; ctx.strokeStyle = INK; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(0, 0, 95, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(-35, -40, 26, 16, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 「じじじ」と、ためる「ぷるぷる」
    for (const sp of sparks) stamp(ctx, sprite('じ', { size: 30, color: '#ffb340', stroke: '#fff', sw: 4 }), sp.x, sp.y, { a: 1 - sp.age / 0.5, s: 0.8 });
    stamp(ctx, sprite('じじじ…', { size: 46, color: INK, stroke: '#fff', sw: 6 }), fx + 20, fy - 70, { s: 1 + 0.1 * Math.sin(t * 30), a: 1 - near });
    if (near > 0.2) stamp(ctx, sprite('ぷるぷる', { size: 50, color: PAL.pink, stroke: '#fff', sw: 6 }), BX + 190, BY - 150, { a: near, rot: 0.1 * Math.sin(t * 40) });
  } else {
    // 衝撃波の輪
    const r = easeOutExpo(range01(t, BOOM, BOOM + 1.6));
    ctx.strokeStyle = `rgba(74,59,92,${0.6 * (1 - r)})`; ctx.lineWidth = 18 * (1 - r) + 2;
    ctx.beginPath(); ctx.ellipse(BX, BY, 1400 * r, 900 * r, 0, 0, Math.PI * 2); ctx.stroke();
    // 地面のくぼみ
    ctx.fillStyle = '#e7c49a'; ctx.beginPath(); ctx.ellipse(BX, GROUND + 6, 230, 34, 0, 0, Math.PI * 2); ctx.fill();
    // 煙 → 火の玉の順に（煙を後ろに）
    const order = parts.slice().sort((a, b) => a.T - b.T);
    for (const p of order) {
      const [, w, c, size] = band(p.T);
      const smoke = p.T <= 0.08;
      const a = smoke ? clamp(1 - (0.08 - p.T) / 2.6) * 0.9 : 1;
      const grow = smoke ? 1 + 0.6 * clamp((0.08 - p.T) / 1.2) : 0.8 + 0.4 * expImpulse(p.age, 6);
      stamp(ctx, sprite(w, { size, color: c, stroke: smoke ? '#ffffff' : INK, sw: 5 }), p.x, p.y, { s: grow, a, rot: 0.5 * perlin(p.seed, t * (smoke ? 0.4 : 2)) });
    }
    for (const d of debris) stamp(ctx, sprite(d.w, { size: 54, color: '#ffffff', stroke: INK, sw: 6 }), d.x, d.y, { rot: d.rot, s: 0.9 });
    // タイトル「ドカーン！」
    const title = easeOutElastic(range01(t, BOOM + 1.9, BOOM + 3.1));
    if (title > 0) {
      const wob = expImpulse(Math.max(0, t - BOOM - 1.9), 4);
      stamp(ctx, sprite('ドカーン！', { size: 190, color: PAL.yellow, stroke: INK, sw: 14 }), BX, 190,
        { s: title, sx: 1 + 0.1 * wob, sy: 1 - 0.1 * wob, rot: -0.06 + 0.02 * Math.sin(t * 2) });
    }
  }
  // 閃光（画面いっぱいの白）
  const flash = expImpulse(Math.max(0, t - BOOM), 14) * (t >= BOOM ? 1 : 0);
  if (flash > 0.01) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(255,255,240,${0.95 * flash})`; ctx.fillRect(0, 0, W, H); }
}

run({ setup, update, render, loop: LOOP, fonts: ['800 40px "M PLUS Rounded 1c"'] });
