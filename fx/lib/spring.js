// ばね：二次の動き（t3ssel8r "Giving Personality to Procedural Animations using Math", 2022）
//   f：揺れの速さ（Hz）  z（ζ）：減衰（0 で揺れ続け、1 でぴたっと止まる）  r：出だし（2 なら先回りして行き過ぎる）
// 目標 x に向かって、位置 y が「その性格で」ついていく。値は数でも [x, y] でもよい。

export class SecondOrder {
  constructor(f, z, r, x0) {
    this.set(f, z, r);
    this.xp = Array.isArray(x0) ? x0.slice() : [x0];
    this.y = this.xp.slice();
    this.yd = this.xp.map(() => 0);
    this.scalar = !Array.isArray(x0);
  }
  set(f, z, r) {
    this.k1 = z / (Math.PI * f);
    this.k2 = 1 / ((2 * Math.PI * f) * (2 * Math.PI * f));
    this.k3 = (r * z) / (2 * Math.PI * f);
  }
  update(dt, x) {
    x = this.scalar ? [x] : x;
    const k2 = Math.max(this.k2, (dt * dt) / 2 + (dt * this.k1) / 2, dt * this.k1); // 刻みが大きくても暴れない
    for (let i = 0; i < x.length; i++) {
      const xd = (x[i] - this.xp[i]) / dt;
      this.xp[i] = x[i];
      this.y[i] += dt * this.yd[i];
      this.yd[i] += (dt * (x[i] + this.k3 * xd - this.y[i] - this.k1 * this.yd[i])) / k2;
    }
    return this.scalar ? this.y[0] : this.y;
  }
}
