// 01 泳ぐ魚
// 背骨の鎖（common/chain.js）＋ 体の幅の表 ＋ ヒレ。
// 頭は「向きを少しずつしか変えられない」ルールで進むので、勝手にくねくね泳いで見える。
// クリックするとエサが落ちる（何もしなくても、ときどき自動で落ちる）。
const { W, H, palette: P } = Motion;

const BODY = [34, 40, 42, 41, 38, 32, 25, 19, 16, 13, 10, 8]; // 頭から尾までの体の半幅
const KOI = [
  { s: 0.85, body: '#ffffff', spot: '#ff8fb8', fin: '#ffd3e4' },
  { s: 0.7, body: '#ffe27a', spot: '#ff9f6b', fin: '#fff0b8' },
  { s: 0.6, body: '#b9a6ff', spot: '#ffffff', fin: '#e2dbff' },
  { s: 0.5, body: '#ffc29f', spot: '#ffffff', fin: '#ffe2cf' }
];

const fish = KOI.map((k, i) => {
  const x = Motion.range(300, 980), y = Motion.range(200, 520);
  return {
    ...k,
    head: new Steerer(x, y, Motion.range(0, 6.28), 150 * (0.7 + k.s * 0.4), 2.4),
    chain: new Chain(x, y, BODY.length, 16 * k.s, Math.PI / 8),
    seed: i * 37.7,
    spots: Array.from({ length: 3 }, () => ({ j: Math.floor(Motion.range(1, 7)), o: Motion.range(-0.6, 0.6), r: Motion.range(0.35, 0.6) })),
    happy: 0
  };
});
const foods = [], pops = [], bubbles = [];
let nextDrop = 1.2;

function dropFood(x, y) {
  for (let i = 0; i < 3; i++) foods.push({ x: x + Motion.range(-26, 26), y: y + Motion.range(-26, 26), t: 0 });
}

Motion.create({
  update(dt, t) {
    // エサ：自動で落とす／クリックで落とす
    nextDrop -= dt;
    if (nextDrop <= 0) { dropFood(Motion.range(220, W - 220), Motion.range(170, H - 170)); nextDrop = 3.5; }
    if (Motion.mouse.clicked) dropFood(Motion.mouse.x, Motion.mouse.y);
    foods.forEach(f => (f.t += dt));

    for (const f of fish) {
      // 行き先：近くにエサがあればエサ、なければノイズでふらふら
      let tx, ty, boost = 1;
      let best = null, bd = 1e9;
      for (const fd of foods) { const d = Math.hypot(fd.x - f.head.x, fd.y - f.head.y); if (d < bd) { bd = d; best = fd; } }
      if (best && bd < 520) { tx = best.x; ty = best.y; boost = 1.6; }
      else {
        tx = W / 2 + (Motion.noise(t * 0.25 + f.seed) - 0.5) * W * 1.1;
        ty = H / 2 + (Motion.noise(t * 0.25 + f.seed + 91) - 0.5) * H * 1.0;
      }
      // 壁の近くでは中心へ
      const margin = 110;
      if (f.head.x < margin || f.head.x > W - margin || f.head.y < margin || f.head.y > H - margin) { tx = W / 2; ty = H / 2; }
      f.head.steerTo(tx, ty, dt, boost);
      f.chain.resolve(f.head);

      // 食べる
      if (best && bd < 18 * f.s + 8) {
        foods.splice(foods.indexOf(best), 1);
        pops.push({ x: best.x, y: best.y, t: 0 });
        f.happy = 1;
      }
      f.happy = Math.max(0, f.happy - dt * 1.2);
      if (Motion.rand() < dt * 0.5) bubbles.push({ x: f.head.x, y: f.head.y, r: 3 + Motion.rand() * 4, t: 0 });
    }
    pops.forEach(p => (p.t += dt)); bubbles.forEach(b => { b.t += dt; b.y -= 30 * dt; b.x += Math.sin(b.t * 5) * 0.4; });
    while (pops.length && pops[0].t > 0.6) pops.shift();
    while (bubbles.length && bubbles[0].t > 2) bubbles.shift();
  },

  draw(ctx, t) {
    // 池
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#bff3ea'); g.addColorStop(1, '#8fd3e8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 水底のゆらゆらした光
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const x = (i * 197 + Motion.noise(t * 0.3 + i) * 140) % W, y = (i * 113) % H;
      ctx.beginPath(); ctx.ellipse(x, y, 60 + 30 * Motion.noise(t * 0.5 + i * 3), 18, i, 0, 6.28); ctx.fill();
    }
    ctx.restore();

    // エサ
    for (const fd of foods) {
      const bob = Math.sin(fd.t * 4) * 2;
      ctx.fillStyle = '#c98a5a'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fd.x, fd.y + bob, 6, 0, 6.28); ctx.fill(); ctx.stroke();
    }

    // 影 → 魚
    for (const f of fish) drawFish(ctx, f, true);
    for (const f of fish) drawFish(ctx, f, false);

    // 泡・ぱくっ
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    for (const b of bubbles) { ctx.globalAlpha = 1 - b.t / 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.28); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      const k = p.t / 0.6;
      ctx.strokeStyle = `rgba(255,143,184,${1 - k})`; ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * 6.28, r1 = 10 + k * 20, r2 = 16 + k * 34;
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); ctx.lineTo(p.x + Math.cos(a) * r2, p.y + Math.sin(a) * r2); ctx.stroke();
      }
    }
    // 睡蓮の葉（手前）
    lily(ctx, 90, 640, 70, 0.4); lily(ctx, 1170, 620, 90, 2.2); lily(ctx, 1080, 90, 50, 4);

    Motion.label(ctx, '泳ぐ魚', '背骨の鎖＋体の幅の表／クリックでエサ');
  }
});

