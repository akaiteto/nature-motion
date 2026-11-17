// 10 「ふわふわ」が宙に漂い、風が吹くと画がばらばらに流され、ばねで戻ってくる
// 使う関数：パーリンノイズ・カールノイズ（lib/noise.js）、二次の動き＝ばね（lib/spring.js）、イージング
import { W, H, PAL, run, chip, range01, lerp, rng } from '../lib/stage.js';
import { loadGlyphs, layoutWord, piecesOf } from '../lib/glyph.js';
import { perlin, curl } from '../lib/noise.js';
import { SecondOrder } from '../lib/spring.js';
import { easeInOutSine, easeInOutCubic } from '../lib/easing.js';

const ctx = document.getElementById('stage').getContext('2d');
const label = chip('');
const GUST = [2.6, 6.0], BACK = 6.0;
const COLORS = [PAL.sky, PAL.mint, PAL.lav, PAL.pink];

const glyphs = await loadGlyphs('../lib/glyphs.json');
const word = layoutWord('ふわふわ', glyphs, 330, W / 2, H / 2, 0.06);
const pieces = word.flatMap((ch, ci) => piecesOf(ch.contours).map(p => ({ ...p, ci })));
const seeds = rng(9);
let fluff = [];

function setup() {
  pieces.forEach((p, i) => {
    p.pos = [p.cx, p.cy]; p.vel = [0, 0]; p.rot = 0; p.phase = i * 1.7;
    p.spring = null;
    p.color = COLORS[p.ci % COLORS.length];
  });
  // 風を見せる綿毛（流れに乗る小さな粒）
  const r = rng(4);
  fluff = Array.from({ length: 500 }, () => ({ x: r() * W, y: r() * H, life: r() }));
}

// 風：右向きの風 ＋ カールノイズの渦。強さは時間で山なりに
const windPower = t => easeInOutSine(range01(t, GUST[0], GUST[0] + 0.8)) * (1 - easeInOutSine(range01(t, GUST[1] - 1.0, GUST[1])));
function wind(x, y, t) {
  const [cx, cy] = curl(x * 0.0022, y * 0.0022, t * 0.25);
  return [420 + 520 * cx, 520 * cy];
}

function update(t, dt) {
  const p0 = windPower(t);
  for (const p of pieces) {
    // ふわふわ：ノイズで上下と傾きをゆらす（画ごとに位相をずらす）
    const floatX = 14 * perlin(p.phase, t * 0.35), floatY = 26 * perlin(p.phase + 9, t * 0.45);
    const home = [p.cx + floatX, p.cy + floatY];
    if (t >= GUST[0] && t < BACK) {
      const [wx, wy] = wind(p.pos[0], p.pos[1], t);
      const delay = range01(t, GUST[0] + p.cx / W * 0.8, GUST[0] + p.cx / W * 0.8 + 0.6);   // 左の画から順に飛ばされる
      p.vel[0] = lerp(p.vel[0], wx * p0 * delay, 0.06); p.vel[1] = lerp(p.vel[1], wy * p0 * delay, 0.06);
      p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt;
      if (p.pos[0] > W + 250) p.pos[0] -= W + 500;             // 右に抜けたら左から戻る
      p.rot += p.vel[1] * dt * 0.01 + p.vel[0] * dt * 0.004;
      p.spring = null;
    } else if (t >= BACK) {
      if (!p.spring) p.spring = new SecondOrder(0.9, 0.55, 1.5, [p.pos[0], p.pos[1], p.rot]);
      const goal = t > BACK + (p.cx / W) * 0.8 ? [home[0], home[1], 0] : [p.pos[0], p.pos[1], p.rot];
      [p.pos[0], p.pos[1], p.rot] = p.spring.update(dt, goal);
    } else {
      p.pos = home; p.rot = 0.06 * perlin(p.phase + 3, t * 0.5);
    }
  }
  for (const f of fluff) {
    const [wx, wy] = wind(f.x, f.y, t);
    const k = 0.15 + p0;
    f.x += wx * k * dt; f.y += (wy * k - 12) * dt;
    f.life += dt * 0.2;
    if (f.x > W + 20) f.x -= W + 40; if (f.y < -20) f.y += H + 40; if (f.y > H + 20) f.y -= H + 40;
  }
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // カメラ：風が吹くと引いて、流れる方向へ少し振る
  const p0 = windPower(t);
  const zoom = lerp(1.08, 0.92, p0) + 0.02 * Math.sin(t * 0.6);
  const pan = 120 * p0;
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.rotate(-0.04 * p0 + 0.015 * Math.sin(t * 0.5)); ctx.translate(-W / 2 - pan, -H / 2);

  // 綿毛
  for (const f of fluff) {
    const a = 0.25 + 0.5 * Math.abs(Math.sin(f.life * 6));
    ctx.fillStyle = `rgba(185,166,255,${a})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, 3 + 2 * Math.sin(f.life * 9), 0, Math.PI * 2); ctx.fill();
  }
  // 画
  for (const p of pieces) {
    ctx.save(); ctx.translate(p.pos[0], p.pos[1]); ctx.rotate(p.rot);
    ctx.beginPath();
    for (const poly of p.contours) { poly.forEach(([x, y], i) => (i ? ctx.lineTo(x - p.cx, y - p.cy) : ctx.moveTo(x - p.cx, y - p.cy))); ctx.closePath(); }
    ctx.fillStyle = p.color; ctx.fill('nonzero');
    ctx.lineWidth = 9; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
  label.innerHTML = t < GUST[0] ? 'パーリンノイズ：なめらかなでたらめで、ふわふわ揺らす<small>Ken Perlin</small>'
    : t < BACK ? 'カールノイズ：ノイズの坂を90°回すと、渦を巻く風になる<small>Bridson 2007</small>'
    : 'ばね（二次の動き）で、元の場所へ<small>f=0.9, ζ=0.55, r=1.5</small>';
}

run({ setup, update, render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
