// motion.js — 全デモ共通の小さな土台
// ・1280×720 のキャンバスを画面に合わせて表示
// ・時間の刻みを固定（1/60秒）。同じ seed なら毎回同じ動きになる
// ・?capture を付けて開くと自動再生を止め、window.__frame(n) で n コマ目まで進めて描く（動画書き出し用）
(function () {
  const params = new URLSearchParams(location.search);
  const CAPTURE = params.has('capture');

  // 乱数（seed 固定）
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(+(params.get('seed') || 1));

  // なめらかな乱数（1次元のバリューノイズ）
  const noiseTable = Array.from({ length: 512 }, () => rng());
  function noise1(x) {
    const i = Math.floor(x), f = x - i;
    const a = noiseTable[i & 511], b = noiseTable[(i + 1) & 511];
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s; // 0..1
  }

  const W = 1280, H = 720, FPS = 60;

  const M = {
    W, H, FPS, CAPTURE, params,
    rand: rng,
    range: (a, b) => a + (b - a) * rng(),
    noise: noise1,
    mouse: { x: W / 2, y: H / 2, down: false, active: false, clicked: false },
    palette: {
      bg: '#fff6fb', ink: '#4a3b5c', pink: '#ff8fb8', mint: '#8fe3cf',
      lav: '#b9a6ff', yellow: '#ffe27a', sky: '#9fd8ff', peach: '#ffc29f', white: '#ffffff'
    },

    // opts: { setup(), update(dt, t), draw(ctx, t), substeps, webgl }
    create(opts) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      canvas.id = 'stage';
      document.body.appendChild(canvas);
      const ctx = opts.webgl
        ? canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true })
        : canvas.getContext('2d');

      function fit() {
        const s = Math.min(innerWidth / W, innerHeight / H);
        canvas.style.width = W * s + 'px';
        canvas.style.height = H * s + 'px';
      }
      addEventListener('resize', fit); fit();

      function toLocal(e) {
        const r = canvas.getBoundingClientRect();
        M.mouse.x = (e.clientX - r.left) * W / r.width;
        M.mouse.y = (e.clientY - r.top) * H / r.height;
      }
      canvas.addEventListener('pointermove', e => { toLocal(e); M.mouse.active = true; });
      canvas.addEventListener('pointerdown', e => { toLocal(e); M.mouse.down = true; M.mouse.active = true; M.mouse.clicked = true; });
      addEventListener('pointerup', () => { M.mouse.down = false; });
      canvas.addEventListener('pointerleave', () => { M.mouse.active = false; });

      const sub = opts.substeps || 1;
      const dt = 1 / FPS;
      let frame = 0;
      if (opts.setup) opts.setup(ctx);

      function stepOnce() {
        const t = frame * dt;
        for (let s = 0; s < sub; s++) opts.update(dt / sub, t + s * dt / sub);
        M.mouse.clicked = false;
        frame++;
      }
      function render() { opts.draw(ctx, frame * dt); }

      if (CAPTURE) {
        // 書き出し用：n コマ目まで進めて描く
        window.__frame = n => { while (frame < n) stepOnce(); render(); return frame; };
      } else {
        let last = performance.now(), acc = 0;
        function loop(now) {
          acc += Math.min(0.1, (now - last) / 1000); last = now;
          while (acc >= dt) { stepOnce(); acc -= dt; }
          render();
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
      }
      window.__ready = true;
      return { canvas, ctx };
    },

    // 点の列を通るなめらかな閉じた線（中点を結ぶ2次曲線）
    smoothClosed(ctx, pts) {
      const n = pts.length;
      const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      let m = mid(pts[n - 1], pts[0]);
      ctx.moveTo(m.x, m.y);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        const m2 = mid(p, q);
        ctx.quadraticCurveTo(p.x, p.y, m2.x, m2.y);
      }
      ctx.closePath();
    },

    // 画面左上のタイトル札
    label(ctx, title, sub) {
      ctx.save();
      ctx.font = '700 30px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif';
      let w = ctx.measureText(title).width;
      if (sub) { ctx.font = '500 18px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif'; w = Math.max(w, ctx.measureText(sub).width); }
      w += 40;
      ctx.font = '700 30px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = M.palette.ink; ctx.lineWidth = 4;
      roundRect(ctx, 24, 22, w, sub ? 84 : 56, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = M.palette.ink; ctx.textBaseline = 'middle';
      ctx.fillText(title, 44, 50);
      if (sub) {
        ctx.font = '500 18px "Noto Sans CJK JP","Hiragino Sans","Yu Gothic",sans-serif';
        ctx.fillText(sub, 44, 84);
      }
      ctx.restore();
    },
    roundRect,
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    // 角度の差を -π..π に
    angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  window.Motion = M;
})();
