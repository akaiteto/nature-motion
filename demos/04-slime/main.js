// 04 ぷるぷるスライム
// 位置ベースの物理（PBD）：点を動かしたあと「となりとの距離」と「全体の面積」を保つように点を直す。
// 面積を保つ＝中に水が入っている感じ。距離の制約をゆるくすると、ぷるぷるになる。
// ジャンプの前に面積を少し減らして「ため」を作る（物理ではなく演出のうそ）。
// マウスでつまんで投げられる。
const { W, H, palette: P } = Motion;
const FLOOR = 640, G = 1400, SUB = 10, NPT = 28;

function makeSlime(x, y, r, color, light, seed) {
  const pts = [];
  for (let i = 0; i < NPT; i++) {
    const a = (i / NPT) * Math.PI * 2;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, px: 0, py: 0, vx: 0, vy: 0 });
  }
  const s = { pts, r, color, light, seed, edge: 2 * Math.PI * r / NPT, area0: 0, pressure: 1, timer: 1 + seed * 0.7, state: 'idle', dir: 1, blink: 0 };
  s.area0 = area(s);
  return s;
}
const slimes = [
  makeSlime(330, 450, 95, '#ff9cc2', '#ffd3e4', 0),
  makeSlime(700, 480, 72, '#8fe3cf', '#d2f7ee', 1),
  makeSlime(1000, 500, 56, '#ffe27a', '#fff3c4', 2)
];
let grab = null;

function area(s) {
  let A = 0; const p = s.pts;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; A += a.x * b.y - b.x * a.y; }
  return A / 2;
}
function center(s) {
  let x = 0, y = 0; for (const p of s.pts) { x += p.x; y += p.y; } return { x: x / s.pts.length, y: y / s.pts.length };
}

Motion.create({
  substeps: SUB,
  update(dt, t) {
    // マウスでつまむ
    if (Motion.mouse.down && !grab) {
      let best = 1e9;
      for (const s of slimes) for (const p of s.pts) { const d = Math.hypot(p.x - Motion.mouse.x, p.y - Motion.mouse.y); if (d < best && d < 80) { best = d; grab = p; } }
    }
    if (!Motion.mouse.down) grab = null;

    for (const s of slimes) brain(s, dt);

    for (const s of slimes) for (const p of s.pts) {
      p.vy += G * dt;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (grab) { grab.x = Motion.mouse.x; grab.y = Motion.mouse.y; }

    for (const s of slimes) {
      const p = s.pts, n = p.length;
      // となりとの距離（少しゆるい＝ compliance）
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        const c = (d - s.edge * Math.pow(s.pressure, 0.4)) / d * 0.5 * 0.9;
        a.x += dx * c; a.y += dy * c; b.x -= dx * c; b.y -= dy * c;
      }
      // ひとつ飛ばしの点とは近づきすぎない（しわくちゃに折れないように）
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 2) % n];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
        const rest = s.edge * 1.85 * Math.pow(s.pressure, 0.4);
        if (d < rest) { const c = (d - rest) / d * 0.5 * 0.5; a.x += dx * c; a.y += dy * c; b.x -= dx * c; b.y -= dy * c; }
      }
      // 面積（中の水の量）を保つ
      const C = area(s) - s.area0 * s.pressure;
      let gsum = 0; const gx = [], gy = [];
      for (let i = 0; i < n; i++) {
        const prev = p[(i - 1 + n) % n], next = p[(i + 1) % n];
        gx[i] = 0.5 * (next.y - prev.y); gy[i] = 0.5 * (prev.x - next.x);
        gsum += gx[i] * gx[i] + gy[i] * gy[i];
      }
      const lambda = -C / (gsum + 1e-6);
      for (let i = 0; i < n; i++) { p[i].x += lambda * gx[i]; p[i].y += lambda * gy[i]; }
    }

    // スライム同士がめりこまない
    for (const a of slimes) for (const b of slimes) {
      if (a === b) continue;
      const cb = center(b), rb = b.r * 0.92;
      for (const p of a.pts) {
        const dx = p.x - cb.x, dy = p.y - cb.y, d = Math.hypot(dx, dy);
        if (d < rb && d > 0) { const k = (rb - d) / d * 0.5; p.x += dx * k; p.y += dy * k; }
      }
    }

    // 床と壁（床では摩擦）
    for (const s of slimes) for (const p of s.pts) {
      if (p.y > FLOOR) { p.y = FLOOR; p.x = p.px + (p.x - p.px) * 0.55; }
      if (p.y < 130) p.y = 130; if (p.x < 30) p.x = 30; if (p.x > W - 30) p.x = W - 30;
    }
    for (const s of slimes) for (const p of s.pts) { p.vx = (p.x - p.px) / dt; p.vy = (p.y - p.py) / dt; }
  },

  draw(ctx, t) {
    // 部屋
    ctx.fillStyle = '#fff1f7'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe3ee';
    for (let x = 0; x < W; x += 80) ctx.fillRect(x, 0, 40, FLOOR);
    ctx.fillStyle = '#f6d6b8'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();

    for (const s of slimes) {
      const c = center(s);
      // 影：高く飛ぶほど小さく薄く
      const hgt = Math.max(0, FLOOR - c.y - s.r * 0.6);
      const k = 1 / (1 + hgt / 200);
      ctx.fillStyle = `rgba(90,60,80,${0.22 * k})`;
      ctx.beginPath(); ctx.ellipse(c.x, FLOOR + 6, s.r * 1.1 * k, 12 * k, 0, 0, 6.28); ctx.fill();
    }
    for (const s of slimes) drawSlime(ctx, s, t);
    Motion.label(ctx, 'ぷるぷるスライム', '距離と面積を保つだけ（位置ベースの物理）／つまんで投げられる');
  }
});

