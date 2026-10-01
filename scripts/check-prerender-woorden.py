#!/usr/bin/env python3
"""Vergelijkt per route het aantal woorden in de ruwe geprerenderde HTML met
de gerenderde DOM in een echte browser. Faalt (exit 1) onder de 90%.

Gebruik: npx vite build && python3 scripts/check-prerender-woorden.py
Meldt ook hydration- en consolefouten per route.
"""
import asyncio, functools, http.server, re, sys, threading
from html import unescape
from pathlib import Path
from playwright.async_api import async_playwright

DIST = Path(__file__).resolve().parent.parent / "dist"
ROUTES = ["/", "/verzekeringen", "/offerte", "/aov", "/faq", "/diensten", "/screening",
          "/zzp-verzekering-ict", "/over-ons", "/contact", "/historie", "/kennisbank",
          "/kennisbank/verzekeringen", "/kennisbank/zelfstandigenwet-voor-zzp-ers",
          "/kennisbank/bedrijfsaansprakelijkheidsverzekering-zzp"]
NORM = 0.90
PORT = 4199


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send_head(self):
        p = self.path.split("?")[0]
        f = DIST / p.lstrip("/")
        if not f.exists() or (f.is_dir() and not (f / "index.html").exists()):
            self.path = "/index.html"  # SPA-terugval zoals de hosting
        return super().send_head()


def words(text: str) -> int:
    return len([w for w in re.split(r"\s+", text) if re.search(r"\w", w)])


def raw_words(route: str) -> int:
    f = DIST / route.lstrip("/") / "index.html" if route != "/" else DIST / "index.html"
    html = f.read_text("utf8")
    body = html.split("<body", 1)[1]
    body = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", body)
    return words(unescape(re.sub(r"<[^>]+>", " ", body)))


async def main() -> int:
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=str(DIST)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    fail = 0
    print(f"{'route':48} {'raw':>6} {'dom':>6} {'%':>5}  console")
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800}, locale="en-US")
        for route in ROUTES:
            page = await ctx.new_page()
            errs: list[str] = []
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" and re.search(r"hydrat|did not match|Minified React error #4(18|19|23|25)", m.text, re.I) else None)
            await page.goto(f"http://127.0.0.1:{PORT}{route}", wait_until="networkidle")
            await page.wait_for_timeout(1500)
            dom = await page.evaluate("""() => { const c = document.body.cloneNode(true);
                c.querySelectorAll('script,style,noscript').forEach(e => e.remove()); return c.textContent; }""")
            d, r = words(dom), raw_words(route)
            pct = r / d if d else 0
            ok = pct >= NORM and not errs
            fail += 0 if ok else 1
            print(f"{route:48} {r:6} {d:6} {pct*100:4.0f}%  {'OK' if not errs else 'HYDRATIE: ' + errs[0][:80]}{'' if ok else '  <-- FAALT'}")
            await page.close()
        await b.close()
    srv.shutdown()
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
