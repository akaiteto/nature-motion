// 形の変形4種（Barr 1984 "Global and Local Deformations of Solid Primitives"／Blender のシンプル変形と同じ4つ）
//   回転系：ツイスト（x 軸のまわりにねじる）、ベンド（x 軸を円弧に曲げる）
//   拡大縮小系：テーパー（x に応じて太さを変える）、ストレッチ（x 方向に伸ばし、体積を保つように細くする）
// 文字の立体は x 方向に長いので、すべて x 軸にそってかける。half は形の半分の長さ。
import { THREE } from './three-stage.js';
import { TessellateModifier } from '../vendor/jsm/modifiers/TessellateModifier.js';
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js';

export function deformPoint(x, y, z, { twist = 0, bend = 0, taper = 0, stretch = 1 }, half) {
  // ストレッチ：伸ばした分だけ、断面を 1/√s に細くする（体積がおよそ同じ）
  x *= stretch; const k = 1 / Math.sqrt(stretch); y *= k; z *= k;
  const u = x / (half * stretch);                     // -1〜1：形のどこにいるか
  // テーパー：右に行くほど太く（taper が負なら細く）
  const t = Math.max(0.05, 1 + taper * u); y *= t; z *= t;
  // ツイスト：x に比例した角度で、断面を回す
  const a = twist * u, c = Math.cos(a), s = Math.sin(a);
  [y, z] = [y * c - z * s, y * s + z * c];
  // ベンド：x 軸を、半径 R の円弧に巻きつける（R = 長さ ÷ 角度）
  if (Math.abs(bend) > 1e-4) {
    const R = (half * stretch) / bend, th = x / R;
    [x, y] = [Math.sin(th) * (R - y), R - Math.cos(th) * (R - y)];
  }
  return [x, y, z];
}

// 文字の立体を1つにまとめ、細かい三角形に分ける（曲げてもカクカクしないように）
export function mergedText(parts, maxEdge = 0.12) {
  const geos = parts.map(p => { const g = p.geo.clone(); g.translate(p.x, p.y, 0); g.clearGroups(); return g; });
  let geo = mergeGeometries(geos);
  geo.deleteAttribute('uv');
  geo = new TessellateModifier(maxEdge, 8).modify(geo);
  geo.computeVertexNormals();
  return geo;
}

// 元の位置を覚えておき、毎コマ変形して書き戻す
export function makeDeformer(geo) {
  const pos = geo.attributes.position, base = Float32Array.from(pos.array);
  geo.computeBoundingBox();
  const half = (geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;
  return params => {
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = deformPoint(base[i * 3], base[i * 3 + 1], base[i * 3 + 2], params, half);
      pos.array[i * 3] = x; pos.array[i * 3 + 1] = y; pos.array[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  };
}

// 表の面と側面で色を分ける（法線が手前を向いている所＝表）
export function faceSideColors(geo, colorOf, side = new THREE.Color('#4a3b5c')) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const face = Math.abs(nor.getZ(i)) > 0.6;
    c.copy(face ? colorOf(pos.getX(i)) : side);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}
