// 02 トカゲとクモ
// 体は 01 と同じ背骨の鎖。脚は「足を置きたい場所」から離れすぎたら1歩踏み出すだけ。
// ひざの位置は 2関節の逆運動学（common/ik.js）で計算する。
// 同じ組の脚（トカゲは対角、クモは1本おき）は同時に上げない → それだけで歩き方になる。
const { W, H, palette: P } = Motion;

// ---------- トカゲ ----------
const LZ_BODY = [20, 24, 20, 17, 22, 25, 25, 22, 18, 14, 11, 9, 7, 5.5, 4, 3];
const lizard = {
  head: new Steerer(610, 380, Math.PI / 2, 120, 1.4),
  chain: new Chain(610, 380, LZ_BODY.length, 15, Math.PI / 9),
  legs: [],
  seed: 5
};
// [関節, 左右, 足を出す角度]
const LZ_LEGS = [[4, 1, 0.9], [4, -1, 0.9], [8, 1, 2.1], [8, -1, 2.1]];
LZ_LEGS.forEach(() => lizard.legs.push(new IK.Leg(26, 26, 300, 250)));

// ---------- クモ ----------
const spider = {
  head: new Steerer(1100, 400, Math.PI / 2, 105, 2.6),
  legs: [], seed: 40, bob: 0
};
const SP_ANGLES = [0.55, 1.15, 1.85, 2.45];
for (const side of [1, -1]) SP_ANGLES.forEach((a, i) => spider.legs.push({ side, a, i, leg: new IK.Leg(55, 62, 900, 480) }));

// 最初は足を置きたい場所に置いておく
spider.legs.forEach(L => { const a = spider.head.heading + L.side * L.a; L.leg.foot = { x: 1100 + Math.cos(a) * 105, y: 400 + Math.sin(a) * 105 }; });
const deco = Array.from({ length: 80 }, () => ({ x: Motion.range(0, W), y: Motion.range(0, H), r: Motion.range(3, 12), g: Motion.rand() < 0.25 }));
const prints = [];
lizard.legs.forEach(l => (l.onLand = f => prints.push({ x: f.x, y: f.y, t: 0, c: '#d9b98f' })));

function wander(c, t, cx, cy, rx, ry) {
  return { x: cx + (Motion.noise(t * 0.18 + c.seed) - 0.5) * rx * 2.2, y: cy + (Motion.noise(t * 0.18 + c.seed + 50) - 0.5) * ry * 2.2 };
}

Motion.create({
  update(dt, t) {
    // トカゲ：上半分をうろうろ（マウスがあればマウスへ）
    const n1 = (Motion.noise(t * 0.3 + 2) - 0.5) * 1.5;
    const lt = Motion.mouse.active ? Motion.mouse : { x: 430 + Math.cos(t * 0.4 + n1) * 210, y: 430 + Math.sin(t * 0.4 + n1) * 170 };
    // ときどき立ち止まる（止まると脚もそろう）
    const pause = Motion.noise(t * 0.4 + 3) < 0.28 ? 0 : 1;
    lizard.head.steerTo(lt.x, lt.y, dt, pause);
    lizard.chain.resolve(lizard.head);
    const c = lizard.chain;
    lizard.legs.forEach((leg, k) => {
      const [ji, side, ang] = LZ_LEGS[k];
      const a = c.angles[ji] + side * ang;
      const desired = { x: c.joints[ji].x + Math.cos(a) * 44, y: c.joints[ji].y + Math.sin(a) * 44 };
      const partner = lizard.legs[k ^ 3]; // 対角の脚
      const other = lizard.legs.filter((_, q) => q !== k && q !== (k ^ 3));
      leg.update(desired, dt, !other.some(o => o.stepping) || partner.stepping, 26, 0.13);
    });

    // クモ：下半分をうろうろ
    const n2 = (Motion.noise(t * 0.3 + 7) - 0.5) * 1.5;
    const st = { x: 950 + Math.cos(-t * 0.4 + n2) * 220, y: 400 + Math.sin(-t * 0.4 + n2) * 200 };
    spider.head.steerTo(st.x, st.y, dt, Motion.noise(t * 0.5 + 9) < 0.25 ? 0.15 : 1);
    const h = spider.head;
    for (const L of spider.legs) {
      const a = h.heading + L.side * L.a;
      const desired = { x: h.x + Math.cos(a) * 105, y: h.y + Math.sin(a) * 105 };
      const group = (L.i + (L.side > 0 ? 1 : 0)) % 2;
      const othersMoving = spider.legs.some(o => o !== L && o.leg.stepping && (o.i + (o.side > 0 ? 1 : 0)) % 2 !== group);
      L.leg.update(desired, dt, !othersMoving, 40, 0.11, 0.5);
    }
    spider.bob = spider.legs.reduce((s, L) => s + L.leg.lift, 0) / 4;

    prints.forEach(p => (p.t += dt));
    while (prints.length && prints[0].t > 3) prints.shift();
  },

  draw(ctx, t) {
    // 地面
    ctx.fillStyle = '#fbeedd'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f3dfc6';
    for (const d of deco) { if (d.g) grass(ctx, d.x, d.y); else { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.28); ctx.fill(); } }
    // 足あと
    for (const p of prints) { ctx.globalAlpha = 0.5 * (1 - p.t / 3); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.28); ctx.fill(); }
    ctx.globalAlpha = 1;

    drawSpider(ctx);
    drawLizard(ctx);
    Motion.label(ctx, 'トカゲとクモ', '離れすぎたら1歩＋2関節の逆運動学（IK）');
  }
});

