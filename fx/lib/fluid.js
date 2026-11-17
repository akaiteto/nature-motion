// fluid.js — 格子で解く2Dの流体（Jos Stam「Stable Fluids」1999）。common/fluid.js を ES モジュールにしたもの
// 1コマごとに：
//   1. 速度を「流れに乗せて」運ぶ（移流：その点の少し上流の値をとってくる）
//   2. 渦を少し強める（渦度の強調：細かいうずが消えないように）
//   3. 「縮まない」ように直す（圧力を解いて、湧き出しと吸い込みをなくす）
//   4. 煙や温度などの量も、流れに乗せて運ぶ
// 格子の1マスを長さ1とし、速度は「マス/秒」。
export class Fluid {
  constructor(nx, ny, fields = []) {
    this.nx = nx; this.ny = ny;
    const n = nx * ny;
    this.u = new Float32Array(n); this.v = new Float32Array(n);
    this.tu = new Float32Array(n); this.tv = new Float32Array(n);
    this.p = new Float32Array(n); this.div = new Float32Array(n); this.curl = new Float32Array(n);
    this.tmp = new Float32Array(n);
    this.f = {};
    for (const name of fields) this.f[name] = new Float32Array(n);
    this.iterations = 30;
    this.vorticity = 0;
  }
  idx(x, y) { return x + y * this.nx; }

  // 両隣の値を混ぜてとる（双線形補間）
  sample(a, x, y) {
    const nx = this.nx, ny = this.ny;
    x = Math.max(0, Math.min(nx - 1.001, x)); y = Math.max(0, Math.min(ny - 1.001, y));
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, k = i + j * nx;
    return (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + nx] * (1 - fx) + a[k + nx + 1] * fx) * fy;
  }

  advect(src, dst, dt) {
    const { nx, ny, u, v } = this;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const k = x + y * nx;
      dst[k] = this.sample(src, x - u[k] * dt, y - v[k] * dt);
    }
  }

  step(dt) {
    // 1. 速度の移流
    this.advect(this.u, this.tu, dt); this.advect(this.v, this.tv, dt);
    [this.u, this.tu] = [this.tu, this.u]; [this.v, this.tv] = [this.tv, this.v];
    // 2. 渦度の強調
    if (this.vorticity > 0) this.confine(dt);
    this.walls();
    // 3. 縮まないように直す
    this.project();
    // 4. 量の移流
    for (const name in this.f) { this.advect(this.f[name], this.tmp, dt); const t = this.f[name]; this.f[name] = this.tmp; this.tmp = t; }
  }

  confine(dt) {
    const { nx, ny, u, v, curl } = this;
    for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const k = x + y * nx;
      curl[k] = (v[k + 1] - v[k - 1]) * 0.5 - (u[k + nx] - u[k - nx]) * 0.5;
    }
    for (let y = 2; y < ny - 2; y++) for (let x = 2; x < nx - 2; x++) {
      const k = x + y * nx;
      let gx = (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1])) * 0.5;
      let gy = (Math.abs(curl[k + nx]) - Math.abs(curl[k - nx])) * 0.5;
      const m = Math.hypot(gx, gy) + 1e-5; gx /= m; gy /= m;
      u[k] += gy * curl[k] * this.vorticity * dt;
      v[k] -= gx * curl[k] * this.vorticity * dt;
    }
  }

  walls() {
    const { nx, ny, u, v } = this;
    for (let x = 0; x < nx; x++) { v[x] = 0; v[x + (ny - 1) * nx] = 0; }
    for (let y = 0; y < ny; y++) { u[y * nx] = 0; u[nx - 1 + y * nx] = 0; }
  }

  project() {
    const { nx, ny, u, v, p, div } = this;
    for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const k = x + y * nx;
      div[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + nx] - v[k - nx]);
      p[k] = 0;
    }
    // 圧力：ガウス・ザイデル法でくり返し近づける
    for (let it = 0; it < this.iterations; it++) {
      for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
        const k = x + y * nx;
        p[k] = (div[k] + p[k - 1] + p[k + 1] + p[k - nx] + p[k + nx]) / 4;
      }
      for (let x = 0; x < nx; x++) { p[x] = p[x + nx]; p[x + (ny - 1) * nx] = p[x + (ny - 2) * nx]; }
      for (let y = 0; y < ny; y++) { p[y * nx] = p[1 + y * nx]; p[nx - 1 + y * nx] = p[nx - 2 + y * nx]; }
    }
    for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
      const k = x + y * nx;
      u[k] -= 0.5 * (p[k + 1] - p[k - 1]);
      v[k] -= 0.5 * (p[k + nx] - p[k - nx]);
    }
    this.walls();
  }

  // (x, y) を中心に半径 r の円で、速度や量を足す
  splat(x, y, r, du, dv, adds = {}) {
    const { nx, ny } = this;
    const x0 = Math.max(1, Math.floor(x - r * 2)), x1 = Math.min(nx - 2, Math.ceil(x + r * 2));
    const y0 = Math.max(1, Math.floor(y - r * 2)), y1 = Math.min(ny - 2, Math.ceil(y + r * 2));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const w = Math.exp(-((i - x) ** 2 + (j - y) ** 2) / (r * r));
      const k = i + j * nx;
      this.u[k] += du * w; this.v[k] += dv * w;
      for (const name in adds) this.f[name][k] += adds[name] * w;
    }
  }
}
