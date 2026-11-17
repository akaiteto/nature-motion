// 舞台：1920×1080、1/60秒の固定刻み、録画用フック（?capture で window.__frame(n)）
export const W = 1920, H = 1080, DT = 1 / 60;

export const PAL = {
  bg: '#fff6fb', ink: '#4a3b5c', pink: '#ff8fb8', mint: '#8fe3cf', lav: '#b9a6ff',
  yellow: '#ffe27a', sky: '#9fd8ff', peach: '#ffc29f', white: '#ffffff'
};
export const RAINBOW = [PAL.pink, PAL.peach, PAL.yellow, PAL.mint, PAL.sky, PAL.lav];
export const FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "Noto Sans CJK JP", sans-serif';

// 乱数（シード付き。毎回同じ動きにする）
export function rng(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
// t が a〜b のどこにいるか（0〜1）
export const range01 = (t, a, b) => clamp((t - a) / (b - a));

// 画面いっぱいに 1920×1080 を収める
export function fitWrap(wrap) {
  const fit = () => {
    const s = Math.min(innerWidth / W, innerHeight / H);
    wrap.style.transform = `translate(-50%,-50%) scale(${s})`;
  };
  addEventListener('resize', fit); fit();
}

// 進め方：setup() → 毎コマ update(t, dt) → render(t)。loop 秒で最初に戻る（録画時は戻らない）
export async function run({ setup, update = () => {}, render, loop = 10, fonts = [] }) {
  const wrap = document.getElementById('wrap');
  fitWrap(wrap);
  const capture = new URLSearchParams(location.search).has('capture');
  try { await Promise.race([Promise.all(fonts.map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  let t = 0, frame = 0;
  const reset = () => { t = 0; frame = 0; setup && setup(); };
  const step = () => {
    update(t, DT); t += DT; frame++;
    if (!capture && loop && t >= loop) reset();
  };
  reset();
  if (capture) {
    window.__frame = n => { if (n < frame) reset(); while (frame < n) step(); render(t); return frame; };
  } else {
    let last = performance.now(), acc = 0;
    const tick = now => {
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= DT) { step(); acc -= DT; }
      render(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  window.__ready = true;
}

// 画面下の「使っている関数」の札
export function chip(html) {
  const d = document.createElement('div');
  d.className = 'chip'; d.innerHTML = html;
  document.getElementById('wrap').appendChild(d);
  return d;
}

// ページ専用の CSS を足す
export function css(text) { const s = document.createElement('style'); s.textContent = text; document.head.appendChild(s); }

// HTML の舞台：#scene（遠近）＞ #world（カメラで動かす）。文字は world の中に置く
export function domScene(perspective = 1600) {
  css(`#scene{position:absolute;inset:0;perspective:${perspective}px;perspective-origin:50% 45%;overflow:hidden}
  #world{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
  .ch{position:absolute;left:0;top:0;transform-origin:50% 100%;font-weight:800;line-height:1;white-space:pre;
      -webkit-text-stroke:16px #4a3b5c;paint-order:stroke fill;will-change:transform}`);
  const scene = document.createElement('div'); scene.id = 'scene';
  const world = document.createElement('div'); world.id = 'world';
  scene.appendChild(world);
  const wrap = document.getElementById('wrap');
  wrap.insertBefore(scene, wrap.querySelector('canvas'));
  const c = wrap.querySelector('canvas'); if (c) c.remove();
  return world;
}

// カメラ：world の変形（引き・左右の首振り・上下の首振り・横移動・縦移動）
export function setCamera(world, { zoom = 0, yaw = 0, pitch = 0, x = 0, y = 0, roll = 0 }) {
  world.style.transform = `translateZ(${zoom}px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg) translate3d(${x}px, ${y}px, 0)`;
}
