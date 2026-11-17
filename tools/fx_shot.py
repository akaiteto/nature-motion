"""fx のデモを、指定した秒の静止画に撮る（ローカルの http サーバー経由。ES modules のため）
使い方: python tools/fx_shot.py fx/01-fourier-maru 1,3,6 out_dir
"""
import sys, pathlib, subprocess, time, http.server, threading, functools
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
demo, secs, out = sys.argv[1], [float(s) for s in sys.argv[2].split(',')], pathlib.Path(sys.argv[3])
out.mkdir(parents=True, exist_ok=True)
Handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
Handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and errs.append(m.text))
    pg.goto(f"http://127.0.0.1:8765/{demo}/index.html?capture")
    pg.wait_for_function("window.__ready === true", timeout=30000)
    name = pathlib.Path(demo).name
    for s in secs:
        pg.evaluate(f"window.__frame({int(round(s*60))})")
        pg.wait_for_timeout(50)
        pg.locator("#wrap").screenshot(path=str(out / f"{name}_{s:04.1f}.png"))
    b.close()
    print("errors:", errs[:5])
srv.shutdown()
