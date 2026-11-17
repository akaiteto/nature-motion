// 05 クラゲ
// かさ：決まったリズムで「速く縮んで、ゆっくり戻る」。縮む間だけ前に進む力が出る。
// 触手：点をつないだひも（ヴェルレ積分）。かさに引っぱられて、あとから遅れて揺れる＝二次的な動き。
// （ひもの作り方は Thomas Jakobsen「Advanced Character Physics」の方法）
const { W, H, palette: P } = Motion;
const SEG = 16;

const KINDS = [
  { c: '#ffb3d1', in: '#ffe0ec', R: 88 }, { c: '#c9b8ff', in: '#ece6ff', R: 72 },
  { c: '#9fe8d6', in: '#dcfaf2', R: 62 }, { c: '#ffd1a8', in: '#fff0e0', R: 52 }
];
const jellies = KINDS.map((k, i) => {
  const j = {
    ...k, x: 220 + i * 280, y: 330 + (i % 2) * 200, vx: 0, vy: 0, ang: Motion.range(-0.3, 0.3),
    phase: i * 0.27, period: 2.0 + i * 0.25, seed: i * 13, tent: [], arms: []
  };
  const nT = 7;
  for (let t = 0; t < nT; t++) j.tent.push(rope(j.x, j.y, SEG, k.R * 0.11, 0.985));
  for (let t = 0; t < 3; t++) j.arms.push(rope(j.x, j.y, 9, k.R * 0.12, 0.96));
  return j;
});
function rope(x, y, n, link, damp) {
  return { link, damp, pts: Array.from({ length: n }, (_, i) => ({ x, y: y + i * link, px: x, py: y + i * link })) };
}
const snow = Array.from({ length: 90 }, () => ({ x: Motion.range(0, W), y: Motion.range(0, H), r: Motion.range(1, 3), s: Motion.range(5, 20) }));

// 縮み具合 0..1：速く縮んで（最初の25%）ゆっくり戻る
function squeeze(ph) { return ph < 0.25 ? Math.sin((ph / 0.25) * Math.PI / 2) : Math.pow(1 - (ph - 0.25) / 0.75, 2); }

function bellPoint(j, u, v, sq) { // u: -1..1（左右）, v: 0..1（ふち→てっぺん）をかさの形に
  const bw = j.R * (1 - 0.28 * sq), bh = j.R * 0.85 * (1 + 0.25 * sq);
  const lx = u * bw * Math.cos(v * Math.PI / 2) , ly = -bh * Math.sin(v * Math.PI / 2) + j.R * 0.25;
  const c = Math.cos(j.ang), s = Math.sin(j.ang);
  return { x: j.x + lx * c - ly * s, y: j.y + lx * s + ly * c };
}

Motion.create({
  substeps: 2,
  update(dt, t) {
    for (const j of jellies) {
      const prev = squeeze(j.phase);
      j.phase = (j.phase + dt / j.period) % 1;
      const sq = squeeze(j.phase);
      // 向き：ゆっくりふらつく（ほぼ上向き）
      const want = (Motion.noise(t * 0.15 + j.seed) - 0.5) * 1.4 + (j.x < 200 ? 0.4 : j.x > W - 200 ? -0.4 : 0);
      j.ang += (want - j.ang) * dt * 0.8;
      // 縮んでいる間だけ前へ
      if (sq > prev) { const push = (sq - prev) * 130 * (60 / j.R); j.vx += Math.sin(j.ang) * push; j.vy -= Math.cos(j.ang) * push; }
      j.vy += 18 * dt; // ほんの少し沈む
      j.vx *= 1 - dt * 1.2; j.vy *= 1 - dt * 1.2;
      j.x += j.vx * dt; j.y += j.vy * dt;
      // 上に出たら下から
      if (j.y < -j.R * 2) shift(j, 0, H + j.R * 4);
      if (j.y > H + j.R * 5) shift(j, 0, -H - j.R * 6);

      // 触手：ふちに付いて、あとは重さと水の抵抗だけ
      j.tent.forEach((r, k) => { const u = -0.95 + 1.9 * k / (j.tent.length - 1); stepRope(r, bellPoint(j, u, 0, sq), dt, 40); });
      j.arms.forEach((r, k) => { const u = -0.25 + 0.25 * k; stepRope(r, bellPoint(j, u, 0.15, sq), dt, 25); });
    }
    for (const s of snow) { s.y += s.s * dt; s.x += Math.sin(t + s.y * 0.01) * 4 * dt; if (s.y > H) s.y = 0; }
  },

  draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7b8ee0'); g.addColorStop(1, '#2f2a6b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 光の筋
    ctx.save(); ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) { const x = 150 + i * 260 + Math.sin(t * 0.3 + i) * 40; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 70, 0); ctx.lineTo(x - 120, H); ctx.lineTo(x - 220, H); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const s of snow) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill(); }

    for (const j of jellies) drawJelly(ctx, j, t);
    Motion.label(ctx, 'クラゲ', 'かさは速く縮んでゆっくり戻る／触手はひもの物理で後から揺れる');
  }
});

