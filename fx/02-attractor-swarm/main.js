// 02 文字を粒にして、ローレンツアトラクタで舞わせ、ばねで字に戻す
// 使う関数：ストレンジアトラクタ（lib/attractors.js）、二次の動き＝ばね（lib/spring.js）、イージング
import { W, H, PAL, RAINBOW, run, chip, range01, lerp, rng, FONT } from '../lib/stage.js';
import { samplePoints } from '../lib/glyph.js';
import { lorenz } from '../lib/attractors.js';
import { SecondOrder } from '../lib/spring.js';
import { easeInOutCubic, easeInOutSine } from '../lib/easing.js';

const ctx = document.getElementById('stage').getContext('2d');
const label = chip('');
const S = 16;             // ローレンツの座標 1 = 画面の 16px
const RELEASE = 1.6, RETURN = 7.4;

let parts = [];
function setup() {
  const rand = rng(3);
  const pts = samplePoints('かわいいは、作れる！', `800 165px ${FONT}`, 5, W, H);
  parts = pts.map(([x, y]) => {
    const home = [x - W / 2, y - H / 2, 0];
    return {
      home, p: home.slice(), mode: 'home',
      color: RAINBOW[Math.floor(((x - 120) / (W - 240)) * RAINBOW.length) % RAINBOW.length] || PAL.pink,
      delay: ((x - 200) / (W - 400)) * 1.2 + rand() * 0.25,    // 左から順に戻る
      spring: null
    };
  });
}

// 画面の座標 ↔ ローレンツの座標（ローレンツの z を画面の上下に）
const toL = ([x, y, z]) => [x / S, z / S, -y / S + 25];
const fromLv = ([dx, dy, dz]) => [dx * S, -dz * S, dy * S];

function update(t, dt) {
  for (const q of parts) {
    if (t >= RELEASE && t < RETURN) {
      // アトラクタの流れに乗る（細かく刻んで積分）
      for (let k = 0; k < 3; k++) {
        const v = fromLv(lorenz(toL(q.p)));
        const sp = 0.0045 * easeInOutSine(range01(t, RELEASE, RELEASE + 1.2)) * 60;
        q.p[0] += v[0] * sp * dt; q.p[1] += v[1] * sp * dt; q.p[2] += v[2] * sp * dt;
      }
      q.spring = null;
    } else if (t >= RETURN) {
      // ばねで元の場所へ（f=1.4Hz、ζ=0.45、r=2：先回りして行き過ぎ、ぷるんと止まる）
      if (!q.spring) q.spring = new SecondOrder(1.4, 0.45, 2, q.p.slice());
      const target = t > RETURN + q.delay ? q.home : q.p;
      q.p = q.spring.update(dt, target).slice();
    }
  }
}

function render(t) {
  // カメラ：放したら一周まわり込み、字に戻るころ正面に戻る
  const yaw = Math.PI * 2 * easeInOutCubic(range01(t, RELEASE, RETURN + 2.2));
  const pitch = 0.32 * Math.sin(Math.PI * range01(t, RELEASE, RETURN + 1.5));
  const dist = 1500 + 500 * Math.sin(Math.PI * range01(t, RELEASE, RETURN + 1));
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const list = [];
  for (const q of parts) {
    const [x, y, z] = q.p;
    let X = cy * x - sy * z, Z = sy * x + cy * z;
    let Y = cp * y - sp * Z; Z = sp * y + cp * Z;
    const s = 1500 / (dist + Z);
    list.push([W / 2 + X * s, H / 2 + Y * s, s, q.color]);
  }
  list.sort((a, b) => a[2] - b[2]);
  for (const [x, y, s, c] of list) {
    ctx.fillStyle = c;
    const r = 3.4 * s;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  label.innerHTML = 'ローレンツアトラクタ → ばね（二次の動き）で戻る<small>σ=10, ρ=28, β=8/3 ／ f=1.4, ζ=0.45, r=2</small>';
}

run({ setup, update, render, loop: 12, fonts: [`800 40px "M PLUS Rounded 1c"`] });
