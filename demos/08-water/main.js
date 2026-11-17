// 08 水面とアヒル
// 水面：横にならべた柱の高さだけを持つ（高さ場）。となりの柱との高さの差で引っぱり合うと、波が伝わる。
// アヒル：沈んだ分だけ浮く力がかかる。アヒルが上下に動くと、下の柱を押して波を起こす（行き来する＝双方向）。
// クリックでアヒルが落ちてくる（何もしなくても順番に落ちてくる）。
const { W, H, palette: P } = Motion;
const N = 200, DX = W / (N - 1), BASE = 470;
const C = 260, DAMP = 0.995, G = 1500;
const h = new Float32Array(N), hv = new Float32Array(N);
const ducks = [], drops = [];
const SCHEDULE = [[0.4, 640, 0.9], [1.6, 330, 0.75], [2.8, 960, 0.65], [4.4, 520, 0.55], [5.6, 820, 1.0]];
let sched = 0;
const COLORS = ['#ffe27a', '#ffc29f', '#ffffff', '#b9a6ff', '#9fe8d6'];

function surfaceY(x) {
  const f = Motion.clamp(x / DX, 0, N - 1.001), i = Math.floor(f), k = f - i;
  return BASE - (h[i] * (1 - k) + h[i + 1] * k);
}
function addDuck(x, s) {
  ducks.push({ x, y: -60, vx: Motion.range(-20, 20), vy: 0, ang: Motion.range(-0.4, 0.4), va: 0, s, c: COLORS[ducks.length % COLORS.length], face: Motion.rand() < 0.5 ? 1 : -1, wet: false });
  if (ducks.length > 7) ducks.shift();
}

