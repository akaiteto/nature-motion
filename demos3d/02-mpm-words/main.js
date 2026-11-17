// 文字が素材になる（MLS-MPM / WebGPU）
// 文字の形の中に粒子を敷き詰め、MLS-MPM（Hu et al., SIGGRAPH 2018）で素材ごとに動かす。
//   プリン：ネオフック弾性体（ぷるぷる）
//   みず　：弱圧縮性の流体（体積変化 J だけで圧力を決める）
//   アイス：最初は硬い弾性体。上から順に「せん断の硬さ」を 0 にしていき、液体になる（溶ける）
// 1 フレームを 24 小ステップに分け、各小ステップで 格子クリア → 粒子→格子（P2G）→ 格子更新 → 格子→粒子（G2P）。
// P2G は複数の粒子が同じ格子点に足し込むので、固定小数点の atomicAdd を使う（matsuoka-601/WebGPU-Ocean と同じ方式）。
// 参考：Hu et al. 2018 "A Moving Least Squares Material Point Method..."、nialltl "MPM guide"、
//       Yuanming Hu "mls-mpm88"、matsuoka-601 "WebGPU-Ocean"（MIT）

const W = 1280, H = 720;
const NX = 144, NY = 48, NZ = 17;   // 奥行きは薄い水槽：文字が前後に倒れず、読めるまま動く            // 格子（1 マス = 1 単位）
const NCELL = NX * NY * NZ;
const SUB = 40, DT = 1 / 60 / SUB;
const SCALE = 1 / 16;                          // 格子単位 → 画面の世界座標
const CHAR_H = 12;                             // 1 文字の高さ（マス）
const LOOP = 14;                               // 何秒で最初からやり直すか

const WORDS = [
  { text: 'プリン', mat: 0, base: true, cx: 25, release: 0.4, cap: 'プリン：ぷるぷる（弾性体）' },
  { text: 'みず', mat: 1, cx: 72, release: 1.2, cap: 'みず：流れる（流体）' },
  { text: 'アイス', mat: 2, base: true, cx: 119, release: 2.0, cap: 'アイス：とける（固体→液体）' }
];

const msg = document.getElementById('msg');
const dbg = document.createElement('div');
dbg.style.cssText = 'position:absolute;right:10px;top:10px;font:12px monospace;color:#4a3b5c;background:rgba(255,255,255,.8);padding:4px 8px;display:none;white-space:pre;max-width:700px;z-index:9';
document.getElementById('wrap').appendChild(dbg);
const logEl = document.createElement('div'); dbg.appendChild(logEl);
addEventListener('error', e => dlog('error: ' + e.message));
addEventListener('unhandledrejection', e => dlog('rejection: ' + (e.reason && e.reason.message || e.reason)));
const dlog = t => { if (!/^particles/.test(t)) dbg.style.display = 'block'; logEl.textContent += t + '\n'; console.log('[mpm]', t); };
const wrap = document.getElementById('wrap');
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); wrap.style.transform = `translate(-50%,-50%) scale(${s})`; }
addEventListener('resize', fit); fit();

if (!navigator.gpu) { msg.textContent = 'このブラウザは WebGPU に対応していません（Chrome / Edge の最新版で開いてください）'; throw new Error('no webgpu'); }
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) { msg.textContent = 'WebGPU のアダプタが取得できませんでした'; throw new Error('no adapter'); }
const device = await adapter.requestDevice();
device.addEventListener?.('uncapturederror', e => dlog('GPU error: ' + e.error.message.slice(0, 300)));
const canvas = document.getElementById('stage');
const ctxGPU = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();
ctxGPU.configure({ device, format, alphaMode: 'opaque' });

