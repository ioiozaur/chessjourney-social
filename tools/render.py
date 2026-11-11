"""Render a carousel JSON file to 1080 × 1350 JPEG slides with the brand fonts.

    python3 tools/render.py content/2026-11-12-rating-ladder.json

Writes posts/<id>/01.jpg … and posts/<id>/contact.jpg (all slides side by side, for checking).
Board slides are replayed move by move first; an illegal move stops the render.
"""
import base64, functools, http.server, json, os, socketserver, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from chessboard import play, numbered  # noqa: E402


def prepare(d):
    steps = [s for s in d["slides"] if s["kind"] in ("step", "board", "point")]
    for k, s in enumerate(steps):
        s["num"], s["total"] = k + 1, len(steps)
    for s in d["slides"]:
        if s.get("moves") is not None:
            moves = s["moves"].split() if isinstance(s["moves"], str) else s["moves"]
            g = play(moves)
            s["grid"], s["last"] = g.grid(), list(g.last) if g.last else None
            s.setdefault("movesText", numbered(moves))
    d.setdefault("handle", "@chess.journey39")
    d.setdefault("series", d.get("title", "CHESS JOURNEY").upper())
    return d


def render(path):
    d = prepare(json.loads(Path(path).read_text()))
    out = ROOT / "posts" / d["id"]
    out.mkdir(parents=True, exist_ok=True)
    socketserver.TCPServer.allow_reuse_address = True
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    srv = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        exe = "/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None
        b = p.chromium.launch(executable_path=exe, args=["--no-sandbox"]) if exe else p.chromium.launch()
        pg = b.new_page()
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/studio/slides.html")
        urls = pg.evaluate("d => renderSlides(d)", d)
        b.close()
    srv.shutdown()
    if errors:
        raise SystemExit("Render errors: " + "; ".join(errors))
    files = []
    for i, u in enumerate(urls):
        f = out / f"{i + 1:02d}.jpg"
        f.write_bytes(base64.b64decode(u.split(",", 1)[1]))
        files.append(f)
    (out / "caption.txt").write_text(d.get("caption", ""))
    try:
        from PIL import Image
        ims = [Image.open(f).resize((360, 450)) for f in files]
        sheet = Image.new("RGB", (len(ims) * 370, 450), "white")
        for k, im in enumerate(ims):
            sheet.paste(im, (k * 370, 0))
        sheet.save(out / "contact.jpg", quality=85)
    except ImportError:
        pass
    print(json.dumps({"id": d["id"], "slides": [str(f.relative_to(ROOT)) for f in files]}))


if __name__ == "__main__":
    for a in sys.argv[1:]:
        render(a)
