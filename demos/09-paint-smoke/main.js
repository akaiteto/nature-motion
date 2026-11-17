// 09 絵の具の渦
// 07 の炎と同じ流体（common/fluid.js）に、色のついた絵の具を流しこむだけ。
// 絵の具を出す「筆」が円を描いて回り、ときどき向きを変える。渦の強調を強めにすると、くるくる巻く。
// マウスでドラッグすると、自分でかき混ぜられる。
const { W, H, palette: P } = Motion;
const NX = 160, NY = 90, UP = 2;
const fluid = new Fluid(NX, NY, ['r', 'g', 'b']);
fluid.vorticity = 14; fluid.iterations = 20;
const COLORS = [[255, 143, 184], [143, 227, 207], [185, 166, 255], [255, 226, 122], [159, 216, 255], [255, 194, 159]];
const BG = [44, 37, 70];
const img = new ImageData(NX * UP, NY * UP);
const off = document.createElement('canvas'); off.width = NX * UP; off.height = NY * UP;
const octx = off.getContext('2d');
const brushes = [0, 1, 2, 3].map(i => ({ a: i * Math.PI / 2, r: 22 + i * 4, speed: (i % 2 ? -1 : 1) * (0.6 + i * 0.12), c: i }));
let last = { x: 0, y: 0 };

Motion.create({
  update(dt, t) {
    for (const b of brushes) {
      b.a += b.speed * dt;
      const x = NX / 2 + Math.cos(b.a) * b.r * 1.6, y = NY / 2 + Math.sin(b.a) * b.r;
      // 進む向きへ押しながら、色をまく
      const tx = -Math.sin(b.a) * Math.sign(b.speed), ty = Math.cos(b.a) * Math.sign(b.speed);
      const ci = Math.floor(t / 3 + b.c) % COLORS.length, c = COLORS[ci];
      const amt = 0.16;
      fluid.splat(x, y, 2.6, tx * 70, ty * 70, { r: c[0] / 255 * amt, g: c[1] / 255 * amt, b: c[2] / 255 * amt });
    }
    // 2秒ごとにまんなかから「ぽん」と吹き出す
    if (Math.floor(t / 2.5) !== Math.floor((t - dt) / 2.5)) {
      const a = Motion.range(0, 6.28), c = COLORS[Math.floor(Motion.rand() * COLORS.length)];
      fluid.splat(NX / 2, NY / 2, 6, Math.cos(a) * 260, Math.sin(a) * 260, { r: c[0] / 255 * 1.5, g: c[1] / 255 * 1.5, b: c[2] / 255 * 1.5 });
    }
    if (Motion.mouse.down) {
      const mx = Motion.mouse.x / W * NX, my = Motion.mouse.y / H * NY;
      fluid.splat(mx, my, 3, (mx - last.x) / dt, (my - last.y) / dt, {});
      last = { x: mx, y: my };
    } else last = { x: Motion.mouse.x / W * NX, y: Motion.mouse.y / H * NY };
    // 少しずつ薄れる
    for (const k of ['r', 'g', 'b']) { const a = fluid.f[k]; for (let i = 0; i < a.length; i++) a[i] *= 1 - 0.4 * dt; }
    fluid.step(dt);
  },

  draw(ctx, t) {
    const d = img.data, w = NX * UP, h = NY * UP, f = fluid.f;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x / UP, gy = y / UP;
      const r = fluid.sample(f.r, gx, gy), g = fluid.sample(f.g, gx, gy), b = fluid.sample(f.b, gx, gy);
      const m = Math.max(r, g, b), a = Math.min(1, m * 3);
      const o = (x + y * w) * 4;
      // 色の「濃さ」で背景と混ぜる（絵の具の色そのものは r:g:b の比）
      const s = m > 1e-4 ? 255 / m : 0;
      d[o] = BG[0] * (1 - a) + Math.min(255, r * s) * a;
      d[o + 1] = BG[1] * (1 - a) + Math.min(255, g * s) * a;
      d[o + 2] = BG[2] * (1 - a) + Math.min(255, b * s) * a;
      d[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, H);
    Motion.label(ctx, '絵の具の渦', '流体（Stable Fluids）＋渦の強調／ドラッグでかき混ぜる');
  }
});