function limb(ctx, s, e, f, w, color) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = P.ink; ctx.lineWidth = w + 7;
  ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.lineTo(f.x, f.y); ctx.stroke();
}

function drawLizard(ctx) {
  const c = lizard.chain, J = c.joints, A = c.angles;
  // 影
  ctx.save(); ctx.globalAlpha = 0.15; ctx.translate(8, 14);
  ctx.beginPath(); Motion.smoothClosed(ctx, lizardOutline()); ctx.fillStyle = '#5a3d2a'; ctx.fill(); ctx.restore();
  // 脚
  lizard.legs.forEach((leg, k) => {
    const [ji, side] = LZ_LEGS[k];
    const s = c.side(ji, LZ_BODY[ji] * 0.6 * side);
    const bend = ji < 6 ? side : -side;
    const e = IK.solveTwoBone(s, leg.foot, leg.l1, leg.l2, bend);
    limb(ctx, s, e, leg.foot, 12 + leg.lift * 4, P.mint);
    // 指
    const fa = Math.atan2(leg.foot.y - e.y, leg.foot.x - e.x);
    ctx.fillStyle = P.mint; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
    for (const d of [-0.7, 0, 0.7]) {
      ctx.beginPath(); ctx.arc(leg.foot.x + Math.cos(fa + d) * 9, leg.foot.y + Math.sin(fa + d) * 9, 4.5, 0, 6.28); ctx.fill(); ctx.stroke();
    }
  });
  // 体
  const outline = lizardOutline();
  ctx.beginPath(); Motion.smoothClosed(ctx, outline);
  ctx.fillStyle = P.mint; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = '#c8f4e8';
  for (let i = 3; i < 13; i += 2) { const p = J[i]; ctx.beginPath(); ctx.arc(p.x, p.y, LZ_BODY[i] * 0.45, 0, 6.28); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); Motion.smoothClosed(ctx, outline);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke();
  // 目（上から見ているので頭の左右）
  for (const side of [1, -1]) {
    const e = c.side(1, LZ_BODY[1] * 0.75 * side, -0.25 * side);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(e.x + Math.cos(A[0]) * 2.5, e.y + Math.sin(A[0]) * 2.5, 4.5, 0, 6.28); ctx.fill();
  }
  // ほっぺ
  ctx.fillStyle = 'rgba(255,143,184,0.7)';
  for (const side of [1, -1]) { const p = c.side(0, LZ_BODY[0] * 0.55 * side, 0.6 * side); ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 6.28); ctx.fill(); }
}

function lizardOutline() {
  const c = lizard.chain, n = LZ_BODY.length, pts = [];
  for (let i = 0; i < n; i++) pts.push(c.side(i, LZ_BODY[i]));
  for (let i = n - 1; i >= 0; i--) pts.push(c.side(i, -LZ_BODY[i]));
  const a = c.angles[0], j = c.joints[0];
  for (const da of [-0.7, 0, 0.7]) pts.push({ x: j.x + Math.cos(a + da) * 26, y: j.y + Math.sin(a + da) * 26 });
  return pts;
}

function drawSpider(ctx) {
  const h = spider.head, a = h.heading, lift = spider.bob;
  const cx = h.x, cy = h.y - lift * 6;
  // 影
  ctx.fillStyle = 'rgba(90,61,42,0.15)';
  ctx.beginPath(); ctx.ellipse(h.x + 10, h.y + 16, 60, 46, a, 0, 6.28); ctx.fill();
  // 脚：ひざは体から遠い側に曲げる
  for (const L of spider.legs) {
    const s = { x: cx + Math.cos(a + L.side * L.a) * 26, y: cy + Math.sin(a + L.side * L.a) * 26 };
    const e1 = IK.solveTwoBone(s, L.leg.foot, L.leg.l1, L.leg.l2, 1);
    const e2 = IK.solveTwoBone(s, L.leg.foot, L.leg.l1, L.leg.l2, -1);
    const e = Math.hypot(e1.x - cx, e1.y - cy) > Math.hypot(e2.x - cx, e2.y - cy) ? e1 : e2;
    limb(ctx, s, e, L.leg.foot, 8, P.lav);
    ctx.fillStyle = P.lav; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, 6.28); ctx.fill(); ctx.stroke();
  }
  // おしり → 頭
  const bx = cx - Math.cos(a) * 34, by = cy - Math.sin(a) * 34;
  ctx.fillStyle = P.lav; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(bx, by, 44, 38, a, 0, 6.28); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9cfff';
  ctx.beginPath(); ctx.ellipse(bx - Math.cos(a) * 6, by - Math.sin(a) * 6, 20, 16, a, 0, 6.28); ctx.fill();
  ctx.fillStyle = P.lav;
  ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 30, 0, 6.28); ctx.fill(); ctx.stroke();
  // 目
  for (const side of [1, -1]) {
    const ex = cx + Math.cos(a) * 20 + Math.cos(a + Math.PI / 2) * 12 * side, ey = cy + Math.sin(a) * 20 + Math.sin(a + Math.PI / 2) * 12 * side;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, 9, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * 3, ey + Math.sin(a) * 3, 5, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + Math.cos(a) * 1.5 - 1.5, ey + Math.sin(a) * 1.5 - 1.5, 1.8, 0, 6.28); ctx.fill();
  }
}

function grass(ctx, x, y) {
  ctx.strokeStyle = '#9ccf8f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const d of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + d, y - 10, x + d * 1.6, y - 20); ctx.stroke(); }
}