// 跳ねる段取り：待つ → ためる（面積を減らす）→ 跳ぶ
function brain(s, dt) {
  s.blink = Math.max(0, s.blink - dt);
  if (Motion.rand() < dt * 0.4) s.blink = 0.12;
  const onFloor = s.pts.some(p => p.y > FLOOR - 2);
  s.timer -= dt;
  if (s.state === 'idle' && onFloor && s.timer <= 0) { s.state = 'crouch'; s.timer = 0.28; }
  else if (s.state === 'crouch') {
    s.pressure = Motion.lerp(s.pressure, 0.78, dt * 20);
    if (s.timer <= 0) {
      const c = center(s);
      s.dir = c.x < 250 ? 1 : c.x > W - 250 ? -1 : (Motion.rand() < 0.5 ? 1 : -1);
      const jump = 520 + Motion.rand() * 200, side = s.dir * (140 + Motion.rand() * 120);
      for (const p of s.pts) { p.x -= side * 0.004; p.y -= jump * 0.004; p.px = p.x + side * 0.004 - side / (60 * SUB); p.py = p.y + jump / (60 * SUB); }
      s.state = 'air'; s.pressure = 1.04; s.timer = 0.3;
    }
  } else if (s.state === 'air') {
    s.pressure = Motion.lerp(s.pressure, 1, dt * 6);
    if (s.timer <= 0 && onFloor) { s.state = 'idle'; s.timer = 0.8 + Motion.rand() * 1.4; }
  } else s.pressure = Motion.lerp(s.pressure, 1, dt * 6);
}

function drawSlime(ctx, s, t) {
  const c = center(s);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of s.pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const w = maxX - minX, h = maxY - minY;

  ctx.beginPath(); Motion.smoothClosed(ctx, s.pts);
  const g = ctx.createRadialGradient(c.x - w * 0.2, minY + h * 0.25, 4, c.x, c.y, Math.max(w, h) * 0.7);
  g.addColorStop(0, s.light); g.addColorStop(1, s.color);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4.5; ctx.stroke();

  // つや
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(c.x - w * 0.22, minY + h * 0.2, w * 0.09, h * 0.06, -0.5, 0, 6.28); ctx.fill();

  // 顔：体のつぶれ方に合わせて目の間隔と高さを変える
  const ey = c.y - h * 0.05, ex = w * 0.17, er = s.r * 0.11;
  for (const side of [-1, 1]) {
    const x = c.x + side * ex + s.dir * w * 0.04;
    ctx.fillStyle = P.ink;
    if (s.blink > 0) { ctx.fillRect(x - er, ey - 2, er * 2, 4); continue; }
    ctx.beginPath(); ctx.ellipse(x, ey, er, er * 1.25 * (h / w > 0.8 ? 1 : 0.85), 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - er * 0.3, ey - er * 0.45, er * 0.38, 0, 6.28); ctx.fill();
  }
  // ほっぺと口
  ctx.fillStyle = 'rgba(255,120,160,0.45)';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(c.x + side * ex * 1.7, ey + er * 1.6, er * 1.1, er * 0.6, 0, 0, 6.28); ctx.fill(); }
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const open = s.state === 'air' ? 1 : 0;
  ctx.beginPath();
  if (open) { ctx.ellipse(c.x + s.dir * w * 0.04, ey + er * 2.2, er * 0.6, er * 0.8, 0, 0, 6.28); ctx.fillStyle = '#c0506e'; ctx.fill(); ctx.stroke(); }
  else { ctx.arc(c.x - er * 0.55 + s.dir * w * 0.04, ey + er * 1.6, er * 0.55, 0.2, Math.PI - 0.2); ctx.moveTo(c.x + er * 1.1 + s.dir * w * 0.04, ey + er * 1.8); ctx.arc(c.x + er * 0.55 + s.dir * w * 0.04, ey + er * 1.6, er * 0.55, 0.2, Math.PI - 0.2); ctx.stroke(); }
}
