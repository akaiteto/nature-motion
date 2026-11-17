// 07 アニメ調の炎
// 中身は 1つの流体シミュレーション（common/fluid.js）。温度が高い所ほど上へ浮く力を足すと、炎になる。
// 左右は「同じ炎」を2通りに塗っただけ：
//   左：温度をなめらかなグラデーションで塗る（リアル寄り）
//   右：温度を4段階の色に分け、外側に線を引く（アニメ寄り）
const { W, H, palette: P } = Motion;
const NX = 72, NY = 100;           // 格子
const UP = 4;                       // 描くときに格子を何倍の細かさで塗るか
const fluid = new Fluid(NX, NY, ['heat']);
fluid.vorticity = 6; fluid.iterations = 24;

const PANEL_W = 440, PANEL_H = 590, PANEL_Y = 115;
const PANELS = [{ x: 170, toon: false, name: 'グラデーションで塗る' }, { x: 670, toon: true, name: '4段階の色＋線で塗る' }];
const img = new ImageData(NX * UP, NY * UP);
const off = document.createElement('canvas'); off.width = NX * UP; off.height = NY * UP;
const octx = off.getContext('2d');
const sparks = [];

// 温度 → 色
const BANDS = [[0.1, null], [0.3, [255, 95, 126]], [0.55, [255, 154, 77]], [0.8, [255, 216, 77]], [9, [255, 249, 220]]];
function smoothColor(T) {
  const stops = [[0, [58, 48, 96]], [0.15, [190, 60, 110]], [0.35, [255, 110, 110]], [0.6, [255, 170, 80]], [0.85, [255, 230, 120]], [1.2, [255, 255, 235]]];
  for (let i = 1; i < stops.length; i++) if (T < stops[i][0]) {
    const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], k = (T - t0) / (t1 - t0);
    return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
  }
  return stops[stops.length - 1][1];
}
function band(T) { for (let i = 0; i < BANDS.length; i++) if (T < BANDS[i][0]) return i; return BANDS.length - 1; }

Motion.create({
  update(dt, t) {
    // 燃えている所：下のまんなか。ゆらぎをノイズで
    const cx = NX / 2 + (Motion.noise(t * 2) - 0.5) * 6;
    for (let k = 0; k < 3; k++) {
      const x = cx + (k - 1) * 7 + (Motion.noise(t * 3 + k * 10) - 0.5) * 4;
      fluid.splat(x, NY - 12, 4.2, (Motion.noise(t * 4 + k) - 0.5) * 14, -14, { heat: 0.16 });
    }
    // 浮く力（温度が高いほど上へ）と、冷える
    const h = fluid.f.heat;
    for (let i = 0; i < h.length; i++) { fluid.v[i] -= h[i] * 45 * dt; h[i] *= Math.exp(-2.4 * dt); }
    fluid.step(dt);

    // 火の粉：流れに乗って上がる
    if (Motion.rand() < dt * 9) sparks.push({ x: cx + Motion.range(-8, 8), y: NY - 16, t: 0, life: Motion.range(0.8, 1.6) });
    for (const s of sparks) {
      s.t += dt;
      s.x += fluid.sample(fluid.u, s.x, s.y) * dt * 1.1; s.y += fluid.sample(fluid.v, s.x, s.y) * dt * 1.1 - 6 * dt;
    }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > sparks[i].life) sparks.splice(i, 1);
  },

  draw(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c2650'); g.addColorStop(1, '#5a4a8a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 星
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i++) { const x = (i * 157) % W, y = (i * 89) % 260; ctx.fillRect(x, y, 2, 2); }

    for (const panel of PANELS) {
      paint(panel.toon);
      ctx.save();
      Motion.roundRect(ctx, panel.x, PANEL_Y, PANEL_W, PANEL_H, 24); ctx.clip();
      ctx.fillStyle = '#3a3060'; ctx.fillRect(panel.x, PANEL_Y, PANEL_W, PANEL_H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, panel.x - 10, PANEL_Y - 20, PANEL_W + 20, PANEL_H + 20);
      // 火の粉
      for (const s of sparks) {
        const x = panel.x - 10 + s.x / NX * (PANEL_W + 20), y = PANEL_Y - 20 + s.y / NY * (PANEL_H + 20);
        const a = 1 - s.t / s.life;
        if (panel.toon) { ctx.fillStyle = `rgba(255,226,122,${a})`; star(ctx, x, y, 5); }
        else { ctx.fillStyle = `rgba(255,200,120,${a})`; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.28); ctx.fill(); }
      }
      logs(ctx, panel.x + PANEL_W / 2, PANEL_Y + PANEL_H - 50);
      ctx.restore();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
      Motion.roundRect(ctx, panel.x, PANEL_Y, PANEL_W, PANEL_H, 24); ctx.stroke();
      pill(ctx, panel.x + PANEL_W / 2, PANEL_Y + PANEL_H - 6, panel.name);
    }
    Motion.label(ctx, '炎', '同じシミュレーションを2通りに塗る');
  }
});

function paint(toon) {
  const d = img.data, w = NX * UP, h = NY * UP;
  const T = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) T[x + y * w] = fluid.sample(fluid.f.heat, x / UP, y / UP);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = x + y * w, o = k * 4, v = T[k];
    let c, a = 255;
    if (!toon) { c = smoothColor(v); a = Math.min(255, v * 900); }
    else {
      const b = band(v);
      // 帯の境目（外側）に線を引く
      const bl = x > 0 ? band(T[k - 1]) : b, bu = y > 0 ? band(T[k - w]) : b, br = x < w - 1 ? band(T[k + 1]) : b, bd = y < h - 1 ? band(T[k + w]) : b;
      const edge = (b === 0) !== (bl === 0) || (b === 0) !== (bu === 0) || (b === 0) !== (br === 0) || (b === 0) !== (bd === 0);
      if (edge) { c = [74, 59, 92]; }
      else if (b === 0) { a = 0; c = [0, 0, 0]; }
      else c = BANDS[b][1];
    }
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a;
  }
  octx.putImageData(img, 0, 0);
}

function logs(ctx, x, y) {
  ctx.lineCap = 'round';
  for (const [a, c] of [[0.35, '#b07a55'], [-0.35, '#c98d63']]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 34; ctx.beginPath(); ctx.moveTo(-90, 0); ctx.lineTo(90, 0); ctx.stroke();
    ctx.strokeStyle = c; ctx.lineWidth = 26; ctx.stroke();
    ctx.restore();
  }
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.4 : r, a = i * Math.PI / 4; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.fill();
}
function pill(ctx, x, y, text) {
  ctx.save(); ctx.font = '700 22px "Noto Sans CJK JP","Hiragino Sans",sans-serif';
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
  Motion.roundRect(ctx, x - w / 2, y - 20, w, 40, 20); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}
