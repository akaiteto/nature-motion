// 06 マントと髪の揺れ（二次的な動き）
// 左右のキャラは「まったく同じ動き」をしている。違いはマントとツインテールだけ。
//   左：揺れなし（体にくっついて一緒に動くだけ）
//   右：揺れあり（点をつないだ布とひも。体の動きに引っぱられて、遅れて揺れる）
// 布もひもも「点を動かす → 決まった長さに戻す」をくり返すだけ（位置ベースの物理）。
const { W, H, palette: P } = Motion;
const FLOOR = 600;
const CAPE_C = 9, CAPE_R = 11, CAPE_S = 13; // 布の点の数と間隔
const HAIR_N = 13, HAIR_L = 13;

// ---------- 体の動き（キーフレーム的に時間の式で決める） ----------
function pose(t, cx) {
  const run = Math.sin(t * 0.9);
  const vx = Math.cos(t * 0.9) * 0.9 * 210;
  let x = cx + run * 210;
  // 走りの上下と、ときどきジャンプ
  let y = FLOOR - 150 - Math.abs(Math.sin(t * 7)) * 12 * Math.min(1, Math.abs(vx) / 120);
  const jt = (t % 4.2) - 3.2; // 4.2秒ごとに1秒のジャンプ
  if (jt > 0 && jt < 0.8) { const k = jt / 0.8; y -= 4 * k * (1 - k) * 100; }
  return { x, y, rot: Motion.clamp(vx * 0.0013, -0.25, 0.25), face: vx >= 0 ? 1 : -1, vx };
}
// 髪とマントの付け根は左右対称なので、向きが変わっても入れかえない（入れかえると髪が頭の反対側へ瞬間移動する）
function toWorld(ps, lx, ly) {
  const c = Math.cos(ps.rot), s = Math.sin(ps.rot);
  return { x: ps.x + lx * c - ly * s, y: ps.y + lx * s + ly * c };
}

// ---------- 揺れもの ----------
function makeRig(cx) {
  const ps = pose(0, cx);
  const cape = [];
  for (let r = 0; r < CAPE_R; r++) for (let c = 0; c < CAPE_C; c++) {
    const p = toWorld(ps, capeLocal(c, r).x, capeLocal(c, r).y);
    cape.push({ x: p.x, y: p.y, px: p.x, py: p.y });
  }
  const hair = [-1, 1].map(side => Array.from({ length: HAIR_N }, (_, i) => {
    const p = toWorld(ps, hairLocal(side, i).x, hairLocal(side, i).y); return { x: p.x, y: p.y, px: p.x, py: p.y };
  }));
  return { cx, cape, hair };
}
// 布の「止まっているときの形」：肩から下へ、すそが少し広がる
function capeLocal(c, r) { const spread = 1 + r * 0.06; return { x: (c - (CAPE_C - 1) / 2) * CAPE_S * spread - 6, y: -34 + r * CAPE_S }; }
// ツインテールの「止まっているときの形」：頭の横から外へ、下へ
function hairLocal(side, i) { const a = Math.PI / 2 - side * (0.75 - i * 0.04); return { x: side * 52 + Math.cos(a) * i * HAIR_L, y: -140 + Math.sin(a) * i * HAIR_L }; }

const left = makeRig(W * 0.27), right = makeRig(W * 0.73);
const dust = [];

