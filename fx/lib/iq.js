// イニゴ・キレスの小さな関数（Inigo Quilez, "Useful little functions"）
// https://iquilezles.org/articles/functions/

// 指数インパルス：一瞬ぴょんと立ち上がり、すっと戻る。x=1/k で最大値 1
export const expImpulse = (x, k) => { const h = k * x; return h * Math.exp(1 - h); };

// 三次パルス：c を中心に、幅 w の山を一つだけ作る
export const cubicPulse = (c, w, x) => {
  x = Math.abs(x - c);
  if (x > w) return 0;
  x /= w;
  return 1 - x * x * (3 - 2 * x);
};

// 放物線：0 と 1 で 0、0.5 で 1。k で山の形を変える
export const parabola = (x, k) => Math.pow(4 * x * (1 - x), k);

// なめらかな段差（smoothstep）
export const smoothstep = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

// ゲイン：真ん中を境に、ためる／はじける
export const gain = (x, k) => { const a = 0.5 * Math.pow(2 * (x < 0.5 ? x : 1 - x), k); return x < 0.5 ? a : 1 - a; };
