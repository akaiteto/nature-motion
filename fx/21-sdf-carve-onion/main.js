// 21 くり抜きと殻：板から「かわいい」をくり抜き（引き算）、次に文字を輪切りにして、断面に殻（オニオン）の年輪を見せる
// 距離関数の演算：引き算 max(a, -b)、共通部分 max(a, b)、殻 abs(d) - t ／ Inigo Quilez "distance functions"
import { W, H, run, chip, range01, lerp } from '../lib/stage.js';
import { THREE } from '../lib/three-stage.js';
import { sdfTexture, SDF_GLSL, fullscreenShader } from '../lib/sdf-text.js';
import { easeInOutCubic } from '../lib/easing.js';

const label = chip('');
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('stage'), preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
const scene = new THREE.Scene(), cam = new THREE.Camera();

const HW = 3.0;
const sdf = sdfTexture('かわいい');
const uniforms = {
  uText: { value: sdf.tex }, uTextSize: { value: new THREE.Vector2(sdf.aspect * HW, HW) }, uSpread: { value: sdf.spreadFrac * HW },
  uRes: { value: new THREE.Vector2(W, H) }, uMode: { value: 0 }, uCut: { value: 1 }, uSlab: { value: 1 },
  uRo: { value: new THREE.Vector3() }, uTa: { value: new THREE.Vector3() }
};
fullscreenShader(scene, uniforms, /* glsl */`
varying vec2 vUv;
uniform vec2 uRes; uniform float uMode, uCut, uSlab; uniform vec3 uRo, uTa;
${SDF_GLSL}
// 返り値：x = 距離、y = どこに当たったか（0 = 板、1 = 文字の側面、2 = 断面）
vec2 map(vec3 p) {
  float text = opExtrusion(p, sdText2(p.xy), 0.55) - 0.06;
  if (uMode < 0.5) {
    // 引き算：板から文字の形を抜く
    float slab = sdRoundBox(p, vec3(uTextSize.x * 0.5 + 0.7, uTextSize.y * 0.5 + 0.4, 0.35 * uSlab), 0.25);
    float d = max(slab, -(opExtrusion(p, sdText2(p.xy), 2.0) - 0.04));
    return vec2(d, 0.0);
  }
  // 共通部分：手前から平面で切る（切った所が断面）
  float cutPlane = p.z - uCut;
  float d = max(text, cutPlane);
  return vec2(d, cutPlane > text - 0.003 ? 2.0 : 1.0);
}
vec3 calcNormal(vec3 p) { vec2 e = vec2(0.003, 0.0); return normalize(vec3(map(p + e.xyy).x - map(p - e.xyy).x, map(p + e.yxy).x - map(p - e.yxy).x, map(p + e.yyx).x - map(p - e.yyx).x)); }
void main() {
  vec2 p = (vUv * 2.0 - 1.0) * vec2(uRes.x / uRes.y, 1.0);
  vec3 ww = normalize(uTa - uRo), uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0))), vv = cross(uu, ww);
  vec3 rd = normalize(p.x * uu + p.y * vv + 2.2 * ww);
  float t = 0.0; vec2 h = vec2(1.0, -1.0); bool hit = false;
  for (int i = 0; i < 140; i++) { h = map(uRo + rd * t); if (h.x < 0.002) { hit = true; break; } t += h.x * 0.8; if (t > 60.0) break; }
  vec3 col = mix(vec3(1.0, 0.97, 0.93), vec3(0.98, 0.9, 0.95), vUv.y);
  if (hit) {
    vec3 q = uRo + rd * t, n = calcNormal(q), L = normalize(vec3(-0.5, 0.8, 0.6));
    float dif = max(dot(n, L), 0.0), amb = 0.55 + 0.45 * n.y;
    vec3 base;
    if (h.y < 0.5) base = vec3(1.0, 0.83, 0.9);                         // 板：いちごミルク色
    else if (h.y < 1.5) base = vec3(0.29, 0.23, 0.36);                  // 文字の側面
    else {
      // 断面：文字の縁からの距離で色を変える＝殻（オニオン）を何枚も重ねた年輪
      float d2 = -sdText2(q.xy);
      float ring = floor(d2 / 0.12);
      vec3 a = vec3(1.0, 0.45, 0.65), b = vec3(1.0, 0.85, 0.35), c = vec3(0.45, 0.85, 0.8);
      base = mod(ring, 3.0) < 1.0 ? a : mod(ring, 3.0) < 2.0 ? b : c;
      base *= 0.85 + 0.15 * smoothstep(0.0, 0.01, abs(fract(d2 / 0.12) - 0.5) - 0.42);
    }
    float spec = pow(max(dot(reflect(rd, n), L), 0.0), 40.0);
    col = base * (0.72 + 0.3 * dif) * (0.85 + 0.15 * amb) + 0.25 * spec;
    col = mix(col, vec3(1.0, 0.95, 0.98), 1.0 - exp(-0.0006 * t * t));
  }
  gl_FragColor = vec4(col, 1.0);
}`);

function render(t) {
  const mode = t < 4.6 ? 0 : 1;
  uniforms.uMode.value = mode;
  uniforms.uSlab.value = lerp(0.2, 1, easeInOutCubic(range01(t, 0.2, 1.4)));
  // 断面の位置：手前（切らない）→ 奥へ動かして、輪切りの位置を変えていく
  uniforms.uCut.value = lerp(0.6, -0.45, easeInOutCubic(range01(t, 5.0, 8.6)));
  // カメラ：板の斜め前を回り込む → 輪切りでは正面やや上から
  const a = mode === 0 ? lerp(-0.7, 0.7, easeInOutCubic(range01(t, 0, 4.6))) : lerp(0.5, -0.35, easeInOutCubic(range01(t, 4.6, 9.6)));
  const d = mode === 0 ? 11.5 : 8.5;
  uniforms.uRo.value.set(Math.sin(a) * d, mode === 0 ? 2.0 : 3.2, Math.cos(a) * d);
  uniforms.uTa.value.set(0, 0, 0);
  label.innerHTML = mode === 0 ? '引き算 max(板, −文字)：板から文字の形を抜く<small>距離関数（Inigo Quilez）</small>'
    : '共通部分 max(文字, 平面) で輪切り → 断面に殻（abs(d) − t）の年輪<small>距離関数（Inigo Quilez）</small>';
  renderer.render(scene, cam);
}

run({ render, loop: 10, fonts: ['800 40px "M PLUS Rounded 1c"'] });
