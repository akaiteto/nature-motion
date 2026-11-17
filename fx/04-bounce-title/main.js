// 04 タイトルが一文字ずつ落ちて、バウンスで弾んで揃う（HTML の文字＋CSS 3D のカメラ）
// 使う関数：easeOutBounce（ペナー）、三次パルス・指数インパルス（キレス）、イージング
import { RAINBOW, run, chip, range01, lerp, css, domScene, setCamera } from '../lib/stage.js';
import { easeOutBounce, easeInOutCubic, easeOutCubic } from '../lib/easing.js';
import { cubicPulse, expImpulse } from '../lib/iq.js';

const TEXT = [...'かわいいは、作れる！'];
const SIZE = 168, STEP = 172, DROP = 1.25, GAP = 0.16, GROUND = 140;
chip('easeOutBounce<small>Robert Penner ／ 着地のつぶれ：cubicPulse（Inigo Quilez）</small>');

css(`.floor{position:absolute;left:-2400px;top:${GROUND}px;width:4800px;height:3000px;transform-origin:50% 0;transform:rotateX(90deg);
  background:radial-gradient(ellipse at 50% 0%, rgba(255,255,255,.95), rgba(255,226,240,.6) 40%, rgba(255,214,234,0) 70%),
  repeating-linear-gradient(90deg, rgba(185,166,255,.25) 0 3px, transparent 3px 172px),
  repeating-linear-gradient(0deg, rgba(185,166,255,.25) 0 3px, transparent 3px 172px)}
  .shadow{position:absolute;left:0;top:${GROUND}px;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;
  background:radial-gradient(closest-side, rgba(74,59,92,.35), rgba(74,59,92,0));transform-origin:50% 50%}`);

const world = domScene(1500);
const floor = document.createElement('div'); floor.className = 'floor'; world.appendChild(floor);
const chars = TEXT.map((c, i) => {
  const sh = document.createElement('div'); sh.className = 'shadow'; world.appendChild(sh);
  const el = document.createElement('div'); el.className = 'ch'; el.textContent = c;
  el.style.fontSize = SIZE + 'px'; el.style.color = RAINBOW[i % RAINBOW.length];
  world.appendChild(el);
  return { el, sh, x: (i - (TEXT.length - 1) / 2) * STEP, start: 0.35 + i * GAP, tilt: (i % 2 ? 1 : -1) * 18 };
});
const lastLand = chars[chars.length - 1].start + DROP;
// easeOutBounce が地面（=1）に触れる進み具合と、そのときの勢い
const CONTACTS = [[1 / 2.75, 1], [2 / 2.75, 0.5], [2.5 / 2.75, 0.25], [2.75 / 2.75, 0.12]];

function render(t) {
  for (const c of chars) {
    const u = range01(t, c.start, c.start + DROP);
    const e = easeOutBounce(u);
    const y = lerp(-1250, 0, e);
    // 地面に触れた瞬間だけ、横に広がって縦につぶれる
    let sq = 0;
    for (const [at, w] of CONTACTS) sq += w * cubicPulse(at, 0.045, u);
    const idle = t > lastLand + 0.4 ? 10 * Math.sin((t - lastLand) * 3 - c.x * 0.006) * range01(t, lastLand + 0.4, lastLand + 1.2) : 0;
    const rot = (1 - e) * c.tilt;
    c.el.style.transform =
      `translate3d(${c.x - SIZE / 2}px, ${y - SIZE + GROUND + Math.min(0, idle)}px, 0) rotate(${rot}deg) scale(${1 + 0.32 * sq}, ${1 - 0.36 * sq})`;
    const h = Math.min(1, -y / 900);
    c.sh.style.transform = `translate3d(${c.x}px, 0, 0) rotateX(90deg) scale(${lerp(1.1, 0.35, h)})`;
    c.sh.style.opacity = u > 0 ? lerp(1, 0.25, h) : 0;
  }
  // カメラ：低い位置から横に回り込み → 正面へ。最後の「！」でズームのパンチ
  const k = easeInOutCubic(range01(t, 0.2, 3.4));
  const punch = expImpulse(Math.max(0, t - lastLand), 7);
  const drift = range01(t, lastLand, lastLand + 1);
  setCamera(world, {
    zoom: lerp(420, -80, k) + 160 * punch,
    yaw: lerp(-42, 0, k) + 3 * Math.sin(t * 0.8) * drift,
    pitch: lerp(-6, -16, easeOutCubic(range01(t, 0, 3.4))),   // 負の値＝上から見下ろす
    x: lerp(520, 0, k),
    y: lerp(40, -20, k)
  });
}

run({ render, loop: 7.5, fonts: ['800 40px "M PLUS Rounded 1c"'] });
