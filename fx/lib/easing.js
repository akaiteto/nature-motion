// ロバート・ペナーのイージング関数（Robert Penner's Easing Equations, 2001）
// 元の式：Robert Penner（https://robertpenner.com/easing/、BSD／MIT ライセンス。全文は ../../THIRD_PARTY_NOTICES.md）
// x は 0〜1 の進み具合。返り値も 0 で始まり 1 で終わる（途中で 1 を超えるものもある）。
// 一覧の図：https://easings.net

export const linear = x => x;

export const easeInSine = x => 1 - Math.cos((x * Math.PI) / 2);
export const easeOutSine = x => Math.sin((x * Math.PI) / 2);
export const easeInOutSine = x => -(Math.cos(Math.PI * x) - 1) / 2;

export const easeInCubic = x => x * x * x;
export const easeOutCubic = x => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const easeOutExpo = x => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));
export const easeInOutExpo = x =>
  x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;

// バック：少し行き過ぎて戻る
const c1 = 1.70158, c2 = c1 * 1.525, c3 = c1 + 1;
export const easeInBack = x => c3 * x * x * x - c1 * x * x;
export const easeOutBack = x => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
export const easeInOutBack = x =>
  x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;

// エラスティック：ゴムのように揺れて止まる
const c4 = (2 * Math.PI) / 3;
export const easeOutElastic = x =>
  x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;

// バウンス：地面で弾んで止まる
export const easeOutBounce = x => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