Motion.create({
  substeps: 4,
  update(dt, t) {
    simulate(right, t, dt);
    // 着地のほこり
    const ps = pose(t, right.cx), jt = (t % 4.2) - 3.2;
    if (jt > 0.8 && jt < 0.8 + dt * 1.01) for (const cx of [left.cx, right.cx]) for (let i = 0; i < 8; i++) dust.push({ x: pose(t, cx).x + Motion.range(-40, 40), y: FLOOR - 4, vx: Motion.range(-80, 80), vy: Motion.range(-60, -10), t: 0 });
    dust.forEach(d => { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; });
    while (dust.length && dust[0].t > 0.6) dust.shift();
    void ps;
  },

  draw(ctx, t) {
    ctx.fillStyle = '#f2f0ff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e4dcff'; ctx.fillRect(W / 2 - 2, 0, 4, FLOOR);
    ctx.fillStyle = '#d9cdf5'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, FLOOR); ctx.lineTo(W, FLOOR); ctx.stroke();
    tag(ctx, W * 0.27, 'ゆれなし', '#ffffff');
    tag(ctx, W * 0.73, 'ゆれあり', P.yellow);

    for (const rig of [left, right]) {
      const ps = pose(t, rig.cx);
      const physics = rig === right;
      const cape = physics ? rig.cape : rigidCape(ps);
      const hair = physics ? rig.hair : [-1, 1].map(s => Array.from({ length: HAIR_N }, (_, i) => toWorld(ps, hairLocal(s, i).x, hairLocal(s, i).y)));
      // 影
      const k = Math.max(0.4, 1 - (FLOOR - 150 - ps.y) / 300);
      ctx.fillStyle = 'rgba(70,50,110,0.18)'; ctx.beginPath(); ctx.ellipse(ps.x, FLOOR + 4, 60 * k, 10 * k, 0, 0, 6.28); ctx.fill();
      drawCape(ctx, cape);
      for (const h of hair) drawTail(ctx, h);
      drawBody(ctx, ps, t);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const d of dust) { ctx.globalAlpha = 1 - d.t / 0.6; ctx.beginPath(); ctx.arc(d.x, d.y, 6 + d.t * 14, 0, 6.28); ctx.fill(); }
    ctx.globalAlpha = 1;
    Motion.label(ctx, 'マントと髪の揺れ', '同じ動きでも、遅れて揺れるものがあると生きて見える');
  }
});

function simulate(rig, t, dt) {
  const ps = pose(t, rig.cx);
  const wind = (Motion.noise(t * 0.7) - 0.5) * 220;
  const step = (p, gx, gy, damp) => {
    const vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp;
    p.px = p.x; p.py = p.y; p.x += vx + gx * dt * dt; p.y += vy + gy * dt * dt;
  };
  for (const p of rig.cape) step(p, wind, 1600, 0.997);
  for (const h of rig.hair) for (const p of h) step(p, wind * 0.5, 1600, 0.993);

  for (let it = 0; it < 8; it++) {
    // マントの上の列は肩にくっつける
    for (let c = 0; c < CAPE_C; c++) { const p = rig.cape[c], q = toWorld(ps, capeLocal(c, 0).x, capeLocal(c, 0).y); p.x = q.x; p.y = q.y; }
    for (let r = 0; r < CAPE_R; r++) for (let c = 0; c < CAPE_C; c++) {
      const i = r * CAPE_C + c, sp = CAPE_S * (1 + r * 0.06);
      if (c < CAPE_C - 1) link(rig.cape[i], rig.cape[i + 1], sp, r === 0);
      if (r < CAPE_R - 1) link(rig.cape[i], rig.cape[i + CAPE_C], CAPE_S, r === 0);
    }
    rig.hair.forEach((h, k) => {
      const side = k === 0 ? -1 : 1;
      const root = toWorld(ps, hairLocal(side, 0).x, hairLocal(side, 0).y);
      h[0].x = root.x; h[0].y = root.y;
      // 根もとの2点は髪型を保つ（ゴムで結んでいる所）
      const r1 = toWorld(ps, hairLocal(side, 1).x, hairLocal(side, 1).y);
      h[1].x += (r1.x - h[1].x) * 0.6; h[1].y += (r1.y - h[1].y) * 0.6;
      for (let i = 1; i < HAIR_N; i++) link(h[i - 1], h[i], HAIR_L, i === 1);
      for (let i = 2; i < HAIR_N; i++) soft(h[i - 2], h[i], HAIR_L * 1.9, 0.15); // ほどよいコシ
    });
  }
}
function link(a, b, rest, aFixed) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, diff = (d - rest) / d;
  if (aFixed) { b.x -= dx * diff; b.y -= dy * diff; }
  else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
}
function soft(a, b, rest, k) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
  if (d >= rest) return;
  const diff = (d - rest) / d * k;
  a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5;
}
function rigidCape(ps) {
  const out = [];
  for (let r = 0; r < CAPE_R; r++) for (let c = 0; c < CAPE_C; c++) { const l = capeLocal(c, r); out.push(toWorld(ps, l.x, l.y)); }
  return out;
}

