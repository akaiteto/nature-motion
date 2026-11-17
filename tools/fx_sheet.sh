#!/bin/bash
# 使い方: tools/fx_sheet.sh 03-rose-bloom 0.5,2,3.5,5,7,9  → /tmp/shots/s_<name>.png
cd /home/claude/nature-motion && timeout 170 python3 tools/fx_shot.py fx/$1 $2 /tmp/shots 2>&1 | grep errors
python3 - "$1" "$2" <<'PY'
import sys
from PIL import Image
n, secs = sys.argv[1], [float(s) for s in sys.argv[2].split(',')]
W = Image.new('RGB', (1280, 360 * ((len(secs) + 1) // 2)), 'white')
for i, s in enumerate(secs):
    W.paste(Image.open(f'/tmp/shots/{n}_{s:04.1f}.png').resize((640, 360)), ((i % 2) * 640, (i // 2) * 360))
W.save(f'/tmp/shots/s_{n}.png')
PY
