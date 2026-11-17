// 06 吹き出しに一文字ずつ文字が出て（Undertale 風）、その上をウェーブが何度も通り抜ける
// 使う関数：cubicPulse・expImpulse（キレス）、easeOutBack・easeInOutCubic（ペナー）
import { RAINBOW, PAL, run, chip, range01, lerp, css, domScene, setCamera } from '../lib/stage.js';
import { cubicPulse, expImpulse } from '../lib/iq.js';
import { easeOutBack, easeInOutCubic, easeInOutSine } from '../lib/easing.js';

const LINES = ['ようこそ！かわいいの研究室へ', '関数ひとつで、文字はおどりだす♪'];
const SIZE = 92, STEP = 96, TYPE = 0.075, START = 0.9;
chip('cubicPulse(c, w, x)：山を一つだけ作り、c を動かして波にする<small>Inigo Quilez ／ 出現：easeOutBack</small>');
css(`.box{position:absolute;left:-880px;top:-230px;width:1760px;height:430px;border-radius:44px;background:rgba(255,255,255,.93);
  border:8px solid ${PAL.ink};box-shadow:0 26px 0 rgba(74,59,92,.18)}
  .name{position:absolute;left:-840px;top:-300px;padding:10px 34px;border-radius:999px;background:${PAL.pink};color:#fff;font-size:46px;font-weight:800;
  border:6px solid ${PAL.ink};transform:translateZ(20px)}
  .cursor{position:absolute;width:30px;height:30px;background:${PAL.ink};clip-path:polygon(0 0,100% 50%,0 100%)}
  .ch.small{-webkit-text-stroke:10px ${PAL.ink}}`);

const world = domScene(1700);
const box = document.createElement('div'); box.className = 'box'; world.appendChild(box);
const name = document.createElement('div'); name.className = 'name'; name.textContent = 'ここね'; world.appendChild(name);
const cursor = document.createElement('div'); cursor.className = 'cursor'; world.appendChild(cursor);

let n = 0;
const chars = LINES.flatMap((line, li) => [...line].map((c, i) => {
  const el = document.createElement('div'); el.className = 'ch small'; el.textContent = c;
  el.style.fontSize = SIZE + 'px'; el.style.color = li ? RAINBOW[i % RAINBOW.length] : PAL.white;
  if (!li) el.style.webkitTextStroke = `10px ${PAL.ink}`;
  world.appendChild(el);
  return { el, x: -800 + i * STEP, y: li ? 90 : -60, line: li, i, appear: START + (n++) * TYPE + li * 0.35 };
}));
const typed = chars[chars.length - 1].appear + 0.3;

function render(t) {
  // 波の中心：文字の番号の上を左から右へ流れる（2行目は少し遅れて）
  const speed = 16, span = 22;
  for (const c of chars) {
    const u = range01(t, c.appear, c.appear + 0.32);
    const pop = easeOutBack(u);
    const center = ((t - typed) * speed) % (span + 8) - 4 - c.line * 3;
    const w = t > typed ? cubicPulse(center, 3.2, c.i) : 0;
    const hop = expImpulse(Math.max(0, t - c.appear), 9);       // 出た瞬間に小さくぴょん
    const y = c.y - 70 * w - 24 * hop;
    const s = pop * (1 + 0.28 * w);
    c.el.style.opacity = u > 0 ? 1 : 0;
    c.el.style.transform = `translate3d(${c.x}px, ${y - SIZE}px, ${40 * w}px) rotate(${(w * 14) * (c.i % 2 ? 1 : -1)}deg) scale(${s})`;
    c.el.style.filter = w > 0.05 ? `brightness(${1 + 0.25 * w})` : '';
  }
  // 打っている位置の三角カーソル（打ち終わったら点滅）
  const last = chars.filter(c => t >= c.appear).pop() || chars[0];
  cursor.style.opacity = t < typed ? 1 : (Math.floor(t * 2.5) % 2 ? 1 : 0);
  cursor.style.transform = `translate3d(${last.x + STEP}px, ${last.y - SIZE * 0.62}px, 0)`;
  // カメラ：斜めから寄って打ち込みを追い、打ち終わると正面に引いてゆらゆら
  const intro = easeInOutCubic(range01(t, 0, typed));
  const follow = t < typed ? (last.x + 400) * 0.35 : 0;
  setCamera(world, {
    zoom: lerp(520, 40, intro) + 30 * Math.sin(t * 0.9),
    yaw: lerp(26, 0, intro) + 4 * Math.sin(t * 0.6) * range01(t, typed, typed + 1),
    pitch: lerp(-14, -4, intro),
    roll: lerp(-4, 0, easeInOutSine(range01(t, 0, typed))),
    x: -follow * (1 - intro), y: -10
  });
}

run({ render, loop: 9, fonts: ['800 40px "M PLUS Rounded 1c"'] });
