// 01 フーリエの円で「かわいい」を描き、円を減らすと丸文字になる
// 使う関数：フーリエ級数（lib/fourier.js）、イージング（lib/easing.js）
import { W, H, PAL, run, chip, range01, lerp } from '../lib/stage.js';
import { loadGlyphs, layoutWord } from '../lib/glyph.js';
import { dft, epicycles, resample } from '../lib/fourier.js';
import { easeInOutCubic, easeInOutSine, easeOutElastic } from '../lib/easing.js';

const N = 256;            // 輪郭1本を何点で表すか
const MAX = 80;           // 使う円の最大数
const ctx = document.getElementById('stage').getContext('2d');
const label = chip('');

// 輪郭ごとに、中心からの位置をフーリエ変換しておく
const glyphs = await loadGlyphs('../lib/glyphs.json');
const word = layoutWord('かわいい', glyphs, 400, W / 2, H / 2 - 20, 0.04);
const loops = [];
for (const ch of word) for (const poly of ch.contours) {
  const pts = resample(poly, N);
  loops.push({ coefs: dft(pts), pts });
}

// 円の数の変化：80 → 6 → 80（減らすときは対数で、戻すときはゴムのように）
function circleCount(t) {
  if (t < 6.2) return MAX;
  if (t < 9) { const k = easeInOutCubic(range01(t, 6.2, 8.6)); return Math.exp(lerp(Math.log(MAX), Math.log(6), k)); }
  if (t < 10) return 6;
  return lerp(6, MAX, easeOutElastic(range01(t, 10, 11.6)));
}

// カメラ：最初はペン先に寄って追いかけ、だんだん引いて全体を見せる
function camera(t, pen) {
  const k = easeInOutCubic(range01(t, 0.6, 3.6));
  const zoom = lerp(3.4, 1, k) * (1 + 0.06 * Math.sin(t * 0.7));
  const cx = lerp(pen[0], W / 2, k), cy = lerp(pen[1], H / 2, k);
  const tilt = lerp(-0.12, 0, k) + (t > 6.2 ? 0.035 * Math.sin((t - 6.2) * 1.3) : 0);
  return { zoom, cx, cy, tilt };
}

function render(t) {
  const draw = easeInOutSine(range01(t, 0.3, 5.2));   // 何周分描いたか（0〜1）
  const theta = draw * Math.PI * 2;
  const n = circleCount(t);
  const fill = range01(t, 5.0, 5.8);
  const showCircles = 1 - range01(t, 5.2, 6.0);
  const first = epicycles(loops[0].coefs, theta, n);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cam = camera(t, [first.x, first.y]);
  ctx.translate(W / 2, H / 2); ctx.rotate(cam.tilt); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.cx, -cam.cy);

  // 形（描き終わったら塗る。円の数で丸くなる）
  ctx.beginPath();
  for (const L of loops) {
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const th = (i / steps) * Math.PI * 2;
      const p = epicycles(L.coefs, th, n);
      i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
    }
    ctx.closePath();
  }
  if (fill > 0) {
    const g = ctx.createLinearGradient(W / 2 - 700, 0, W / 2 + 700, 0);
    g.addColorStop(0, PAL.pink); g.addColorStop(0.5, PAL.lav); g.addColorStop(1, PAL.sky);
    ctx.globalAlpha = fill; ctx.fillStyle = g; ctx.fill('nonzero'); ctx.globalAlpha = 1;
    ctx.lineWidth = 7 / cam.zoom; ctx.strokeStyle = PAL.ink; ctx.stroke();
  }

  // 描いている途中の線と、回る円
  if (showCircles > 0) {
    for (const L of loops) {
      ctx.beginPath();
      const steps = Math.max(2, Math.floor(260 * draw));
      for (let i = 0; i <= steps; i++) {
        const p = epicycles(L.coefs, (i / steps) * theta, n);
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.globalAlpha = showCircles; ctx.lineWidth = 6 / cam.zoom; ctx.strokeStyle = PAL.ink; ctx.stroke();
      const e = epicycles(L.coefs, theta, Math.min(n, 30));
      ctx.lineWidth = 1.6 / cam.zoom;
      for (let i = 1; i < e.centers.length; i++) {
        const [x, y, r] = e.centers[i];
        ctx.strokeStyle = 'rgba(185,166,255,.75)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        const [nx, ny] = e.centers[i + 1] || [e.x, e.y];
        ctx.strokeStyle = 'rgba(74,59,92,.55)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
      }
      ctx.fillStyle = PAL.pink;
      ctx.beginPath(); ctx.arc(e.x, e.y, 9 / cam.zoom, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  label.innerHTML = `フーリエ級数：回る円を足して輪郭を描く<small>円の数 ${Math.round(n)}</small>`;
}

run({ render, loop: 13, fonts: ['800 40px "M PLUS Rounded 1c"'] });