Motion.create({
  substeps: 4,
  update(dt, t) {
    while (sched < SCHEDULE.length && t >= SCHEDULE[sched][0]) { addDuck(SCHEDULE[sched][1], SCHEDULE[sched][2]); sched++; }
    if (Motion.mouse.clicked) addDuck(Motion.mouse.x, Motion.range(0.6, 1));

    // 左はしに小さな波を起こす装置（ゆったり揺れ続けるように）
    h[0] = Math.sin(t * 1.7) * 7 + Math.sin(t * 0.6) * 5;
    // 波：となりとの差で加速
    for (let i = 0; i < N; i++) {
      const l = h[Math.max(0, i - 1)], r = h[Math.min(N - 1, i + 1)];
      hv[i] += C * C * (l + r - 2 * h[i]) / (DX * DX) * dt;
      hv[i] *= DAMP;
    }
    for (let i = 1; i < N; i++) h[i] += hv[i] * dt;
    // ごく弱くならす（細かすぎるギザギザを消す）
    for (let i = 1; i < N - 1; i++) hv[i] += (h[i - 1] + h[i + 1] - 2 * h[i]) * 0.6;

    for (const d of ducks) {
      const R = 46 * d.s; // 体の大きさ
      const sy = surfaceY(d.x);
      const bottom = d.y + R * 0.55;
      const depth = Motion.clamp(bottom - sy, 0, R * 1.1);
      d.vy += G * dt;
      d.vy -= depth / R * G * 2.8 * dt;           // 浮く力
      if (depth > 0) { d.vy *= 1 - 9 * dt; d.vx *= 1 - 0.8 * dt; }
      // 水にとびこんだ瞬間：しぶき
      if (depth > 0 && !d.wet && d.vy > 450) {
        for (let k = 0; k < 18; k++) drops.push({ x: d.x + Motion.range(-R, R), y: sy, vx: Motion.range(-260, 260), vy: Motion.range(-520, -200) * d.s, r: Motion.range(3, 7) });
      }
      d.wet = depth > 0;
      // 傾き：水面の傾きに合わせる（ばね）
      const slope = Math.atan2(surfaceY(d.x + R) - surfaceY(d.x - R), 2 * R);
      d.va += ((depth > 0 ? slope : d.ang) - d.ang) * 40 * dt; d.va *= 1 - 4 * dt;
      d.ang += d.va * dt;
      d.vx += Math.sin(slope) * 60 * dt; // 坂を少しすべる
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.x < 60) { d.x = 60; d.vx = Math.abs(d.vx); } if (d.x > W - 60) { d.x = W - 60; d.vx = -Math.abs(d.vx); }
      // アヒルが水を押しのける：沈んでいる分だけ下の柱を低くし、その分の水を両どなりへ逃がす（水の量は変わらない）
      const i0 = Math.max(2, Math.floor((d.x - R) / DX)), i1 = Math.min(N - 3, Math.ceil((d.x + R) / DX));
      const nd = Math.max(0, Math.min(R * 1.1, d.y + R * 0.55 - surfaceY(d.x))) * 0.7;
      const now = new Map();
      for (let i = i0; i <= i1; i++) { const u = (i * DX - d.x) / R; now.set(i, nd * Math.cos(Motion.clamp(u, -1, 1) * Math.PI / 2) ** 2); }
      const prev = d.disp || new Map();
      let moved = 0;
      for (const i of new Set([...prev.keys(), ...now.keys()])) {
        const delta = (now.get(i) || 0) - (prev.get(i) || 0);
        h[i] -= delta; moved += delta;
      }
      // 押しのけた水は、両側へなだらかに配る
      for (let k = 1; k <= 6; k++) {
        const w = moved / 2 * Math.sin(k / 7 * Math.PI) / 3.4;
        h[Math.max(0, i0 - k)] += w; h[Math.min(N - 1, i1 + k)] += w;
      }
      d.disp = now;
    }

    for (const p of drops) { p.vy += G * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let k = drops.length - 1; k >= 0; k--) {
      const p = drops[k];
      if (p.vy > 0 && p.y > surfaceY(p.x)) { const i = Math.round(Motion.clamp(p.x / DX, 0, N - 1)); hv[i] -= p.r * 6; drops.splice(k, 1); }
    }
  },

  draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, BASE);
    g.addColorStop(0, '#ffe9f3'); g.addColorStop(1, '#fff7e6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 水
    const path = () => { ctx.beginPath(); ctx.moveTo(0, H); for (let i = 0; i < N; i++) ctx.lineTo(i * DX, BASE - h[i]); ctx.lineTo(W, H); ctx.closePath(); };
    const wg = ctx.createLinearGradient(0, BASE - 60, 0, H);
    wg.addColorStop(0, '#8fdcf2'); wg.addColorStop(1, '#5aa8de');
    path(); ctx.fillStyle = wg; ctx.fill();
    // 水面の白い線と、少し下の明るい帯
    ctx.beginPath(); for (let i = 0; i < N; i++) ctx.lineTo(i * DX, BASE - h[i] + 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 10; ctx.stroke();

    for (const d of ducks) drawDuck(ctx, d);
    // 手前の水（アヒルの下半分を隠す）
    ctx.save(); ctx.globalAlpha = 0.3; path(); ctx.fillStyle = '#5fb3e6'; ctx.fill(); ctx.restore();
    ctx.beginPath(); for (let i = 0; i < N; i++) ctx.lineTo(i * DX, BASE - h[i]);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#d6f3ff'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
    for (const p of drops) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.stroke(); }
    Motion.label(ctx, '水面とアヒル', '柱の高さだけの水（高さ場）／アヒルと水が押し合う／クリックで追加');
  }
});

function drawDuck(ctx, d) {
  const R = 46 * d.s;
  ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.ang); ctx.scale(d.face, 1);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.fillStyle = d.c;
  // 体
  ctx.beginPath(); ctx.moveTo(-R * 1.1, -R * 0.2); ctx.quadraticCurveTo(-R * 1.3, -R * 0.75, -R * 0.75, -R * 0.45);
  ctx.quadraticCurveTo(0, -R * 0.5, R * 0.75, -R * 0.2); ctx.quadraticCurveTo(R * 1.05, R * 0.6, 0, R * 0.62);
  ctx.quadraticCurveTo(-R * 1.0, R * 0.6, -R * 1.1, -R * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  // つばさ
  ctx.beginPath(); ctx.ellipse(-R * 0.1, R * 0.08, R * 0.45, R * 0.26, -0.2, 0, 6.28); ctx.stroke();
  // 頭
  ctx.beginPath(); ctx.arc(R * 0.45, -R * 0.75, R * 0.45, 0, 6.28); ctx.fill(); ctx.stroke();
  // くちばし
  ctx.fillStyle = '#ff9f6b';
  ctx.beginPath(); ctx.ellipse(R * 0.98, -R * 0.66, R * 0.26, R * 0.12, 0.1, 0, 6.28); ctx.fill(); ctx.stroke();
  // 目とほっぺ
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(R * 0.6, -R * 0.86, R * 0.07, 0, 6.28); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,160,0.5)'; ctx.beginPath(); ctx.ellipse(R * 0.55, -R * 0.6, R * 0.1, R * 0.06, 0, 0, 6.28); ctx.fill();
  ctx.restore();
}