function stepRope(r, anchor, dt, gravity) {
  const p = r.pts;
  for (let i = 1; i < p.length; i++) {
    const q = p[i];
    const vx = (q.x - q.px) * r.damp, vy = (q.y - q.py) * r.damp;
    q.px = q.x; q.py = q.y;
    q.x += vx; q.y += vy + gravity * dt * dt;
  }
  p[0].x = anchor.x; p[0].y = anchor.y; p[0].px = anchor.x; p[0].py = anchor.y;
  for (let it = 0; it < 6; it++) for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
    const diff = (d - r.link) / d;
    if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
    else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
  }
}

function shift(j, dx, dy) {
  j.x += dx; j.y += dy;
  for (const r of [...j.tent, ...j.arms]) for (const p of r.pts) { p.x += dx; p.y += dy; p.px += dx; p.py += dy; }
}

function drawJelly(ctx, j, t) {
  const sq = squeeze(j.phase);
  // 触手（細い線）
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of j.tent) {
    smoothLine(ctx, r.pts);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = j.c; ctx.lineWidth = 2.5; ctx.stroke();
  }
  // 口腕（太いフリル）
  for (const r of j.arms) {
    ctx.beginPath(); r.pts.forEach((p, i) => (i ? ctx.lineTo(p.x + Math.sin(i * 1.7 + t * 3) * 3, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = j.in; ctx.globalAlpha = 0.8; ctx.lineWidth = j.R * 0.16; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // かさ
  // かさの輪郭：左のふち → てっぺん → 右のふち → ギザギザのふちを通って左へ戻る
  const rim = [];
  for (let k = 0; k <= 10; k++) rim.push(bellPoint(j, -1 + 2 * k / 10, 0, sq));
  ctx.save();
  ctx.shadowColor = j.c; ctx.shadowBlur = 30;
  ctx.beginPath();
  for (let k = 0; k <= 20; k++) { const p = bellPoint(j, -1, k / 20, sq); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
  for (let k = 20; k >= 0; k--) { const p = bellPoint(j, 1, k / 20, sq); ctx.lineTo(p.x, p.y); }
  for (let k = rim.length - 1; k > 0; k--) {
    const a = rim[k], b = rim[k - 1];
    const m = { x: (a.x + b.x) / 2 - Math.sin(j.ang) * 7, y: (a.y + b.y) / 2 + Math.cos(j.ang) * 7 };
    ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
  }
  ctx.closePath();
  ctx.globalAlpha = 0.85; ctx.fillStyle = j.c; ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  // 中の模様（4つの丸）と顔
  const c = bellPoint(j, 0, 0.45, sq);
  ctx.fillStyle = j.in; ctx.globalAlpha = 0.7;
  for (let k = 0; k < 4; k++) { const p = bellPoint(j, -0.55 + k * 0.37, 0.62, sq); ctx.beginPath(); ctx.arc(p.x, p.y, j.R * 0.12, 0, 6.28); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a2f5c';
  for (const u of [-0.28, 0.28]) { const p = bellPoint(j, u, 0.3, sq); ctx.beginPath(); ctx.arc(p.x, p.y, j.R * 0.07, 0, 6.28); ctx.fill(); }
  const m = bellPoint(j, 0, 0.22, sq);
  ctx.strokeStyle = '#3a2f5c'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(m.x, m.y - 2, j.R * 0.07, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const hl = bellPoint(j, -0.5, 0.75, sq); ctx.beginPath(); ctx.ellipse(hl.x, hl.y, j.R * 0.14, j.R * 0.07, j.ang - 0.6, 0, 6.28); ctx.fill();
  void c;
}

function smoothLine(ctx, pts) {
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l.x, l.y);
}
