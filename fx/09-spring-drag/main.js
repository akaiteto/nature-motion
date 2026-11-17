// 09 文字をつまんで引っぱると、まわりの文字もゴムのようについてきて、離すとぷるんと戻る
// 使う関数：二次の動き＝ばね（lib/spring.js、t3ssel8r）、easeInOutCubic（ペナー）
// 録画では「見えない手」が台本どおりに引っぱる。普通に開いたときはマウスでも引っぱれる
import { W, H, PAL, RAINBOW, run, chip, range01, lerp, FONT } from '../lib/stage.js';
import { SecondOrder } from '../lib/spring.js';
import { easeInOutCubic } from '../lib/easing.js';

const ctx = document.getElementById('stage').getContext('2d');
const TEXT = [...'かわいいは、作れる！'];
const SIZE = 150, STEP = 156, F = 1.6, Z = 0.28, R = 2.2;
chip(`ばね：二次の動き（t3ssel8r）<small>f=${F}Hz（揺れの速さ） ζ=${Z}（減衰） r=${R}（出だし）</small>`);

// 見えない手の台本：[時刻, 何番目の字をつまむか（-1 なら離す）, 引っぱる先 dx, dy]
const SCRIPT = [[0.8, 2, 0, 0], [1.2, 2, -40, -330], [2.0, 2, 160, -260], [2.6, 2, 60, -360], [3.0, -1], [4.4, 7, 0, 0], [4.8, 7, 120, 300], [5.6, 7, -200, 260], [6.1, -1]];

let chars = [], hand = null, mouse = null;
function setup() {
  chars = TEXT.map((c, i) => {
    const home = [W / 2 + (i - (TEXT.length - 1) / 2) * STEP, H / 2];
    return { c, i, home, spring: new SecondOrder(F, Z, R, home.slice()), pos: home.slice(), prev: home.slice(), color: RAINBOW[i % RAINBOW.length] };
  });
  hand = { grab: -1, dx: 0, dy: 0, x: W / 2, y: H + 100 };
  cam.k = 0;
}

// 台本の、時刻 t での「つまんでいる字」と「引っぱり量」（区間をイージングでつなぐ）
function scripted(t) {
  let grab = -1, dx = 0, dy = 0;
  for (let k = 0; k < SCRIPT.length; k++) {
    const [t0, g, x0 = 0, y0 = 0] = SCRIPT[k], next = SCRIPT[k + 1];
    if (t < t0) break;
    grab = g;
    if (g < 0) { dx = 0; dy = 0; continue; }
    if (next && next[1] === g) { const e = easeInOutCubic(range01(t, t0, next[0])); dx = lerp(x0, next[2], e); dy = lerp(y0, next[3], e); }
    else { dx = x0; dy = y0; }
  }
  return { grab, dx, dy };
}

function update(t, dt) {
  const s = mouse || scripted(t);
  hand.grab = s.grab; hand.dx = s.dx; hand.dy = s.dy;
  for (const ch of chars) {
    // つまんだ字から離れるほど、引っぱりの効きが弱くなる
    const d = hand.grab < 0 ? 99 : Math.abs(ch.i - hand.grab);
    const w = Math.exp(-d * d / 6);
    const target = [ch.home[0] + hand.dx * w, ch.home[1] + hand.dy * w];
    ch.prev = ch.pos.slice();
    ch.pos = ch.spring.update(dt, target).slice();
  }
  const g = chars[hand.grab];
  const hx = g ? g.pos[0] + 10 : hand.x, hy = g ? g.pos[1] + 40 : H + 120;
  hand.x = lerp(hand.x, hx, 0.25); hand.y = lerp(hand.y, hy, 0.25);
  cam.k = lerp(cam.k, hand.grab >= 0 ? 1 : 0, 0.05);
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // カメラ：引っぱっている所に少し寄って追いかける
  const grabbing = hand.grab >= 0 ? 1 : 0;
  const fx = lerp(W / 2, hand.x, 0.25 * cam.k), fy = lerp(H / 2, hand.y, 0.25 * cam.k);
  const zoom = 1 + 0.12 * cam.k;
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.rotate(0.03 * Math.sin(t * 0.8)); ctx.translate(-fx, -fy);

  // 字どうしをつなぐゴムひも
  ctx.beginPath();
  chars.forEach((ch, i) => (i ? ctx.lineTo(ch.pos[0], ch.pos[1] + 70) : ctx.moveTo(ch.pos[0], ch.pos[1] + 70)));
  ctx.strokeStyle = 'rgba(185,166,255,.6)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.stroke();

  ctx.font = `800 ${SIZE}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const ch of chars) {
    // 速さで、傾きとつぶれ・伸びを決める
    const vx = (ch.pos[0] - ch.prev[0]) * 60, vy = (ch.pos[1] - ch.prev[1]) * 60;
    const stretch = Math.min(0.35, Math.hypot(vx, vy) / 3000);
    const ang = Math.atan2(vy, vx);
    ctx.save(); ctx.translate(ch.pos[0], ch.pos[1]);
    ctx.rotate(ang); ctx.scale(1 + stretch, 1 - stretch * 0.7); ctx.rotate(-ang);
    ctx.rotate(Math.max(-0.5, Math.min(0.5, vx / 2500)));
    ctx.lineWidth = 22; ctx.strokeStyle = PAL.ink; ctx.strokeText(ch.c, 0, 0);
    ctx.fillStyle = ch.color; ctx.fillText(ch.c, 0, 0);
    ctx.restore();
  }
  // 手（つまんでいるときは閉じる）
  ctx.save(); ctx.translate(hand.x, hand.y);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = PAL.ink; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(0, 0, grabbing ? 34 : 44, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.arc(0, 0, grabbing ? 14 : 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
const cam = { k: 0 };

// マウスでも遊べる（録画のときは使わない）
const cv = document.getElementById('stage');
const toStage = e => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
cv.addEventListener('pointerdown', e => {
  const [x, y] = toStage(e);
  const near = chars.reduce((b, c) => (Math.hypot(c.pos[0] - x, c.pos[1] - y) < Math.hypot(b.pos[0] - x, b.pos[1] - y) ? c : b));
  mouse = { grab: near.i, dx: 0, dy: 0, sx: x, sy: y };
});
addEventListener('pointermove', e => { if (mouse && mouse.grab >= 0) { const [x, y] = toStage(e); mouse.dx = x - mouse.sx; mouse.dy = y - mouse.sy; } });
addEventListener('pointerup', () => { if (mouse) { mouse = { grab: -1, dx: 0, dy: 0 }; setTimeout(() => (mouse = null), 3000); } });

run({ setup, update, render, loop: 8, fonts: ['800 40px "M PLUS Rounded 1c"'] });
