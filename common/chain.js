// chain.js — 背骨の鎖
// 頭を動かすと、後ろの関節が「決まった間隔」と「曲がりすぎない角度」を守って付いてくる。
// 魚・トカゲの体はこれ1本でできる（考え方は argonaut「A simple procedural animation technique」の動画を参考に自作）。
(function () {
  class Chain {
    constructor(x, y, count, link, angleLimit) {
      this.link = link;                 // 関節の間隔
      this.angleLimit = angleLimit;     // となり同士で曲がれる角度の上限
      this.joints = [];
      this.angles = [];
      for (let i = 0; i < count; i++) {
        this.joints.push({ x: x - i * link, y });
        this.angles.push(0);
      }
    }
    // 頭を pos に置き、残りを順番に引っぱる
    resolve(pos) {
      const j = this.joints, a = this.angles;
      a[0] = Math.atan2(pos.y - j[0].y, pos.x - j[0].x) || a[0];
      j[0].x = pos.x; j[0].y = pos.y;
      for (let i = 1; i < j.length; i++) {
        let ang = Math.atan2(j[i - 1].y - j[i].y, j[i - 1].x - j[i].x);
        // 前の関節の向きから angleLimit 以上は曲がらない
        const d = Motion.angleDiff(ang, a[i - 1]);
        if (d > this.angleLimit) ang = a[i - 1] + this.angleLimit;
        if (d < -this.angleLimit) ang = a[i - 1] - this.angleLimit;
        a[i] = ang;
        j[i].x = j[i - 1].x - Math.cos(ang) * this.link;
        j[i].y = j[i - 1].y - Math.sin(ang) * this.link;
      }
    }
    // i 番目の関節から、体の横方向に offset だけずらした点（offset>0 で進行方向の右）
    side(i, offset, extraAngle = 0) {
      const a = this.angles[i] + Math.PI / 2 + extraAngle;
      return { x: this.joints[i].x + Math.cos(a) * offset, y: this.joints[i].y + Math.sin(a) * offset };
    }
  }

  // 「向き」と「速さ」で進む頭。急に曲がれないので、自然な弧を描く
  class Steerer {
    constructor(x, y, heading, speed, turnRate) {
      this.x = x; this.y = y; this.heading = heading;
      this.speed = speed; this.turnRate = turnRate;
    }
    steerTo(tx, ty, dt, speedScale = 1) {
      const want = Math.atan2(ty - this.y, tx - this.x);
      const d = Motion.angleDiff(want, this.heading);
      this.heading += Motion.clamp(d, -this.turnRate * dt, this.turnRate * dt);
      this.x += Math.cos(this.heading) * this.speed * speedScale * dt;
      this.y += Math.sin(this.heading) * this.speed * speedScale * dt;
    }
  }

  window.Chain = Chain;
  window.Steerer = Steerer;
})();
