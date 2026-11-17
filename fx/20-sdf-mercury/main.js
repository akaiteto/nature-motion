// 20 水銀のようにくっつく文字：銀色の玉が集まって「くっつく」の字になり、通り抜けるたびに、とろっとくっついては離れる
// 距離関数の演算：押し出し（opExtrusion）＋角丸 ＋ なめらかな合体（smin）／ Inigo Quilez "distance functions"
// レイマーチング：画面の画素ごとに光線を進め、距離が 0 になった所を表面とする
import { W, H, run, chip, range01, lerp } from '../lib/stage.js';
import { THREE } from '../lib/three-stage.js';
import { sdfTexture, SDF_GLSL, fullscreenShader } from '../lib/sdf-text.js';
import { easeInOutCubic } from '../lib/easing.js';

const label = chip('');
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
const scene = new THREE.Scene(), cam = new THREE.Camera();

const HW = 3.0;                                          // 文字の画像の高さ（世界の単位）
const sdf = sdfTexture('くっつく');
const N = 8;
const uniforms = {
  uText: { value: sdf.tex }, uTextSize: { value: new THREE.Vector2(sdf.aspect * HW, HW) }, uSpread: { value: sdf.spreadFrac * HW },
  uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 }, uMelt: { value: 1 }, uK: { value: 0.9 },
  uRo: { value: new THREE.Vector3() }, uTa: { value: new THREE.Vector3() },
  uBlob: { value: Array.from({ length: N }, () => new THREE.Vector4()) }
};
fullscreenShader(scene, uniforms, /* glsl */`
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime, uMelt, uK; uniform vec3 uRo, uTa; uniform vec4 uBlob[${N}];
${SDF_GLSL}
float map(vec3 p) {
  float d = opExtrusion(p, sdText2(p.xy), 0.3) - 0.14 + uMelt;   // 文字（uMelt を足すと細って消える）
  for (int i = 0; i < ${N}; i++) d = smin(d, length(p - uBlob[i].xyz) - uBlob[i].w, uK);   // 玉と、なめらかに合体
  return d;
}
vec3 calcNormal(vec3 p) { vec2 e = vec2(0.003, 0.0); return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx))); }
// 映り込み用の、にせの部屋（パステルの空、床、照明の縞）
vec3 env(vec3 r) {
  vec3 sky = mix(vec3(1.0, 0.86, 0.93), vec3(0.72, 0.68, 1.0), smoothstep(0.0, 0.8, r.y));
  vec3 ground = mix(vec3(0.6, 0.92, 0.86), vec3(0.28, 0.22, 0.38), smoothstep(0.0, -0.7, r.y));
  vec3 c = r.y > 0.0 ? sky : ground;
  c += 0.35 * smoothstep(0.75, 0.8, sin(atan(r.x, r.z) * 5.0)) * smoothstep(0.05, 0.3, r.y);
  c += 1.2 * smoothstep(0.94, 1.0, dot(r, normalize(vec3(-0.5, 0.7, 0.6))));
  return c;
}
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);
  vec3 ww = normalize(uTa - uRo), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(p.x * uu + p.y * vv + 2.2 * ww);
  float t = 0.0; bool hit = false;
  for (int i = 0; i < 120; i++) { float d = map(uRo + rd * t); if (d < 0.002) { hit = true; break; } t += d * 0.8; if (t > 60.0) break; }
  vec3 col = mix(vec3(1.0, 0.95, 0.98), vec3(0.92, 0.9, 1.0), vUv.y);
  if (hit) {
    vec3 q = uRo + rd * t, n = calcNormal(q), r = reflect(rd, n);
    float fre = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
    vec3 tint = 0.65 + 0.35 * cos(6.2831 * (q.x * 0.05 + vec3(0.0, 0.33, 0.67)) + uTime * 0.4);   // ほんのり虹色
    col = mix(env(r) * mix(vec3(0.8), tint, 0.45), env(r), fre);
  }
  gl_FragColor = vec4(col, 1.0);
}`);

// 玉の動き：最初は真ん中で一つの大きな玉 → 散らばって文字になる → 文字のまわりを通り抜ける → また集まる
function blobs(t) {
  const spread = easeInOutCubic(range01(t, 1.2, 3.4)) * (1 - easeInOutCubic(range01(t, 8.4, 9.6)));
  return uniforms.uBlob.value.map((b, i) => {
    const ph = i * 0.785;
    const orbitX = 6.2 * Math.sin(t * 0.55 + ph * 1.7), orbitY = 1.9 * Math.sin(t * 1.1 + ph), orbitZ = 1.2 * Math.cos(t * 0.8 + ph * 2);
    return b.set(lerp(0.35 * Math.cos(ph * 2), orbitX, spread), lerp(0.35 * Math.sin(ph * 2), orbitY, spread), lerp(0, orbitZ, spread), lerp(0.85, 0.5, spread));
  });
}

function render(t) {
  uniforms.uTime.value = t;
  blobs(t);
  uniforms.uMelt.value = lerp(1.3, 0, easeInOutCubic(range01(t, 1.6, 3.6))) + lerp(0, 1.3, easeInOutCubic(range01(t, 8.2, 9.6)));
  // カメラ：正面からゆっくり斜めへ
  const a = 0.45 * Math.sin(t * 0.35), d = lerp(8.5, 11.5, easeInOutCubic(range01(t, 0, 3.5)));
  uniforms.uRo.value.set(Math.sin(a) * d, 1.4 + 0.6 * Math.sin(t * 0.3), Math.cos(a) * d);
  uniforms.uTa.value.set(0, 0, 0);
  label.innerHTML = 'なめらかな合体 smin(a, b, k)：近づくと、とろっとくっつく<small>距離関数（Inigo Quilez）／ k = 0.9</small>';
  renderer.render(scene, cam);
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
