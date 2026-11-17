"""使う文字だけフォントから取り出して JSON にする（3D 文字用）。

python tools/extract_glyphs.py "てつゴムとうふプリンガラス" out.json
- outline: 輪郭（M/L/Q/C/Z の命令列。単位は em=1、y は上向き）
（当たり判定用のマス目は、ブラウザ側で輪郭から作る）
フォント: Noto Sans CJK JP Black（SIL Open Font License 1.1）
"""
import json, sys
from fontTools.ttLib import TTCollection
from fontTools.pens.recordingPen import RecordingPen

FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
text, out = sys.argv[1], sys.argv[2]
font = TTCollection(FONT).fonts[0]
cmap, gs = font.getBestCmap(), font.getGlyphSet()
upm = font['head'].unitsPerEm

data = {}
for ch in dict.fromkeys(text):
    name = cmap[ord(ch)]
    pen = RecordingPen(); gs[name].draw(pen)
    cmds = []
    for op, pts in pen.value:
        p = [round(v / upm, 4) for xy in pts for v in xy]
        cmds.append({'moveTo': 'M', 'lineTo': 'L', 'qCurveTo': 'Q', 'curveTo': 'C', 'closePath': 'Z', 'endPath': 'Z'}[op] if not p else
                    [{'moveTo': 'M', 'lineTo': 'L', 'qCurveTo': 'Q', 'curveTo': 'C'}[op], *p])
    data[ch] = {'adv': round(gs[name].width / upm, 4), 'outline': cmds}
json.dump({'font': 'Noto Sans CJK JP Black (SIL OFL 1.1)', 'glyphs': data}, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(out, len(data), 'glyphs')
