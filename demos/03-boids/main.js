// 03 群れ（Boids）
// 1羽ずつが守るのは3つだけ：近づきすぎない（分離）・向きをそろえる（整列）・群れの中心へ寄る（結合）。
// それに「タカから逃げる」を足しただけ。リーダーはいない。（Craig Reynolds, 1987）
// マウスを動かすと、マウスがタカになる。
const { W, H, palette: P } = Motion;
const N = 320;
const COLORS = [P.pink, P.yellow, P.mint, P.sky, P.lav, P.peach];
const R_SEE = 70, R_SEP = 24, MAX_V = 230, MIN_V = 120, MAX_F = 520;
const WEIGHT = { sep: 1.8, ali: 1.4, coh: 1.4, flee: 5.0, wall: 2.5 };

const birds = Array.from({ length: N }, (_, i) => {
  const a = Motion.range(0, 6.28);
  return { x: Motion.range(200, W - 200), y: Motion.range(150, H - 150), vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
    c: COLORS[i % COLORS.length], phase: Motion.range(0, 6.28) };
});
const hawk = { x: -200, y: H / 2 };
const clouds = Array.from({ length: 7 }, () => ({ x: Motion.range(0, W), y: Motion.range(0, H), s: Motion.range(0.7, 1.4) }));

// 近所さがしを速くするための格子
const CELL = R_SEE, GX = Math.ceil(W / CELL) + 1, GY = Math.ceil(H / CELL) + 1;
const grid = Array.from({ length: GX * GY }, () => []);

Motion.create({
  update(dt, t) {
    // タカ：画面をゆっくり横切る8の字（マウスがあればマウス）
    if (Motion.mouse.active) { hawk.x = Motion.mouse.x; hawk.y = Motion.mouse.y; }
    else { hawk.x = W / 2 + Math.sin(t * 0.35) * 560; hawk.y = H / 2 + Math.sin(t * 0.7) * 230; }

    grid.forEach(c => (c.length = 0));
    for (const b of birds) grid[cellOf(b)].push(b);

    for (const b of birds) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
      const gx = Math.floor(b.x / CELL), gy = Math.floor(b.y / CELL);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const X = gx + ox, Y = gy + oy;
        if (X < 0 || Y < 0 || X >= GX || Y >= GY) continue;
        for (const o of grid[X + Y * GX]) {
          if (o === b) continue;
          const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy);
          if (d > R_SEE) continue;
          n++; ax += o.vx; ay += o.vy; cx += o.x; cy += o.y;
          if (d < R_SEP && d > 0) { sx -= dx / d * (R_SEP - d) / R_SEP; sy -= dy / d * (R_SEP - d) / R_SEP; }
        }
      }
      let fx = 0, fy = 0;
      const steer = (x, y, w) => { // 望む速度へ向ける力
        const m = Math.hypot(x, y); if (!m) return;
        fx += (x / m * MAX_V - b.vx) * w; fy += (y / m * MAX_V - b.vy) * w;
      };
      if (n) {
        steer(sx, sy, WEIGHT.sep);
        steer(ax / n, ay / n, WEIGHT.ali * 0.5);
        steer(cx / n - b.x, cy / n - b.y, WEIGHT.coh * 0.3);
      }
      const hd = Math.hypot(b.x - hawk.x, b.y - hawk.y);
      if (hd < 170) steer(b.x - hawk.x, b.y - hawk.y, WEIGHT.flee * (1 - hd / 170));
      const m = 90; // 画面の端から戻る
      if (b.x < m) fx += (m - b.x) * WEIGHT.wall * 4; if (b.x > W - m) fx -= (b.x - W + m) * WEIGHT.wall * 4;
      if (b.y < m) fy += (m - b.y) * WEIGHT.wall * 4; if (b.y > H - m) fy -= (b.y - H + m) * WEIGHT.wall * 4;

      const fm = Math.hypot(fx, fy); if (fm > MAX_F) { fx *= MAX_F / fm; fy *= MAX_F / fm; }
      b.vx += fx * dt; b.vy += fy * dt;
      const v = Math.hypot(b.vx, b.vy);
      const lim = Motion.clamp(v, MIN_V, MAX_V) / v; b.vx *= lim; b.vy *= lim;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.phase += dt * (10 + 8 * (v / MAX_V));
    }
    for (const c of clouds) { c.x += 12 * c.s * dt; if (c.x > W + 150) c.x = -150; }
  },

  draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bfe6ff'); g.addColorStop(1, '#ffe6f1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const c of clouds) cloud(ctx, c.x, c.y, c.s);

    for (const b of birds) drawBird(ctx, b);
    drawHawk(ctx, t);
    Motion.label(ctx, '群れ（Boids）', '分離・整列・結合の3つのルールだけ／マウスがタカ');
  }
});

function cellOf(b) {
  const X = Motion.clamp(Math.floor(b.x / CELL), 0, GX - 1), Y = Motion.clamp(Math.floor(b.y / CELL), 0, GY - 1);
  return X + Y * GX;
}

function drawBird(ctx, b) {
  const a = Math.atan2(b.vy, b.vx), flap = Math.sin(b.phase);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
  ctx.fillStyle = b.c; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
  // つばさ（はばたきで長さが変わる）
  for (const s of [1, -1]) {
    ctx.beginPath(); ctx.ellipse(-1, s * 6 * (0.5 + 0.5 * Math.abs(flap)), 5, 8 * (0.4 + 0.6 * Math.abs(flap)), s * 0.4, 0, 6.28); ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(5, 0, 1.6, 0, 6.28); ctx.fill();
  ctx.restore();
}

function drawHawk(ctx, t) {
  ctx.save(); ctx.translate(hawk.x, hawk.y);
  const flap = Math.sin(t * 6);
  ctx.fillStyle = '#9b7bd1'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  for (const s of [1, -1]) { ctx.beginPath(); ctx.ellipse(s * 40, 0, 40, 14 + flap * 6, s * 0.2, 0, 6.28); ctx.fill(); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 28, 0, 6.28); ctx.fill(); ctx.stroke();
  for (const s of [1, -1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 10, -4, 8, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(s * 10, -3, 4, 0, 6.28); ctx.fill();
  }
  ctx.fillStyle = P.yellow; ctx.beginPath(); ctx.moveTo(-5, 6); ctx.lineTo(5, 6); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function cloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const [dx, dy, r] of [[0, 0, 40], [40, 8, 32], [-40, 10, 30], [15, -20, 30]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 6.28); ctx.fill(); }
}
