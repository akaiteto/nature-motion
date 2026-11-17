"""デモを1コマずつ撮って MP4 にする（または静止画を数枚撮る）。

使い方:
  python tools/capture.py demos/04-slime --seconds 10 --out slime.mp4
  python tools/capture.py demos/04-slime --stills 1,3,5 --out shots/   # 指定秒の静止画

必要なもの: Python の playwright（`pip install playwright` と `playwright install chromium`）、ffmpeg
ページは ?capture 付きで開くので、時間は実時間ではなくコマ単位で進む（重いデモでも滑らかに書き出せる）。
"""
import argparse, pathlib, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright

FPS = 60  # common/motion.js の刻みと同じ


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("demo")
    ap.add_argument("--seconds", type=float, default=8)
    ap.add_argument("--fps", type=int, default=30, help="書き出す動画のfps（60の約数）")
    ap.add_argument("--seed", default="1")
    ap.add_argument("--extra", default="", help="URLに足すパラメータ（例: style=real）")
    ap.add_argument("--stills", default="", help="静止画を撮る秒（カンマ区切り）")
    ap.add_argument("--out", required=True)
    ap.add_argument("--chrome", default="", help="使うChromeの実行ファイル（省略時はplaywrightのchromium）")
    a = ap.parse_args()

    page_path = pathlib.Path(a.demo).resolve() / "index.html"
    url = page_path.as_uri() + f"?capture&seed={a.seed}" + (f"&{a.extra}" if a.extra else "")
    step = FPS // a.fps

    with sync_playwright() as p:
        kw = {"executable_path": a.chrome} if a.chrome else {}
        browser = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"], **kw)
        page = browser.new_page(viewport={"width": 1280, "height": 720}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function("window.__ready === true")
        canvas = page.locator("#stage")
        page.add_style_tag(content=".back{display:none}")

        if a.stills:
            out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
            for s in [float(x) for x in a.stills.split(",")]:
                page.evaluate(f"window.__frame({round(s * FPS)})")
                canvas.screenshot(path=str(out / f"{pathlib.Path(a.demo).name}_{s:05.1f}s.png"))
        else:
            tmp = pathlib.Path(tempfile.mkdtemp())
            n = int(a.seconds * a.fps)
            for i in range(n):
                page.evaluate(f"window.__frame({(i + 1) * step})")
                canvas.screenshot(path=str(tmp / f"{i:05d}.png"))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(a.fps), "-i", str(tmp / "%05d.png"),
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", a.out], check=True)
            shutil.rmtree(tmp)
        browser.close()
        if errors:
            print("ページのエラー:", *errors, sep="\n  ")
            raise SystemExit(1)


if __name__ == "__main__":
    main()
