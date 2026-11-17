// 07 「ぷるん」が一文字ずつ、ゴムのように揺れながら現れ、そのあとも何度もぷるぷる跳ねる
// 使う関数：easeOutElastic・easeOutExpo（ペナー）、expImpulse（キレス）、つぶしと伸ばし
import { PAL, run, chip, range01, lerp, css, domScene, setCamera } from '../lib/stage.js';
import { easeOutElastic, easeOutExpo, easeInOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';

const TEXT = [...'ぷるん'], COLORS = [PAL.pink, PAL.yellow, PAL.mint];
const SIZE = 330, STEP = 360;
chip('easeOutElastic：行き過ぎて、ゴムのように揺れて止まる<small>Robert Penner ／ 跳ね：expImpulse（Inigo Quilez）</small>');
css(`.burst{position:absolute;left:-3000px;top:-3000px;width:6000px;height:6000px;border-radius:50%;
  background:repeating-conic-gradient(from 0deg, rgba(255,226,122,.28) 0deg 10deg, rgba(255,255,255,0) 10deg 20deg)}
  .ring{position:absolute;left:0;top:0;width:200px;height:200px;margin:-100px;border-radius:50%;border:14px solid ${PAL.lav}}
  .ch.big{-webkit-text-stroke:24px ${PAL.ink};filter:drop-shadow(0 22px 0 rgba(74,59,92,.2))}`);

const world = domScene(1600);
const burst = document.createElement('div'); burst.className = 'burst'; world.appendChild(burst);
const items = TEXT.map((c, i) => {
  const ring = document.createElement('div'); ring.className = 'ring'; world.appendChild(ring);
  const el = document.createElement('div'); el.className = 'ch big'; el.textContent = c;
  el.style.fontSize = SIZE + 'px'; el.style.color = COLORS[i]; el.style.transformOrigin = '50% 85%';
  world.appendChild(el);
  return { el, ring, x: (i - 1) * STEP, start: 0.4 + i * 0.45 };
});
// ぴょんと跳ねる時刻（全部出てから、順番に）
const HOPS = [3.2, 3.5, 3.8, 5.2, 5.25, 5.3];

function render(t) {
  let punch = 0;
  items.forEach((c, i) => {
    const u = range01(t, c.start, c.start + 1.4);
    const e = easeOutElastic(u);                     // 0 → 行き過ぎ → 揺れて 1
    const wob = e - 1;                               // 1 からのずれ＝揺れ
    // 体積を保つように：縦に伸びたら横に縮む
    let sy = e * (1 + 0.55 * wob), sx = e * (1 - 0.45 * wob);
    // あとの跳ね：上に飛んで、着地でつぶれる
    let jy = 0;
    for (const h of HOPS.filter((_, k) => k % 3 === i)) {
      const d = t - h;
      if (d > 0 && d < 0.9) {
        jy -= 160 * Math.sin(Math.PI * Math.min(1, d / 0.45));
        if (d > 0.45) { const q = expImpulse(d - 0.45, 12); sy *= 1 - 0.3 * q; sx *= 1 + 0.25 * q; }
        else { sy *= 1 + 0.12 * Math.sin(Math.PI * d / 0.45); sx *= 1 - 0.08 * Math.sin(Math.PI * d / 0.45); }
      }
    }
    c.el.style.transform = `translate3d(${c.x - SIZE / 2}px, ${-SIZE * 0.6 + jy}px, 0) scale(${Math.max(0, sx)}, ${Math.max(0, sy)})`;
    // 出た瞬間に広がる輪
    const r = range01(t, c.start, c.start + 0.8);
    c.ring.style.opacity = r > 0 && r < 1 ? 1 - r : 0;
    c.ring.style.transform = `translate3d(${c.x}px, -40px, -10px) scale(${0.3 + 2.6 * easeOutExpo(r)})`;
    punch += expImpulse(Math.max(0, t - c.start), 6);
  });
  burst.style.transform = `translateZ(-300px) rotate(${t * 12}deg)`;
  // カメラ：文字が出るたびにドンと寄る。最後は少し斜めから
  const settle = easeInOutCubic(range01(t, 2.2, 4));
  setCamera(world, { zoom: -120 + 70 * punch, yaw: lerp(0, -14, settle) * Math.cos(t * 0.5), pitch: lerp(0, -10, settle), roll: 2.5 * Math.sin(t * 1.3) * settle, y: 30 });
}

run({ render, loop: 7, fonts: ['800 40px "M PLUS Rounded 1c"'] });
