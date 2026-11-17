// ストレンジアトラクタ：決まった式なのに、予測できない美しい軌道を描く

// ローレンツ（Lorenz, 1963）：蝶の羽の形。返り値は速度 [dx, dy, dz]
export const lorenz = ([x, y, z], s = 10, r = 28, b = 8 / 3) => [s * (y - x), x * (r - z) - y, x * y - b * z];

// アイザワ（Aizawa）：りんごの芯のような形
export function aizawa([x, y, z], a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1) {
  return [(z - b) * x - d * y, d * x + (z - b) * y, c + a * z - (z * z * z) / 3 - (x * x + y * y) * (1 + e * z) + f * z * x * x * x];
}
