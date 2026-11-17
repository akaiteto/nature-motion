# 関数でかわいく動く文字（fx/）

YouTube「ここねの技術おべんきょう」第8回「かわいいは、作れる　～文字の動き～」で見せたデモのソースです。
どのデモも HTML と JavaScript だけで動きます（`python -m http.server` で開いて、`fx/index.html` から選ぶ）。

## 参考にしたもの（作った人・発表した場所）

数式やアルゴリズムの考え方は、下の人たちが作ったものです。コードは、それを元にこのリポジトリで書き直しました。

| 技術 | 作った人・年 | 発表した場所 | 使ったデモ |
|---|---|---|---|
| イージング関数（easeOutElastic・easeOutBounce・easeOutBack・easeInBack など） | Robert Penner, 2001 | https://robertpenner.com/easing/ （一覧の図：https://easings.net ） | 07, 04, 05, o3 |
| 小さな関数（expImpulse・cubicPulse・parabola） | Inigo Quilez | https://iquilezles.org/articles/functions/ | 04, 05, 06, 07 |
| シェイピング関数（二重指数シグモイド） | Golan Levin, 2006 | https://www.flong.com/archive/texts/code/shapers_exp/ | 03 |
| つぶしと伸ばし（アニメーションの12の原則） | Frank Thomas & Ollie Johnston, 1981（『The Illusion of Life: Disney Animation』） | 書籍 | 07, 04, o6 |
| フーリエ級数（回る円の足し算） | Joseph Fourier（1800年代はじめ） | 数学の古典 | 01 |
| バラ曲線 | Guido Grandi, 1723〜1728 | https://mathshistory.st-andrews.ac.uk/Curves/Rhodonea/ | 03 |
| スーパーフォーミュラ | Johan Gielis, 2003（American Journal of Botany 90(3)） | https://doi.org/10.3732/ajb.90.3.333 | 08 |
| ハートの曲線（x = 16 sin³t …） | Wolfram MathWorld「Heart Curve」に載っている式 | https://mathworld.wolfram.com/HeartCurve.html | 08 |
| 二次の動き（ばね：f・ζ・r） | t3ssel8r, 2022（動画 "Giving Personality to Procedural Animations using Math"） | https://www.youtube.com/watch?v=KPoeNZZ6H4s | 09, 10, 02 |
| パーリンノイズ | Ken Perlin, 1985（SIGGRAPH "An Image Synthesizer"）、なめらかさの式は 2002 年の改良版 | https://doi.org/10.1145/325165.325247 | 10, o5 |
| カールノイズ | Robert Bridson, Jim Hourihan, Marcus Nordenstam, 2007（SIGGRAPH） | https://doi.org/10.1145/1239451.1239497 | 10 |
| ローレンツアトラクタ | Edward Lorenz, 1963（"Deterministic Nonperiodic Flow"） | https://doi.org/10.1175/1520-0469(1963)020%3C0130:DNF%3E2.0.CO;2 | 02 |
| 流体（Stable Fluids） | Jos Stam, 1999（SIGGRAPH） | https://doi.org/10.1145/311535.311548 | o1 |
| 渦の強調（vorticity confinement） | Ronald Fedkiw, Jos Stam, Henrik Wann Jensen, 2001（SIGGRAPH "Visual Simulation of Smoke"） | https://doi.org/10.1145/383259.383260 | o1 |
| 速さに比例する空気の抵抗（指数の減速） | George Gabriel Stokes, 1851（ストークスの抵抗） | 物理の古典 | o3 |
| 温度で擬音の文字が変わる・燃える時刻を距離で決める・雨の段階 | このリポジトリのオリジナル | － | o1, o5, o6 |

## 権利について

- 数式やアルゴリズム（計算のやり方）そのものは、著作権で守られる「表現」ではありません（日本の著作権法 10条3項：プログラムの「解法」は保護の対象外）。
- コードは、このリポジトリで書き直したものです。元のコードの書き方を引き継いでいる部分（ペナーのイージング、キレスの関数）は、元のライセンスに従います（下の THIRD_PARTY_NOTICES.md）。
- 特許：Stable Fluids の特許（US 6,266,071）と、スーパーフォーミュラの特許（US 7,620,527）は、どちらも期限切れです。
- フォント：画面の文字は M PLUS Rounded 1c（Google Fonts、SIL Open Font License）。lib/glyphs.json は Noto Sans CJK JP（SIL Open Font License）の字形から作りました。

このリポジトリ自体は MIT ライセンスです（../LICENSE）。
