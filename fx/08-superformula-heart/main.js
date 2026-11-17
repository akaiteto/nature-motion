// 08 「すき」の後ろの図形が、星 → 花 → ハートへ変身し、ハートになったら鼓動する
// 使う関数：スーパーフォーミュラ・ハートの曲線・カージオイド（lib/curves.js）、easeInOutBack、expImpulse
import { W, H, PAL, run, chip, range01, lerp, FONT } from '../lib/stage.js';
import { superformula, heart, cardioid } from '../lib/curves.js';
import { easeInOutBack, easeInOutCubic } from '../lib/easing.js';
import { expImpulse } from '../lib/iq.js';

const ctx = document.getElementById('stage').getContext('2d');
const N = 360, R = 330;
const chipEl = chip('');

// 図形を「角度ごとの半径」の配列で持つ → 配列どうしを混ぜれば変身する
const shape = f => Float32Array.from({ length: N }, (_, i) => f((i / N) * Math.PI * 2));
const norm = a => { const m = Math.max(...a); return a.map(v => v / m); };
const STAR = norm(shape(th => superformula(th, 5, 2, 7, 7)));
const FLOWER = norm(shape(th => superformula(th, 10, 2, 4, 4)));
// ハート：曲線の点を、中心から見た角度ごとの半径に直す
const HEART = (() => {
  const pts = Array.from({ length: 2000 }, (_, i) => heart((i / 2000) * Math.PI * 2)).map(([x, y]) => [x, y + 0.08]);
  const r = new Float32Array(N);
  for (const [x, y] of pts) { const k = Math.round(((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * N) % N; r[k] = Math.max(r[k], Math.hypot(x, y)); }
  for (let i = 0; i < N; i++) if (!r[i]) r[i] = r[(i + N - 1) % N];
  return norm(r);
})();
const KEYS = [[0, STAR, '星：superformula(m=5, n1=2, n2=n3=7)'], [2.6, FLOWER, '花：superformula(m=10, n1=2, n2=n3=4)'], [5.2, HEART, 'ハートの曲線']];

function radii(t) {
  let a = KEYS[0][1], b = a, k = 0, name = KEYS[0][2];
  for (let i = 1; i < KEYS.length; i++) {
    if (t >= KEYS[i][0] - 1.2) { a = KEYS[i - 1][1]; b = KEYS[i][1]; k = easeInOutBack(range01(t, KEYS[i][0] - 1.2, KEYS[i][0])); name = k > 0.5 ? KEYS[i][2] : KEYS[i - 1][2]; }
  }
  return { r: a.map((v, i) => lerp(v, b[i], k)), name };
}

// 鼓動：ドッ、ドクン（1秒に1回、インパルスを2つ）
const beat = t => (t < 5.2 ? 0 : expImpulse((t - 5.2) % 1, 14) + 0.6 * expImpulse(Math.max(0, ((t - 5.2) % 1) - 0.22), 14));

function render(t) {
  const { r, name } = radii(t);
  const b = beat(t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // カメラ：ゆっくり回りながら寄る。鼓動でドンと揺れる
  const zoom = lerp(0.85, 1.12, easeInOutCubic(range01(t, 0, 8))) * (1 + 0.05 * b);
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.rotate(0.05 * Math.sin(t * 0.7));

  // 図形（回転しながら変身。ハートになったら回転は止まって正面を向く）
  const spin = (1 - easeInOutCubic(range01(t, 3.6, 5.2))) * t * 0.6;
  const scale = R * (1 + 0.12 * b);
  for (const [k, col] of [[1.18, 'rgba(255,143,184,.25)'], [1.0, null]]) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2 + spin;
      const rr = r[i % N] * scale * k;
      const x = Math.cos(th) * rr, y = -Math.sin(th) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    if (col) { ctx.fillStyle = col; ctx.fill(); continue; }
    const g = ctx.createRadialGradient(-80, -120, 30, 0, 0, scale * 1.1);
    g.addColorStop(0, '#ffd1e3'); g.addColorStop(0.6, PAL.pink); g.addColorStop(1, '#f06a9e');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 12; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.stroke();
  }

  // まわりを回る小さなハート（カージオイドの軌道）
  for (let i = 0; i < 9; i++) {
    const th = t * 0.9 + (i / 9) * Math.PI * 2;
    const [x, y] = cardioid(th, 260);
    const s = 18 + 8 * Math.sin(t * 3 + i);
    ctx.save(); ctx.translate(x - 260, -y); ctx.rotate(Math.sin(t * 2 + i) * 0.3);
    ctx.beginPath();
    for (let j = 0; j <= 40; j++) { const [hx, hy] = heart((j / 40) * Math.PI * 2); j ? ctx.lineTo(hx * s, -hy * s) : ctx.moveTo(hx * s, -hy * s); }
    ctx.fillStyle = [PAL.lav, PAL.yellow, PAL.sky][i % 3]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = PAL.ink; ctx.stroke();
    ctx.restore();
  }

  // 文字
  const ts = 1 + 0.1 * b;
  ctx.save(); ctx.scale(ts, ts);
  ctx.font = `800 230px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 26; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.strokeText('すき', 0, 10);
  ctx.fillStyle = '#fff'; ctx.fillText('すき', 0, 10);
  ctx.restore();
  chipEl.innerHTML = `スーパーフォーミュラで変身 → 鼓動は expImpulse<small>${name}</small>`;
}

run({ render, loop: 9, fonts: ['800 40px "M PLUS Rounded 1c"'] });
