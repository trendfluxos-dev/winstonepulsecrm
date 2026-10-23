# Prints tmp-manual/manual.html to public/winstone-system-manual.pdf with headless Chromium (real Bangla shaping).
import asyncio, pathlib
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()
        await page.goto((ROOT / "tmp-manual/manual.html").as_uri())
        await page.evaluate("document.fonts.ready")
        await page.pdf(path=str(ROOT / "public/winstone-system-manual.pdf"), format="A4",
                       margin={"top": "18mm", "bottom": "18mm", "left": "16mm", "right": "16mm"},
                       display_header_footer=True, header_template="<span></span>",
                       footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#888">Winstone Pulse — CRM Operations Manual · <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
        await b.close()

asyncio.run(main())