// ---------- 文字 → 粒子 ----------
try { await Promise.race([document.fonts.load('800 100px "M PLUS Rounded 1c"', 'プリンみずアイス'), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
const FONT = '800 200px "M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", "Yu Gothic", "Meiryo", sans-serif';

let rs = 12345;
const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };

function sampleWord(w) {
  const fs = 200;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = FONT;
  const tw = Math.ceil(g.measureText(w.text).width) + 60;
  c.width = tw; c.height = Math.ceil(fs * 1.4);
  g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
  g.fillText(w.text, tw / 2, c.height / 2);
  g.lineWidth = 12; g.lineJoin = 'round'; g.strokeStyle = '#000'; g.strokeText(w.text, tw / 2, c.height / 2);   // 画を太らせて、細い画が自重で曲がらないように
  // ぼかした版：文字の中心ほど厚く（ふっくらした立体にする）
  const b = document.createElement('canvas'); b.width = c.width; b.height = c.height;
  const bg = b.getContext('2d'); bg.filter = 'blur(16px)'; bg.drawImage(c, 0, 0);
  const A = g.getImageData(0, 0, c.width, c.height).data, B = bg.getImageData(0, 0, c.width, c.height).data;
  const cpp = CHAR_H / (fs * 0.88);          // 1 ピクセル = 何マス
  const step = 0.5 / cpp;                     // 粒子の間隔 0.5 マス
  const pts = [];
  for (let py = 0; py < c.height; py += step) for (let px = 0; px < c.width; px += step) {
    const k = (Math.floor(py) * c.width + Math.floor(px)) * 4 + 3;
    if (A[k] < 128) continue;
    const half = 4.2 * Math.min(1, Math.max(0.45, B[k] / 255 * 1.5));
    for (let z = -half; z <= half; z += 0.5) {
      pts.push([(px - c.width / 2) * cpp + (rnd() - 0.5) * 0.25, (c.height / 2 - py) * cpp + (rnd() - 0.5) * 0.25, z + (rnd() - 0.5) * 0.25]);
    }
  }
  let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }
  // 弾性体の言葉は、下に同じ素材の台をつける（細い画が倒れず、ぷるぷるが全体に伝わる）
  if (w.base) {
    for (let x = minX - 1; x <= maxX + 1; x += 0.5) for (let y = minY - 3; y < minY + 0.6; y += 0.5) for (let z = -4.2; z <= 4.2; z += 0.5)
      pts.push([x + (rnd() - 0.5) * 0.25, y + (rnd() - 0.5) * 0.25, z + (rnd() - 0.5) * 0.25]);
    minY -= 3;
  }
  return pts.map(p => ({ x: w.cx + p[0], y: 9 + (p[1] - minY), z: NZ / 2 + p[2], tag: (p[1] - minY) / (maxY - minY), mat: w.mat }));
}
const all = WORDS.flatMap(sampleWord);
const N = all.length;
dlog('particles ' + N);

// 粒子 1 個 = 128 バイト：x(3) mat | v(3) tag | C(3x3, 列ごとに 16 バイト) | F(3x3)
const init = new ArrayBuffer(N * 128);
{
  const f = new Float32Array(init), u = new Uint32Array(init);
  all.forEach((p, i) => {
    const o = i * 32;
    f[o] = p.x; f[o + 1] = p.y; f[o + 2] = p.z; u[o + 3] = p.mat;
    f[o + 7] = p.tag;
    f[o + 20] = 1; f[o + 25] = 1; f[o + 30] = 1;
  });
}

// ---------- GPU バッファ ----------
const partBuf = device.createBuffer({ size: N * 128, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
const gridBuf = device.createBuffer({ size: NCELL * 16, usage: GPUBufferUsage.STORAGE });
const gridV = device.createBuffer({ size: NCELL * 16, usage: GPUBufferUsage.STORAGE });
const paramBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
const camBuf = device.createBuffer({ size: 128, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
function reset() { device.queue.writeBuffer(partBuf, 0, init); time = 0; }

const COMMON = /* wgsl */`
struct Particle { x: vec3f, mat: u32, v: vec3f, tag: f32, C: mat3x3f, F: mat3x3f };
struct Params { dims: vec4u, dt: f32, g: f32, time: f32, pad: f32, release: vec4f, melt: vec4f };
fn hash(i: u32) -> f32 {
  var x = i * 747796405u + 2891336453u;
  x = ((x >> ((x >> 28u) + 4u)) ^ x) * 277803737u;
  x = (x >> 22u) ^ x;
  return f32(x) / 4294967295.0;
}
// アイスの「固さ」1 → 0。上の方から溶ける
fn meltFactor(p: Particle, idx: u32, pr: Params) -> f32 {
  if (p.mat != 2u) { return 1.0; }
  let t0 = pr.melt.x + (1.0 - p.tag) * pr.melt.z + hash(idx) * 0.5;
  return 1.0 - clamp((pr.time - t0) / pr.melt.y, 0.0, 1.0);
}
`;

const SIM = COMMON + /* wgsl */`
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read_write> parts: array<Particle>;
@group(0) @binding(2) var<storage, read_write> grid: array<atomic<i32>>;
@group(0) @binding(3) var<storage, read_write> gridv: array<vec4f>;

const FIX = 10000.0;
const MASS = 1.0;
const VOL = 0.125;
const MU_JELLY = 380000.0; const LA_JELLY = 450000.0;
const MU_ICE = 800000.0;   const LA_ICE = 800000.0;
const K_WATER = 40000.0;
const I3 = mat3x3f(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);

fn cellIndex(c: vec3i) -> u32 { return (u32(c.z) * P.dims.y + u32(c.y)) * P.dims.x + u32(c.x); }
fn weights(fx: vec3f) -> array<vec3f, 3> {
  return array<vec3f, 3>(0.5 * (1.5 - fx) * (1.5 - fx), 0.75 - (fx - 1.0) * (fx - 1.0), 0.5 * (fx - 0.5) * (fx - 0.5));
}
fn released(p: Particle) -> bool { return P.time >= P.release[p.mat]; }

// キルヒホッフ応力 τ = P Fᵀ
fn kirchhoff(p: Particle, idx: u32) -> mat3x3f {
  let J = max(determinant(p.F), 0.05);
  if (p.mat == 1u) { return I3 * (K_WATER * min(J - 1.0, 0.01)); }
  var mu = MU_JELLY; var la = LA_JELLY;
  if (p.mat == 2u) {
    let m = meltFactor(p, idx, P);
    mu = MU_ICE * m * m;
    la = mix(K_WATER, LA_ICE, m);
  }
  return mu * (p.F * transpose(p.F) - I3) + I3 * (la * log(J));
}

@compute @workgroup_size(64) fn clearGrid(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.dims.x * P.dims.y * P.dims.z) { return; }
  atomicStore(&grid[i * 4u], 0); atomicStore(&grid[i * 4u + 1u], 0);
  atomicStore(&grid[i * 4u + 2u], 0); atomicStore(&grid[i * 4u + 3u], 0);
}

@compute @workgroup_size(64) fn p2g(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.dims.w) { return; }
  let p = parts[i];
  if (!released(p)) { return; }
  let base = floor(p.x - 0.5);
  let fx = p.x - base;
  var w = weights(fx);
  let affine = (-P.dt * VOL * 4.0) * kirchhoff(p, i) + MASS * p.C;
  let ib = vec3i(base);
  for (var a = 0; a < 3; a++) { for (var b = 0; b < 3; b++) { for (var c = 0; c < 3; c++) {
    let dpos = vec3f(f32(a), f32(b), f32(c)) - fx;
    let wt = w[a].x * w[b].y * w[c].z;
    let mom = wt * (MASS * p.v + affine * dpos);
    let ci = cellIndex(ib + vec3i(a, b, c)) * 4u;
    atomicAdd(&grid[ci], i32(round(mom.x * FIX)));
    atomicAdd(&grid[ci + 1u], i32(round(mom.y * FIX)));
    atomicAdd(&grid[ci + 2u], i32(round(mom.z * FIX)));
    atomicAdd(&grid[ci + 3u], i32(round(wt * MASS * FIX)));
  } } }
}

@compute @workgroup_size(64) fn updateGrid(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.dims.x * P.dims.y * P.dims.z) { return; }
  let m = f32(atomicLoad(&grid[i * 4u + 3u])) / FIX;
  var v = vec3f(0.0);
  if (m > 1e-5) {
    v = vec3f(f32(atomicLoad(&grid[i * 4u])), f32(atomicLoad(&grid[i * 4u + 1u])), f32(atomicLoad(&grid[i * 4u + 2u]))) / FIX / m;
    v.y -= P.g * P.dt;
    let x = i % P.dims.x; let y = (i / P.dims.x) % P.dims.y; let z = i / (P.dims.x * P.dims.y);
    let B = 3u;
    if (x < B && v.x < 0.0) { v.x = 0.0; }
    if (x > P.dims.x - B && v.x > 0.0) { v.x = 0.0; }
    if (z < B && v.z < 0.0) { v.z = 0.0; }
    if (z > P.dims.z - B && v.z > 0.0) { v.z = 0.0; }
    if (y > P.dims.y - B && v.y > 0.0) { v.y = 0.0; }
    if (y < B && v.y < 0.0) { v.y = 0.0; v.x *= 0.97; v.z *= 0.97; }
  }
  gridv[i] = vec4f(v, m);
}

@compute @workgroup_size(64) fn g2p(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x; if (i >= P.dims.w) { return; }
  var p = parts[i];
  if (!released(p)) { return; }
  let base = floor(p.x - 0.5);
  let fx = p.x - base;
  var w = weights(fx);
  let ib = vec3i(base);
  var v = vec3f(0.0);
  var Bm = mat3x3f(vec3f(0.0), vec3f(0.0), vec3f(0.0));
  for (var a = 0; a < 3; a++) { for (var b = 0; b < 3; b++) { for (var c = 0; c < 3; c++) {
    let dpos = vec3f(f32(a), f32(b), f32(c)) - fx;
    let wt = w[a].x * w[b].y * w[c].z;
    let gv = gridv[cellIndex(ib + vec3i(a, b, c))].xyz;
    v += wt * gv;
    Bm += (4.0 * wt) * mat3x3f(gv * dpos.x, gv * dpos.y, gv * dpos.z);
  } } }
  p.v = v;
  p.C = Bm;
  p.x = clamp(p.x + P.dt * v, vec3f(2.0), vec3f(f32(P.dims.x), f32(P.dims.y), f32(P.dims.z)) - 3.0);
  var F = (I3 + P.dt * Bm) * p.F;
  // 流体（と溶けきったアイス）は形の記憶を捨てて、体積の変化だけ残す
  if (p.mat == 1u || (p.mat == 2u && meltFactor(p, i, P) < 0.03)) {
    let J = clamp(determinant(F), 0.3, 1.5);
    F = I3 * pow(J, 1.0 / 3.0);
  }
  p.F = F;
  parts[i] = p;
}
`;

const RENDER = COMMON + /* wgsl */`
struct Cam { vp: mat4x4f, right: vec4f, up: vec4f, fwd: vec4f, info: vec4f };
@group(0) @binding(0) var<uniform> cam: Cam;
@group(0) @binding(1) var<storage, read> parts: array<Particle>;
@group(0) @binding(2) var<uniform> P: Params;

fn toWorld(x: vec3f) -> vec3f { return (x - vec3f(f32(P.dims.x) * 0.5, 0.0, f32(P.dims.z) * 0.5)) * cam.info.y; }

struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) center: vec3f, @location(2) col: vec3f, @location(3) gloss: f32 };
struct FO { @location(0) color: vec4f, @builtin(frag_depth) depth: f32 };

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var corners = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0));
  let c = corners[vi];
  let p = parts[ii];
  let center = toWorld(p.x);
  let wp = center + (cam.right.xyz * c.x + cam.up.xyz * c.y) * cam.info.x;
  var o: VO;
  o.pos = cam.vp * vec4f(wp, 1.0);
  o.uv = c; o.center = center;
  let jit = hash(ii) * 0.08;
  if (p.mat == 0u) {
    // プリン：上のほうはカラメル
    let k = smoothstep(0.7, 0.82, p.tag);
    o.col = mix(vec3f(1.0, 0.83, 0.38), vec3f(0.6, 0.3, 0.11), k) * (0.96 + jit);
    o.gloss = 0.9;
  } else if (p.mat == 1u) {
    let s = clamp(length(p.v) / 60.0, 0.0, 1.0);
    o.col = mix(vec3f(0.36, 0.72, 1.0), vec3f(0.85, 0.95, 1.0), s) * (0.96 + jit);
    o.gloss = 1.0;
  } else {
    // アイス：いちご味。溶けるほど色が濃く、つやが出る
    let m = meltFactor(p, ii, P);
    o.col = mix(vec3f(1.0, 0.5, 0.66), vec3f(1.0, 0.8, 0.86), m) * (0.96 + jit);
    o.gloss = mix(1.0, 0.25, m);
  }
  return o;
}

@fragment fn fs(i: VO) -> FO {
  let r2 = dot(i.uv, i.uv);
  if (r2 > 1.0) { discard; }
  let n = normalize(cam.right.xyz * i.uv.x + cam.up.xyz * i.uv.y + cam.fwd.xyz * sqrt(1.0 - r2));
  let wp = i.center + n * cam.info.x;
  let clip = cam.vp * vec4f(wp, 1.0);
  let L = normalize(vec3f(-0.45, 0.9, 0.55));
  let diff = max(dot(n, L), 0.0);
  let hv = normalize(L + cam.fwd.xyz);
  let spec = pow(max(dot(n, hv), 0.0), 48.0) * i.gloss;
  let low = clamp(wp.y * 1.2, 0.0, 1.0);                 // 床に近いところを少し暗く（簡易な陰）
  let col = i.col * (0.5 + 0.55 * diff) * (0.82 + 0.18 * low) + vec3f(spec * 0.7);
  var o: FO;
  o.color = vec4f(col, 1.0);
  o.depth = clip.z / clip.w;
  return o;
}

// 床と奥の壁
@vertex fn vsRoom(@builtin(vertex_index) vi: u32) -> VO {
  var q = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0));
  let t = q[vi % 6u];
  let d = vec3f(f32(P.dims.x), f32(P.dims.y), f32(P.dims.z));
  var gp: vec3f;
  var o: VO;
  if (vi < 6u) { gp = vec3f(mix(2.5, d.x - 2.5, t.x), 2.6, mix(2.5, d.z + 14.0, t.y)); o.gloss = 0.0; }
  else { gp = vec3f(mix(-40.0, d.x + 40.0, t.x), mix(2.6, d.y + 30.0, t.y), 2.5); o.gloss = 1.0; }
  let wp = toWorld(gp);
  o.pos = cam.vp * vec4f(wp, 1.0);
  o.uv = t; o.center = gp; o.col = vec3f(0.0);
  return o;
}
@fragment fn fsRoom(i: VO) -> @location(0) vec4f {
  if (i.gloss < 0.5) {
    // 床：やわらかい市松
    let c = floor(i.center.x / 8.0) + floor(i.center.z / 8.0);
    let chk = select(0.0, 1.0, fract(c * 0.5) > 0.25);
    var col = mix(vec3f(0.97, 0.84, 0.9), vec3f(0.94, 0.8, 0.87), chk);
    let edge = min(min(i.uv.x, 1.0 - i.uv.x) * 10.0, 1.0);
    col *= 0.9 + 0.1 * edge;
    return vec4f(col, 1.0);
  }
  let h = clamp((i.center.y - 2.6) / 80.0, 0.0, 1.0);
  return vec4f(mix(vec3f(0.99, 0.9, 0.94), vec3f(0.93, 0.9, 1.0), h), 1.0);
}
`;

// ---------- パイプライン ----------
const simModule = device.createShaderModule({ code: SIM });
const renModule = device.createShaderModule({ code: RENDER });
for (const [name, m] of [['sim', simModule], ['render', renModule]]) {
  m.getCompilationInfo().then(info => { for (const e of info.messages) dlog(`${name} ${e.type} L${e.lineNum}: ${e.message}`); });
}
const simLayout = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
  { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
  { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
  { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
] });
const simPL = device.createPipelineLayout({ bindGroupLayouts: [simLayout] });
const mk = entryPoint => device.createComputePipeline({ layout: simPL, compute: { module: simModule, entryPoint } });
const pClear = mk('clearGrid'), pP2G = mk('p2g'), pGrid = mk('updateGrid'), pG2P = mk('g2p');
const simBG = device.createBindGroup({ layout: simLayout, entries: [
  { binding: 0, resource: { buffer: paramBuf } }, { binding: 1, resource: { buffer: partBuf } },
  { binding: 2, resource: { buffer: gridBuf } }, { binding: 3, resource: { buffer: gridV } }
] });

const renLayout = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
  { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
  { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }
] });
const renPL = device.createPipelineLayout({ bindGroupLayouts: [renLayout] });
const MSAA = 4;
const depthState = { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' };
const pParticles = device.createRenderPipeline({
  layout: renPL, vertex: { module: renModule, entryPoint: 'vs' },
  fragment: { module: renModule, entryPoint: 'fs', targets: [{ format }] },
  primitive: { topology: 'triangle-list' }, depthStencil: depthState, multisample: { count: MSAA }
});
const pRoom = device.createRenderPipeline({
  layout: renPL, vertex: { module: renModule, entryPoint: 'vsRoom' },
  fragment: { module: renModule, entryPoint: 'fsRoom', targets: [{ format }] },
  primitive: { topology: 'triangle-list' }, depthStencil: depthState, multisample: { count: MSAA }
});
const renBG = device.createBindGroup({ layout: renLayout, entries: [
  { binding: 0, resource: { buffer: camBuf } }, { binding: 1, resource: { buffer: partBuf } }, { binding: 2, resource: { buffer: paramBuf } }
] });
const msaaTex = device.createTexture({ size: [W, H], sampleCount: MSAA, format, usage: GPUTextureUsage.RENDER_ATTACHMENT });
const depthTex = device.createTexture({ size: [W, H], sampleCount: MSAA, format: 'depth24plus', usage: GPUTextureUsage.RENDER_ATTACHMENT });

// ---------- カメラ ----------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const eye = [0, 2.3, 8.6], target = [0, 1.25, 0];
const fwd = norm(sub(eye, target)), right = norm(cross([0, 1, 0], fwd)), up = cross(fwd, right);
const view = [right[0], up[0], fwd[0], 0, right[1], up[1], fwd[1], 0, right[2], up[2], fwd[2], 0, -dot3(right, eye), -dot3(up, eye), -dot3(fwd, eye), 1];
const fov = 36 * Math.PI / 180, near = 0.1, far = 60, f = 1 / Math.tan(fov / 2);
const proj = [f / (W / H), 0, 0, 0, 0, f, 0, 0, 0, 0, far / (near - far), -1, 0, 0, near * far / (near - far), 0];
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const vp = mul(proj, view);
device.queue.writeBuffer(camBuf, 0, new Float32Array([...vp, ...right, 0, ...up, 0, ...fwd, 0, 0.5 * 0.62 * SCALE * 1.45, SCALE, 0, 0]));
function project(gx, gy, gz) {
  const p = [(gx - NX / 2) * SCALE, gy * SCALE, (gz - NZ / 2) * SCALE, 1];
  const c = [0, 1, 2, 3].map(r => vp[r] * p[0] + vp[4 + r] * p[1] + vp[8 + r] * p[2] + vp[12 + r]);
  return [(c[0] / c[3] + 1) / 2 * W, (1 - c[1] / c[3]) / 2 * H];
}
for (const w of WORDS) {
  const d = document.createElement('div'); d.className = 'cap'; d.textContent = w.cap;
  const [sx, sy] = project(w.cx, 2.6, NZ + 6); d.style.left = sx + 'px'; d.style.top = (sy + 8) + 'px';
  wrap.appendChild(d);
}

// ---------- 実行 ----------
let time = 0, frames = 0;
const tline = document.createElement('div'); dbg.appendChild(tline);
const params = new ArrayBuffer(64), pu = new Uint32Array(params), pf = new Float32Array(params);
pu.set([NX, NY, NZ, N], 0);
pf[4] = DT; pf[5] = 220;                       // 重力（マス/秒²）
pf.set([WORDS[0].release, WORDS[1].release, WORDS[2].release, 0], 8);
pf.set([4.6, 1.6, 2.2, 0], 12);                // とけ始め・とける時間・上下の時間差
reset();

const pg = Math.ceil(N / 64), cg = Math.ceil(NCELL / 64);
function frame() {
  pf[6] = time;
  device.queue.writeBuffer(paramBuf, 0, params);
  const enc = device.createCommandEncoder();
  const cp = enc.beginComputePass();
  cp.setBindGroup(0, simBG);
  for (let s = 0; s < SUB; s++) {
    cp.setPipeline(pClear); cp.dispatchWorkgroups(cg);
    cp.setPipeline(pP2G); cp.dispatchWorkgroups(pg);
    cp.setPipeline(pGrid); cp.dispatchWorkgroups(cg);
    cp.setPipeline(pG2P); cp.dispatchWorkgroups(pg);
  }
  cp.end();
  const rp = enc.beginRenderPass({
    colorAttachments: [{ view: msaaTex.createView(), resolveTarget: ctxGPU.getCurrentTexture().createView(), clearValue: { r: 0.99, g: 0.9, b: 0.94, a: 1 }, loadOp: 'clear', storeOp: 'discard' }],
    depthStencilAttachment: { view: depthTex.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' }
  });
  rp.setBindGroup(0, renBG);
  rp.setPipeline(pRoom); rp.draw(12);
  rp.setPipeline(pParticles); rp.draw(6, N);
  rp.end();
  device.queue.submit([enc.finish()]);
  if (frames === 0) device.queue.onSubmittedWorkDone().then(() => msg.remove());
  time += 1 / 60;
  if ((++frames) % 30 === 0) (tline.textContent = 't=' + time.toFixed(1) + ' frames=' + frames);
  if (time > LOOP) reset();
}
canvas.addEventListener('pointerdown', reset);
msg.textContent = 'シミュレーションを準備中…（初回は数秒かかります）'; msg.style.color = '#4a3b5c';
let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(0.05, (now - last) / 1000); last = now;
  requestAnimationFrame(loop);
  try { if (acc >= 1 / 60) { frame(); acc -= 1 / 60; if (acc > 1 / 60) acc = 0; } }
  catch (e) { if (!loop.err) { loop.err = 1; dlog('frame error: ' + e.message); } }
}
requestAnimationFrame(loop);
window.__ready = true;
