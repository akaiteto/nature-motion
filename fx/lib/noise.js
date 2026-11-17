// ノイズ：なめらかなでたらめ（パーリン系の勾配ノイズ）と、そこから作る渦の流れ（カールノイズ）

const P = new Uint8Array(512);
(() => {
  const p = [...Array(256).keys()];
  let s = 7;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
})();
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => {
  const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
};

// 3次元のパーリンノイズ（およそ -1〜1）
export function perlin(x, y, z = 0) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const L = (a, b, t) => a + t * (b - a);
  return L(
    L(L(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u), L(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    L(L(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u), L(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w
  );
}

// カールノイズ（2次元）：ノイズの坂を90度回すと、渦を巻く流れになる（湧き出しも吸い込みもない）
export function curl(x, y, t) {
  const e = 0.01;
  const dx = (perlin(x + e, y, t) - perlin(x - e, y, t)) / (2 * e);
  const dy = (perlin(x, y + e, t) - perlin(x, y - e, t)) / (2 * e);
  return [dy, -dx];
}