// ---------- 描く ----------
function drawCape(ctx, cape) {
  // 四角ごとに塗る。縮んでいる所（ひだ）は少し暗く
  for (let r = 0; r < CAPE_R - 1; r++) for (let c = 0; c < CAPE_C - 1; c++) {
    const a = cape[r * CAPE_C + c], b = cape[r * CAPE_C + c + 1], d = cape[(r + 1) * CAPE_C + c], e = cape[(r + 1) * CAPE_C + c + 1];
    const w = Math.hypot(b.x - a.x, b.y - a.y) / (CAPE_S * (1 + r * 0.06));
    const l = Math.round(Motion.clamp(70 + w * 18, 70, 92));
    ctx.fillStyle = `hsl(165, 60%, ${l - 8}%)`; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(e.x, e.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // 輪郭
  ctx.beginPath();
  const edge = [];
  for (let r = 0; r < CAPE_R; r++) edge.push(cape[r * CAPE_C]);
  for (let c = 0; c < CAPE_C; c++) edge.push(cape[(CAPE_R - 1) * CAPE_C + c]);
  for (let r = CAPE_R - 1; r >= 0; r--) edge.push(cape[r * CAPE_C + CAPE_C - 1]);
  edge.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.stroke();
}

function drawTail(ctx, pts) {
  // 根もとが太く、先が細いリボン
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    const w = 15 * (1 - i / pts.length) + 3 + (i === 1 ? 4 : 0);
    L.push({ x: pts[i].x + Math.cos(ang) * w, y: pts[i].y + Math.sin(ang) * w });
    R.push({ x: pts[i].x - Math.cos(ang) * w, y: pts[i].y - Math.sin(ang) * w });
  }
  ctx.beginPath(); Motion.smoothClosed(ctx, [...L, pts[pts.length - 1], ...R.reverse()]);
  ctx.fillStyle = '#ff9cc2'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke();
  // 髪どめ
  ctx.fillStyle = P.yellow; ctx.beginPath(); ctx.arc(pts[1].x, pts[1].y, 9, 0, 6.28); ctx.fill(); ctx.stroke();
}

function drawBody(ctx, ps, t) {
  ctx.save(); ctx.translate(ps.x, ps.y); ctx.rotate(ps.rot); ctx.scale(ps.face, 1);
  ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round';
  // 足
  const stepA = Math.sin(t * 7) * Math.min(1, Math.abs(ps.vx) / 120);
  ctx.fillStyle = '#6b5a8e';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 16 + stepA * s * 10, 142, 14, 9, 0, 0, 6.28); ctx.fill(); ctx.stroke(); }
  // 胴
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(40, 70); ctx.quadraticCurveTo(0, 82, -40, 70); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.lav; ctx.beginPath(); ctx.moveTo(-40, 70); ctx.quadraticCurveTo(0, 82, 40, 70); ctx.lineTo(46, 112); ctx.quadraticCurveTo(0, 124, -46, 112); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffe0cf';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 18, 112); ctx.lineTo(s * 16, 136); ctx.stroke(); }
  // 頭
  ctx.fillStyle = '#ffe0cf';
  ctx.beginPath(); ctx.arc(0, -96, 62, 0, 6.28); ctx.fill(); ctx.stroke();
  // 前髪
  ctx.fillStyle = '#ff9cc2';
  ctx.beginPath(); ctx.arc(0, -100, 64, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(40, -110, 20, -120); ctx.quadraticCurveTo(8, -100, -6, -122); ctx.quadraticCurveTo(-30, -104, -60, -112); ctx.closePath(); ctx.fill(); ctx.stroke();
  // 顔
  const blink = (t % 3.3) < 0.12;
  ctx.fillStyle = P.ink;
  for (const s of [-1, 1]) {
    if (blink) { ctx.fillRect(s * 22 + 8 - 8, -86, 16, 4); continue; }
    ctx.beginPath(); ctx.ellipse(s * 22 + 8, -84, 7, 10, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * 22 + 6, -88, 3, 0, 6.28); ctx.fill(); ctx.fillStyle = P.ink;
  }
  ctx.fillStyle = 'rgba(255,120,160,0.5)';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * 34 + 8, -68, 9, 5, 0, 0, 6.28); ctx.fill(); }
  ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(8, -70, 6, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}

function tag(ctx, x, text, bg) {
  ctx.save(); ctx.font = '700 28px "Noto Sans CJK JP","Hiragino Sans",sans-serif';
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = bg; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  Motion.roundRect(ctx, x - w / 2, 140, w, 50, 25); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, 166);
  ctx.restore();
}
