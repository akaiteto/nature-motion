// 10 模様が育つ（反応拡散／Gray-Scott モデル）
// 2つの物質 A と B が、広がりながら（拡散）反応する： A + 2B → 3B。A は外から補われ（F）、B は消えていく（k）。
// F と k の組み合わせだけで、てんてん・めいろ・増えていく丸、と模様が変わる。（Turing 1952、Gray & Scott 1984）
// 画面を左・中・右の3つに分けて、F と k だけを変えている。クリックで B を置ける。
const { W, H, palette: P } = Motion;
const NX = 256, NY = 144, STEPS = 14;
const DA = 1.0, DB = 0.5;
const ZONES = [ // [F, k, 名前]
  [0.035, 0.065, 'てんてん'],
  [0.029, 0.057, 'めいろ'],
  [0.0367, 0.0649, 'ふえるまる']
];
let A = new Float32Array(NX * NY).fill(1), B = new Float32Array(NX * NY);
let A2 = new Float32Array(NX * NY), B2 = new Float32Array(NX * NY);
const Fmap = new Float32Array(NX * NY), Kmap = new Float32Array(NX * NY);

// 場所ごとの F, k（となりの区画となめらかにつなぐ）
for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
  const u = x / NX * 3 - 0.5;
  const i = Math.max(0, Math.min(1, Math.floor(u))), f = Motion.clamp(u - i, 0, 1);
  const s = f < 0.4 ? 0 : f > 0.6 ? 1 : (f - 0.4) / 0.2;
  const a = ZONES[i], b = ZONES[Math.min(2, i + 1)];
  Fmap[x + y * NX] = a[0] + (b[0] - a[0]) * s; Kmap[x + y * NX] = a[1] + (b[1] - a[1]) * s;
}
function seed(cx, cy, r) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const X = cx + x, Y = cy + y; if (X < 1 || Y < 1 || X >= NX - 1 || Y >= NY - 1) continue;
    if (x * x + y * y <= r * r) { B[X + Y * NX] = 1; A[X + Y * NX] = 0.5; }
  }
}
// ハートの形のたね ＋ ばらばらの小さなたね
for (let t = 0; t < 6.28; t += 0.05) {
  const hx = 16 * Math.sin(t) ** 3, hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  seed(Math.round(NX / 2 + hx * 1.6), Math.round(NY / 2 + hy * 1.6), 1);
}
for (let i = 0; i < 26; i++) seed(Math.floor(Motion.range(8, NX - 8)), Math.floor(Motion.range(8, NY - 8)), 2);

const img = new ImageData(NX, NY);
const off = document.createElement('canvas'); off.width = NX; off.height = NY;
const octx = off.getContext('2d');
// 濃さ → 色（ミント → ピンク → クリーム）
const RAMP = [[0, [44, 37, 70]], [0.18, [96, 200, 190]], [0.3, [255, 143, 184]], [0.45, [255, 236, 200]]];
function ramp(v) {
  for (let i = 1; i < RAMP.length; i++) if (v < RAMP[i][0]) {
    const [t0, c0] = RAMP[i - 1], [t1, c1] = RAMP[i], k = (v - t0) / (t1 - t0);
    return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
  }
  return RAMP[RAMP.length - 1][1];
}

Motion.create({
  update() {
    if (Motion.mouse.clicked) seed(Math.floor(Motion.mouse.x / W * NX), Math.floor(Motion.mouse.y / H * NY), 3);
    for (let s = 0; s < STEPS; s++) {
      for (let y = 1; y < NY - 1; y++) for (let x = 1; x < NX - 1; x++) {
        const i = x + y * NX;
        // となり4つ（重み0.2）とななめ4つ（重み0.05）で、広がり方（ラプラシアン）を出す
        const la = -A[i] + 0.2 * (A[i - 1] + A[i + 1] + A[i - NX] + A[i + NX]) + 0.05 * (A[i - NX - 1] + A[i - NX + 1] + A[i + NX - 1] + A[i + NX + 1]);
        const lb = -B[i] + 0.2 * (B[i - 1] + B[i + 1] + B[i - NX] + B[i + NX]) + 0.05 * (B[i - NX - 1] + B[i - NX + 1] + B[i + NX - 1] + B[i + NX + 1]);
        const abb = A[i] * B[i] * B[i], F = Fmap[i], k = Kmap[i];
        A2[i] = A[i] + DA * la - abb + F * (1 - A[i]);
        B2[i] = B[i] + DB * lb + abb - (k + F) * B[i];
      }
      [A, A2] = [A2, A]; [B, B2] = [B2, B];
    }
  },

  draw(ctx) {
    const d = img.data;
    for (let i = 0; i < NX * NY; i++) { const c = ramp(B[i]); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
    octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, W, H);
    ZONES.forEach((z, i) => pill(ctx, W * (i + 0.5) / 3, H - 40, `${z[2]}（F=${z[0]}, k=${z[1]}）`));
    Motion.label(ctx, '模様が育つ（反応拡散）', 'F と k の2つの数だけで模様が変わる／クリックでたねを置く');
  }
});

function pill(ctx, x, y, text) {
  ctx.save(); ctx.font = '700 20px "Noto Sans CJK JP","Hiragino Sans",sans-serif';
  const w = ctx.measureText(text).width + 32;
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
  Motion.roundRect(ctx, x - w / 2, y - 18, w, 36, 18); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}
