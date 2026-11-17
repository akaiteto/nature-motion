// 03 ばらした画が、バラ曲線（花びら5枚）の軌道を回りながら集まり、「さくら」が咲く
// 使う関数：バラ曲線（lib/curves.js）、二重指数シグモイド（lib/shaping.js）、指数インパルス（lib/iq.js）
import { W, H, PAL, run, chip, range01, lerp, rng } from '../lib/stage.js';
import { loadGlyphs, layoutWord, piecesOf } from '../lib/glyph.js';
import { rose } from '../lib/curves.js';
import { doubleExponentialSigmoid } from '../lib/shaping.js';
import { expImpulse } from '../lib/iq.js';
import { easeInOutCubic, easeOutCubic } from '../lib/easing.js';
import { perlin } from '../lib/noise.js';

const ctx = document.getElementById('stage').getContext('2d');
chip('バラ曲線 r = cos(5θ) の軌道 ＋ 二重指数シグモイドで着地<small>Golan Levin / Famous Curves</small>');
const K = 5, R = 430;                 // 花びら5枚、大きさ
const CX = W / 2, CY = H / 2;
const COLORS = [PAL.pink, '#ff9fc6', '#ffb3d1', PAL.peach, '#f78fb3'];

const glyphs = await loadGlyphs('../lib/glyphs.json');
const word = layoutWord('さくら', glyphs, 360, CX, CY, 0.08);
const pieces = word.flatMap(ch => piecesOf(ch.contours));
const rand = rng(5);
pieces.forEach((p, i) => {
  p.th0 = (i / pieces.length) * Math.PI * 2;      // 軌道上の出発点（ばらばらに）
  p.start = 0.9 + i * 0.32;                         // 動き出す時刻
  p.spin = (rand() < 0.5 ? -1 : 1) * (2 + rand() * 2);
  p.color = COLORS[i % COLORS.length];
});
const petals = Array.from({ length: 70 }, (_, i) => ({ th: rand() * Math.PI * 2, r: 0.3 + rand() * 0.8, s: 8 + rand() * 12, ph: rand() * 10 }));

function piecePath(p) {
  ctx.beginPath();
  for (const poly of p.contours) { poly.forEach(([x, y], i) => (i ? ctx.lineTo(x - p.cx, y - p.cy) : ctx.moveTo(x - p.cx, y - p.cy))); ctx.closePath(); }
}

function petal(x, y, s, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath();
  ctx.moveTo(0, 0); ctx.bezierCurveTo(s, -s * 0.6, s * 1.4, s * 0.4, 0, s * 1.3); ctx.bezierCurveTo(-s * 1.4, s * 0.4, -s, -s * 0.6, 0, 0);
  ctx.fillStyle = 'rgba(255,170,200,.85)'; ctx.fill(); ctx.restore();
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // カメラ：真上から寄った状態で花びら1枚ぶん（72°）回りながら引いていく
  const k = easeInOutCubic(range01(t, 0, 5.8));
  const zoom = lerp(1.9, 1, k), rot = lerp(-Math.PI * 2 / K, 0, k);
  const land = pieces.reduce((m, p) => Math.max(m, p.start + 1.9), 0);
  const pop = 1 + 0.06 * expImpulse(Math.max(0, t - land), 6);
  ctx.translate(CX, CY); ctx.rotate(rot); ctx.scale(zoom * pop, zoom * pop); ctx.translate(-CX, -CY);

  // バラ曲線の線が描かれていく
  const draw = easeOutCubic(range01(t, 0.1, 1.6));
  const fade = 1 - range01(t, 5.5, 6.5) * 0.75;
  ctx.beginPath();
  for (let i = 0; i <= 400 * draw; i++) {
    const [x, y] = rose((i / 400) * Math.PI, K, R);
    i ? ctx.lineTo(CX + x, CY - y) : ctx.moveTo(CX + x, CY - y);
  }
  ctx.strokeStyle = `rgba(255,143,184,${0.55 * fade})`; ctx.lineWidth = 5; ctx.stroke();

  // 背景の花びら：バラ曲線の上を漂う
  for (const q of petals) {
    const th = q.th + t * 0.15;
    const [x, y] = rose(th, K, R * q.r);
    petal(CX + x + 20 * perlin(q.ph, t * 0.4), CY - y + 20 * perlin(q.ph + 5, t * 0.4), q.s * draw, th * 3 + t);
  }

  // 画：軌道を回る → シグモイドで本来の位置へ
  for (const p of pieces) {
    const u = range01(t, p.start, p.start + 1.9);
    const travel = doubleExponentialSigmoid(u, 0.75);
    const th = p.th0 + (t - 0.9) * 1.1;
    const [ox, oy] = rose(th, K, R);
    const x = lerp(CX + ox, p.cx, travel), y = lerp(CY - oy, p.cy, travel);
    const a = (1 - travel) * p.spin * Math.PI;
    const s = lerp(0.45, 1, travel) * (1 + 0.25 * expImpulse(Math.max(0, t - p.start - 1.9), 8));
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    piecePath(p);
    ctx.fillStyle = p.color; ctx.fill('nonzero');
    ctx.lineWidth = 9; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
