// ik.js — 2関節の脚（逆運動学）と「離れすぎたら踏み出す」ルール
(function () {
  // 肩 s と足先 f、上の骨 l1・下の骨 l2 から、ひざ（ひじ）の位置を出す。bend は曲がる向き（+1 / -1）
  function solveTwoBone(s, f, l1, l2, bend) {
    const dx = f.x - s.x, dy = f.y - s.y;
    const d = Motion.clamp(Math.hypot(dx, dy), 1e-3, l1 + l2 - 1e-3);
    const base = Math.atan2(dy, dx);
    const cos = Motion.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const a = base + bend * Math.acos(cos);
    return { x: s.x + Math.cos(a) * l1, y: s.y + Math.sin(a) * l1 };
  }

  class Leg {
    constructor(l1, l2, x, y) {
      this.l1 = l1; this.l2 = l2;
      this.foot = { x, y };
      this.stepping = false; this.t = 0; this.lift = 0;
      this.from = { x, y }; this.to = { x, y };
      this.onLand = null; // 着地したときに呼ぶ
    }
    // desired：いま足を置きたい場所。canStep：同じ組の脚が動いていないときだけ true
    update(desired, dt, canStep, stepDist, stepTime, overshoot = 0.35) {
      const far = Math.hypot(desired.x - this.foot.x, desired.y - this.foot.y);
      if (!this.stepping && canStep && far > stepDist) {
        this.stepping = true; this.t = 0;
        this.from = { ...this.foot };
        // 少し先まで踏み込む（すぐまた踏み出さないように）
        this.to = { x: desired.x + (desired.x - this.foot.x) * overshoot, y: desired.y + (desired.y - this.foot.y) * overshoot };
      }
      if (this.stepping) {
        this.t = Math.min(1, this.t + dt / stepTime);
        const e = this.t * this.t * (3 - 2 * this.t);
        this.foot.x = Motion.lerp(this.from.x, this.to.x, e);
        this.foot.y = Motion.lerp(this.from.y, this.to.y, e);
        this.lift = Math.sin(Math.PI * this.t);
        if (this.t >= 1) { this.stepping = false; this.lift = 0; if (this.onLand) this.onLand(this.foot); }
      }
    }
  }

  window.IK = { solveTwoBone, Leg };
})();
