// onoma.js — 擬音の小さな文字を、たくさん速く描くための道具
//   sprite()   ：文字を一度だけ画像にしておく（毎コマ文字を書くと重いので、貼るだけにする）
//   stamp()    ：その画像を、位置・大きさ・回転・透明度を変えて貼る
//   textPoints()：大きな文字の形を点の集まりにする（群が集まる先や、火の出る所に使う）
//   camera()   ：2D のカメラ（見る場所・寄り・回転）
import { W, H, FONT } from './stage.js';
import { perlin } from './noise.js';

const cache = new Map();
// 文字 → 画像。stroke は縁取りの色（なしなら null）、glow は光のにじみ
export function sprite(text, { size = 64, color = '#fff', stroke = null, sw = 0, glow = 0, glowColor = color, weight = 800 } = {}) {
  const key = [text, size, color, stroke, sw, glow, glowColor, weight].join('|');
  let c = cache.get(key);
  if (c) return c;
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${weight} ${size}px ${FONT}`;
  const pad = Math.ceil(sw + glow * 2 + 4);
  const w = Math.ceil(m.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.25) + pad * 2;
  c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (glow) { g.shadowColor = glowColor; g.shadowBlur = glow; }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = sw * 2; g.strokeText(text, w / 2, h / 2 + size * 0.06); }
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + size * 0.06);
  if (glow) { g.shadowBlur = 0; g.fillText(text, w / 2, h / 2 + size * 0.06); }
  c.base = size;
  cache.set(key, c);
  return c;
}

// 画像を貼る。(x, y) が文字の中心。sx, sy で縦横を別々に伸ばせる（つぶしと伸ばし）
export function stamp(ctx, spr, x, y, { s = 1, sx = 1, sy = 1, rot = 0, a = 1 } = {}) {
  if (a <= 0.003 || s <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(s * sx, s * sy);
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.restore();
}

// 大きな文字を、step ごとの点にする。中心が (0, 0)。edge: 上側のふち（上が空いている点）だけ
export function textPoints(text, { size = 300, step = 12, weight = 800, edge = false } = {}) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = `${weight} ${size}px ${FONT}`;
  const w = Math.ceil(m.measureText(text).width) + 20, h = Math.ceil(size * 1.3);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.font = m.font; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  const d = g.getImageData(0, 0, w, h).data;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(x + y * w) * 4 + 3] > 128;
  const pts = [];
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    if (!on(x, y)) continue;
    if (edge && on(x, y - step)) continue;
    pts.push({ x: x - w / 2, y: y - h / 2 });
  }
  pts.w = w; pts.h = h;
  return pts;
}

// 2D のカメラ。(x, y) を画面の中心に置き、zoom 倍に寄せ、rot だけ傾ける
export function camera(ctx, { x = W / 2, y = H / 2, zoom = 1, rot = 0 } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2, H / 2);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
}

// 手ぶれ：ノイズでなめらかに揺らす。amp は揺れの大きさ（ピクセル）
export function shake(t, amp, speed = 18) {
  return [amp * perlin(t * speed, 0.5), amp * perlin(0.5, t * speed + 9)];
}

// 色を混ぜる（'#rrggbb' 同士）
export function mix(c1, c2, k) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = s => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// 色の段階表から、k（0〜1）に近い段を選ぶ（スプライトを段の数だけ作っておけばよい）
export const pick = (arr, k) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(k * arr.length)))];
