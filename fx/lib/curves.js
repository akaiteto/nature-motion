// 名前のついた曲線（MacTutor "Famous Curves" ほか）。θ から [x, y] を返す（y は上が正）

// バラ曲線：r = cos(kθ)。k が奇数なら花びら k 枚
export const rose = (th, k, a = 1) => { const r = a * Math.cos(k * th); return [r * Math.cos(th), r * Math.sin(th)]; };

// カージオイド（心臓形）
export const cardioid = (th, a = 1) => { const r = a * (1 - Math.cos(th)); return [r * Math.cos(th), r * Math.sin(th)]; };

// ハートの曲線（よく使われるパラメータ表示）。大きさはおよそ ±1
export const heart = th => [
  (16 * Math.pow(Math.sin(th), 3)) / 17,
  (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th)) / 17
];

// リサージュ曲線
export const lissajous = (t, a, b, delta) => [Math.sin(a * t + delta), Math.sin(b * t)];

// スーパーフォーミュラ（Johan Gielis, 2003）：一つの式で星・花・多角形
export function superformula(th, m, n1, n2, n3, a = 1, b = 1) {
  const t1 = Math.pow(Math.abs(Math.cos((m * th) / 4) / a), n2);
  const t2 = Math.pow(Math.abs(Math.sin((m * th) / 4) / b), n3);
  return Math.pow(t1 + t2, -1 / n1);
}