function bodyOutline(f) {
  const c = f.chain, s = f.s, pts = [];
  for (let i = 0; i < BODY.length; i++) pts.push(c.side(i, BODY[i] * s));
  for (let i = BODY.length - 1; i >= 0; i--) pts.push(c.side(i, -BODY[i] * s));
  // 頭の丸み
  const a = c.angles[0], j = c.joints[0];
  const nose = [-0.6, 0, 0.6].map(da => ({ x: j.x + Math.cos(a + da) * BODY[0] * s * 1.05, y: j.y + Math.sin(a + da) * BODY[0] * s * 1.05 }));
  // 右側（頭→尾）→ 左側（尾→頭）→ 鼻先（左→正面→右）で一周
  return [...pts, ...nose];
}

function drawFish(ctx, f, shadow) {
  const c = f.chain, s = f.s, J = c.joints, A = c.angles, n = J.length;
  ctx.save();
  if (shadow) { ctx.translate(14, 22); ctx.globalAlpha = 0.18; }
  const fill = shadow ? '#1d4b5a' : f.body, stroke = shadow ? 'transparent' : P.ink;
  ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke;

  // 胸ビレ・腹ビレ（体より下に描く）
  for (const [ji, len, wid, spread] of [[3, 34, 14, 1.0], [7, 22, 9, 1.1]]) {
    for (const side of [1, -1]) {
      const p = c.side(ji, BODY[ji] * s * 0.9 * side);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, len * s, wid * s, A[ji - 1] + side * spread + Math.PI, 0, 6.28);
      ctx.fillStyle = shadow ? fill : f.fin; ctx.fill(); ctx.stroke();
    }
  }
  // 尾ビレ：体の曲がり具合で開き方が変わる
  const bend = Motion.angleDiff(A[n - 5], A[n - 1]);
  const tj = J[n - 1], ta = A[n - 1];
  const tl = 46 * s;
  const tip1 = { x: tj.x - Math.cos(ta + 0.45 + bend * 0.8) * tl, y: tj.y - Math.sin(ta + 0.45 + bend * 0.8) * tl };
  const tip2 = { x: tj.x - Math.cos(ta - 0.45 + bend * 0.8) * tl, y: tj.y - Math.sin(ta - 0.45 + bend * 0.8) * tl };
  const notch = { x: tj.x - Math.cos(ta + bend) * tl * 0.55, y: tj.y - Math.sin(ta + bend) * tl * 0.55 };
  ctx.beginPath();
  ctx.moveTo(J[n - 2].x, J[n - 2].y);
  ctx.quadraticCurveTo(tip1.x, tip1.y, tip1.x, tip1.y);
  ctx.quadraticCurveTo(notch.x, notch.y, tip2.x, tip2.y);
  ctx.closePath();
  ctx.fillStyle = shadow ? fill : f.fin; ctx.fill(); ctx.stroke();

  // 体
  const outline = bodyOutline(f);
  ctx.beginPath(); Motion.smoothClosed(ctx, outline);
  ctx.fillStyle = fill; ctx.fill();
  if (!shadow) {
    // 模様（体の形で切り抜く）
    ctx.save(); ctx.clip();
    ctx.fillStyle = f.spot;
    for (const sp of f.spots) {
      const p = c.side(sp.j, BODY[sp.j] * s * sp.o);
      ctx.beginPath(); ctx.arc(p.x, p.y, BODY[sp.j] * s * sp.r * 1.4, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    ctx.beginPath(); Motion.smoothClosed(ctx, outline); ctx.stroke();
    // 背ビレ（背骨に沿った線）
    ctx.beginPath();
    for (let i = 3; i <= 7; i++) { const p = J[i]; i === 3 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); }
    ctx.strokeStyle = 'rgba(74,59,92,0.35)'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.stroke();
    // 目
    for (const side of [1, -1]) {
      const e = c.side(1, BODY[1] * s * 0.62 * side, -0.3 * side);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(e.x, e.y, 6.5 * s, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e.x - 2 * s, e.y - 2 * s, 2.4 * s, 0, 6.28); ctx.fill();
    }
    // ほっぺ（食べた直後はハート）
    if (f.happy > 0) {
      const h = J[0], k = 1 - f.happy;
      heart(ctx, h.x + 10, h.y - 40 * s - k * 40, 10 + 4 * Math.sin(k * 9), f.happy);
    }
  }
  ctx.restore();
}

function heart(ctx, x, y, r, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = P.pink; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  ctx.fill(); ctx.stroke(); ctx.restore();
}

function lily(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#7fcf9a'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r, 0.25, Math.PI * 2 - 0.25); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
