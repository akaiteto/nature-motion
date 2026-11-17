// 16 CSS だけの立体文字：同じ文字を何十枚も少しずつ奥にずらして重ねると、厚みのある立体に見える
// 定番の作り方：transform-style: preserve-3d の箱に、translateZ をずらした文字を重ねる（three.js なし）
// 使う関数：easeInOutBack・easeInOutCubic（ペナー）、expImpulse（キレス）
import { run, chip, range01, lerp, css, domScene, setCamera, VIVID } from '../lib/stage.js';
import { easeInOutBack, easeInOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';

const TEXT = [...'かわいいは、作れる！'];
const LAYERS = 28, GAP = 2.4, SIZE = 170, STEP = 172;
chip(`CSS だけ：同じ文字を ${LAYERS} 枚、${GAP}px ずつ奥へ重ねる<small>transform-style: preserve-3d</small>`);
css(`.stack{position:absolute;left:0;top:0;transform-style:preserve-3d}
  .layer{position:absolute;left:0;top:0;font-weight:800;line-height:1;font-size:${SIZE}px;white-space:pre}`);

const world = domScene(1300);
// 色を少しずつ暗くしながら重ねる（いちばん手前は白い縁取り）
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = c => Math.round(c * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };
const stacks = TEXT.map((c, i) => {
  const st = document.createElement('div'); st.className = 'stack';
  for (let l = LAYERS - 1; l >= 0; l--) {
    const d = document.createElement('div'); d.className = 'layer'; d.textContent = c;
    d.style.color = l === 0 ? VIVID[i % VIVID.length] : shade(VIVID[i % VIVID.length], lerp(0.85, 0.45, l / LAYERS));
    d.style.transform = `translateZ(${-l * GAP}px)`;
    if (l === 0) d.style.webkitTextStroke = '6px #fff', d.style.paintOrder = 'stroke fill';
    st.appendChild(d);
  }
  world.appendChild(st);
  return { st, i, x: (i - (TEXT.length - 1) / 2) * STEP };
});

function render(t) {
  for (const s of stacks) {
    // 一文字ずつ、時間差で縦に一回転 → 前へ飛び出してから戻る
    const spin = easeInOutBack(range01(t, 1.2 + s.i * 0.1, 2.4 + s.i * 0.1)) * 360;
    const pop = expImpulse(Math.max(0, t - 4.2 - s.i * 0.08), 8);
    s.st.style.transform = `translate3d(${s.x - SIZE / 2}px, ${-SIZE / 2 - 60 * pop}px, ${120 * pop}px) rotateY(${spin}deg) rotateX(${12 * pop}deg)`;
  }
  // カメラ：ななめ下から見上げ → 左右にゆっくり首を振って、重なりの厚みを見せる
  const k = easeInOutCubic(range01(t, 0, 2));
  setCamera(world, { zoom: lerp(300, -150, k), yaw: lerp(-38, 0, k) + 28 * Math.sin(t * 0.55) * range01(t, 2, 3), pitch: lerp(18, 8, k) + 6 * Math.sin(t * 0.4), roll: lerp(-6, 0, k) });
}

run({ render, loop: 9, fonts: ['800 40px "M PLUS Rounded 1c"'] });
