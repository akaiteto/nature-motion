// 距離関数（SDF）の文字：キャンバスに描いた文字から「縁までの距離」の画像を作り、シェーダーで立体にする
// 距離の計算：Felzenszwalb & Huttenlocher の距離変換（2012, "Distance Transforms of Sampled Functions"）
// 部品と演算：Inigo Quilez "distance functions"（押し出し、角丸、合体・引き算、なめらかな合体、殻）
import { THREE } from './three-stage.js';
import { FONT } from './stage.js';

// 1次元の二乗距離変換
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s;
    do { const r = v[k]; s = ((f[q] + q * q) - (f[r] + r * r)) / (2 * q - 2 * r); } while (s <= z[k] && --k >= 0);
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k]; d[q] = (q - r) * (q - r) + f[r]; }
}
function edt2d(grid, w, h) {
  const f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = d[x]; }
}

// 文字 → 距離の画像（外が正、中が負。±spread ピクセルを 0〜255 にしまう）
export function sdfTexture(text, { w = 1536, h = 384, fontPx = 300, spread = 40 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `800 ${fontPx}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(text, w / 2, h / 2 + fontPx * 0.04);
  const a = g.getImageData(0, 0, w, h).data;
  const INF = 1e20, outside = new Float64Array(w * h), inside = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) { const on = a[i * 4 + 3] > 127; outside[i] = on ? 0 : INF; inside[i] = on ? INF : 0; }
  edt2d(outside, w, h); edt2d(inside, w, h);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const d = Math.sqrt(outside[i]) - Math.sqrt(inside[i]);           // 符号つき距離（ピクセル）
    const v = Math.round(Math.max(0, Math.min(1, d / spread * 0.5 + 0.5)) * 255);
    data[i * 4] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  return { tex, aspect: w / h, spreadFrac: spread / h };
}

// シェーダーで使う距離関数の部品（GLSL）
export const SDF_GLSL = /* glsl */`
uniform sampler2D uText; uniform vec2 uTextSize; uniform float uSpread;
float sdBox2(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
// 文字の平面の距離（画像から読む。画像の外は箱の距離で補う）
float sdText2(vec2 p) {
  vec2 uv = vec2(p.x / uTextSize.x + 0.5, 0.5 - p.y / uTextSize.y);
  float d = (texture2D(uText, uv).r - 0.5) * 2.0 * uSpread;
  return max(d, sdBox2(p, uTextSize * 0.5));
}
// 押し出し：平面の距離に、厚み方向の距離を組み合わせる（Quilez の opExtrusion）
float opExtrusion(vec3 p, float d2, float h) { vec2 w = vec2(d2, abs(p.z) - h); return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)); }
// なめらかな合体（Quilez の smin、多項式版）：k が大きいほど、とろっとくっつく
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
// 殻（オニオン）：形を厚さ t の殻にする
float opOnion(float d, float t) { return abs(d) - t; }
`;

// 画面いっぱいの板に、レイマーチングのシェーダーを貼る
export function fullscreenShader(scene, uniforms, fragment) {
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: fragment, depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  return mat;
}
