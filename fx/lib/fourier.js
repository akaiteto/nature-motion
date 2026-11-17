// フーリエ級数（エピサイクル）：閉じた線を「回る円の足し算」で描く
// 点の列 z_n（複素数）を離散フーリエ変換して、周波数 k の円（半径 |c_k|、初期角 arg c_k）に分ける。
// 時刻 θ（0〜2π）の位置は  Σ c_k · e^{i k θ}。

export function dft(points) {
  const N = points.length, out = [];
  const K = Math.floor(N / 2);
  for (let k = -K; k < K; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const a = (-2 * Math.PI * k * n) / N;
      const [x, y] = points[n];
      re += x * Math.cos(a) - y * Math.sin(a);
      im += x * Math.sin(a) + y * Math.cos(a);
    }
    re /= N; im /= N;
    out.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  // 大きい円から順に並べる（k=0 の中心は必ず先頭）
  return out.sort((a, b) => (a.k === 0 ? -1 : b.k === 0 ? 1 : b.amp - a.amp));
}

// 先頭から count 個（小数なら最後の円を途中まで）の円を足した、時刻 θ の位置と、各円の中心
export function epicycles(coefs, theta, count) {
  let x = 0, y = 0;
  const centers = [];
  const n = Math.min(coefs.length, Math.ceil(count));
  for (let i = 0; i < n; i++) {
    const c = coefs[i];
    const w = i < Math.floor(count) ? 1 : count - Math.floor(count);
    centers.push([x, y, c.amp * w]);
    const a = c.k * theta + c.phase;
    x += c.amp * w * Math.cos(a);
    y += c.amp * w * Math.sin(a);
  }
  return { x, y, centers };
}

// 閉じた線を、長さが等間隔の N 点に並べ直す
export function resample(poly, N) {
  const segs = [], pts = poly.concat([poly[0]]);
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push(l); total += l;
  }
  const out = [];
  let i = 0, acc = 0;
  for (let n = 0; n < N; n++) {
    const d = (n / N) * total;
    while (i < segs.length - 1 && acc + segs[i] < d) { acc += segs[i]; i++; }
    const u = segs[i] ? (d - acc) / segs[i] : 0;
    out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]);
  }
  return out;
}
