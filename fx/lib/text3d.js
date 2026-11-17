// 文字の立体：フォントの輪郭（glyphs.json）→ 平らな形（Shape）→ 押し出し（ExtrudeGeometry）
import { THREE } from './three-stage.js';

// 1文字の輪郭を three.js の形にする（em 単位、y は上が正）
export function glyphShapes(glyph) {
  const sp = new THREE.ShapePath();
  for (const c of glyph.outline) {
    const op = typeof c === 'string' ? c : c[0];
    if (op === 'M') sp.moveTo(c[1], c[2]);
    else if (op === 'L') sp.lineTo(c[1], c[2]);
    else if (op === 'Q') sp.quadraticCurveTo(c[1], c[2], c[3], c[4]);
    else if (op === 'C') sp.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
  }
  return sp.toShapes(true);
}

// 言葉を1文字ずつの立体にして並べる。各文字は中心が原点に来るように動かしてある
//   depth：厚み  bevel：角の丸み（大きくすると、ぷっくり）  すべて em 単位
export function textGeometries(text, glyphs, { size = 1, depth = 0.25, bevel = 0.03, bevelSeg = 4, curveSeg = 10, gap = 0.04 } = {}) {
  const chars = [...text];
  const total = chars.reduce((s, ch) => s + glyphs[ch].adv + gap, -gap);
  let x = -total / 2;
  return chars.map((ch, i) => {
    const g = glyphs[ch];
    const geo = new THREE.ExtrudeGeometry(glyphShapes(g), {
      depth, curveSegments: curveSeg, bevelEnabled: bevel > 0,
      bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: bevelSeg
    });
    geo.computeBoundingBox();
    const b = geo.boundingBox, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
    geo.scale(size, size, size);
    geo.computeVertexNormals();
    const pos = (x + cx) * size, posY = (cy - 0.38) * size;
    x += g.adv + gap;
    return { ch, i, geo, x: pos, y: posY };
  });
}
