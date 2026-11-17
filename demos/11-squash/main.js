// 11 ぽよん（つぶれと伸び）
// 3つとも「跳ねる高さとタイミング」はまったく同じ。違うのは見せ方だけ（物理としては全部うそ）。
//   1. そのまま：丸がそのまま上下するだけ
//   2. つぶれと伸び：速いときは進む向きに伸び、着地でつぶれる。面積（体積）は変えない
//   3. ＋ため・余韻：跳ぶ前にしゃがむ（予備動作）、着地後にぷるんと揺れる（ばね）、ほこりと画面の揺れ
// 参考：ディズニーの「アニメーションの12原則」、講演「Juice it or lose it」（2012）
const { W, H, palette: P } = Motion;
const FLOOR = 560, PERIOD = 1.3, AIR0 = 0.28, JUMP = 300;
const LANES = [
  { x: 230, name: '① そのまま', color: '#c9b8ff', stretch: false, extra: false },
  { x: 640, name: '② つぶれと伸び', color: '#8fe3cf', stretch: true, extra: false },
  { x: 1050, name: '③ ＋ため・余韻', color: '#ff9cc2', stretch: true, extra: true }
];
LANES.forEach(l => Object.assign(l, { sq: 0, sqv: 0, y: 0, vy: 0, landed: true, dust: [], shake: 0, blink: 0 }));

// 時間 → 高さ（全レース共通。地上にいる時間 AIR0 のあと放物線）
function height(ph) {
  if (ph < AIR0) return 0;
  const k = (ph - AIR0) / (1 - AIR0);
  return 4 * k * (1 - k) * JUMP;
}

Motion.create({
  substeps: 2,
  update(dt, t) {
    const ph = (t / PERIOD) % 1;
    for (const l of LANES) {
      const y = height(ph);
      const vy = (y - l.y) / dt; l.y = y; l.vy = vy;
      const inAir = ph >= AIR0;
      if (!inAir && !l.landed) { // 着地した瞬間
        l.landed = true;
        if (l.stretch) l.sqv += l.extra ? 9 : 7;
        if (l.extra) {
          l.shake = 0.18; l.blink = 0.15;
          for (let i = 0; i < 10; i++) l.dust.push({ x: l.x + Motion.range(-50, 50), y: FLOOR - 6, vx: Motion.range(-140, 140), vy: Motion.range(-90, -20), t: 0 });
        }
      }
      if (inAir) l.landed = false;

      if (l.stretch) {
        if (inAir) {
          // 速いほど縦に伸びる（sq がマイナス＝伸び）
          const target = -Math.min(0.32, Math.abs(vy) / 2600);
          l.sq += (target - l.sq) * Math.min(1, dt * 25); l.sqv = 0;
        } else {
          // ばね：② はすぐ止まる、③ はぷるんと揺れる
          const k = l.extra ? 420 : 700, c = l.extra ? 9 : 55;
          l.sqv += (-k * l.sq - c * l.sqv) * dt; l.sq += l.sqv * dt;
          // ③ だけ：跳ぶ直前にしゃがむ
          if (l.extra && ph > AIR0 - 0.12 && ph < AIR0) { const k2 = (ph - (AIR0 - 0.12)) / 0.12; l.sq = Math.max(l.sq, 0.28 * Math.sin(k2 * Math.PI / 2)); l.sqv = 0; }
        }
      }
      l.shake = Math.max(0, l.shake - dt); l.blink = Math.max(0, l.blink - dt);
      for (const d of l.dust) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 1 - 3 * dt; }
      while (l.dust.length && l.dust[0].t > 0.5) l.dust.shift();
    }
  },

  draw(ctx, t) {
    ctx.fillStyle = '#fff7fb'; ctx.fillRect(0, 0, W, H);
    for (const l of LANES) {
      ctx.save();
      // ③ の画面ゆれ（そのレーンだけ）
      if (l.shake > 0) ctx.translate(Math.sin(t * 90) * l.shake * 30, Math.cos(t * 70) * l.shake * 20);
      ctx.fillStyle = '#ffeaf3'; Motion.roundRect(ctx, l.x - 190, 150, 380, 520, 30); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(l.x - 170, FLOOR); ctx.lineTo(l.x + 170, FLOOR); ctx.stroke();
      // 影
      const k = 1 - l.y / JUMP * 0.6;
      ctx.fillStyle = `rgba(90,60,80,${0.25 * k})`; ctx.beginPath(); ctx.ellipse(l.x, FLOOR + 4, 60 * k * (1 + Math.max(0, l.sq)), 10 * k, 0, 0, 6.28); ctx.fill();
      drawBall(ctx, l);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(200,170,190,0.9)'; ctx.lineWidth = 2;
      for (const d of l.dust) { ctx.globalAlpha = 1 - d.t / 0.5; ctx.beginPath(); ctx.arc(d.x, d.y, 8 + d.t * 20, 0, 6.28); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.restore();
      pill(ctx, l.x, 615, l.name, l.extra ? P.yellow : '#fff');
    }
    Motion.label(ctx, 'ぽよん（つぶれと伸び）', '同じ跳び方でも、見せ方で「生きている感じ」が変わる');
  }
});

function drawBall(ctx, l) {
  const R = 58;
  const sy = 1 - l.sq, sx = 1 / sy; // 面積を変えずに、縦と横を入れかえる
  ctx.save();
  ctx.translate(l.x, FLOOR - l.y);
  ctx.scale(sx, sy);
  ctx.translate(0, -R);
  ctx.fillStyle = l.color; ctx.strokeStyle = P.ink; ctx.lineWidth = 4.5 / Math.sqrt(sx * sy);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-R * 0.4, -R * 0.45, R * 0.18, R * 0.1, -0.6, 0, 6.28); ctx.fill();
  // 顔
  ctx.fillStyle = P.ink;
  for (const s of [-1, 1]) {
    if (l.blink > 0) { ctx.fillRect(s * 20 - 8, -6, 16, 4); continue; }
    ctx.beginPath(); ctx.ellipse(s * 20, -4, 6, 8, 0, 0, 6.28); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,120,160,0.5)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 34, 10, 8, 5, 0, 0, 6.28); ctx.fill(); }
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 8, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function pill(ctx, x, y, text, bg) {
  ctx.save(); ctx.font = '700 24px "Noto Sans CJK JP","Hiragino Sans",sans-serif';
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = bg; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  Motion.roundRect(ctx, x - w / 2, y - 22, w, 44, 22); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}
