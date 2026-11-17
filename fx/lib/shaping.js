// ゴラン・レヴィンのシェイピング関数（Golan Levin, "Pattern Master" / shaping functions）
// x も返り値も 0〜1。

// 二重指数シグモイド：ためてから一気に動き、最後にゆっくり止まる。a で急さを決める（0〜1）
export function doubleExponentialSigmoid(x, a) {
  const e = 0.00001;
  a = Math.min(1 - e, Math.max(e, a));
  a = 1 - a;
  return x <= 0.5 ? Math.pow(2 * x, 1 / a) / 2 : 1 - Math.pow(2 * (1 - x), 1 / a) / 2;
}

// 円の弧：ぷくっと丸く立ち上がる
export const circularEaseOut = x => Math.sqrt(1 - Math.pow(1 - x, 2));
