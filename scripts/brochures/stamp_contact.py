"""Stamp the sales contact block + bilingual call-to-action onto each one-page brochure.

Usage: python3 scripts/brochures/stamp_contact.py <in_dir> <out_dir>
The block sits in the empty strip above the existing "View project online / Talk to Winstone"
footer (y 719–755pt from the top on every brochure). The phone number is deliberately absent
until the owner supplies the official one — never invent contact details.
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
from pypdf import PdfReader, PdfWriter

FONTS = Path(__file__).resolve().parents[1] / "manual" / "fonts"
EMAILS = ["info@winstonebd.com", "support@winstonebd.com"]
CTA_BN = "আজই সাইট ভিজিট বুক করুন — বিস্তারিত জানতে ইমেইল করুন"
CTA_EN = "Book your site visit today — email us for details"

HTML = f"""<!doctype html><html><head><style>
@font-face {{ font-family: NB; src: url('file://{FONTS}/NotoSansBengali.ttf'); }}
@font-face {{ font-family: NS; src: url('file://{FONTS}/NotoSans.ttf'); }}
@font-face {{ font-family: NS; font-weight: 700; src: url('file://{FONTS}/NotoSans-Bold.ttf'); }}
@page {{ size: 595.28pt 841.89pt; margin: 0; }}
html, body {{ margin: 0; background: transparent; }}
.band {{ position: absolute; left: 34pt; right: 34pt; top: 719pt; height: 36pt; box-sizing: border-box;
  border-top: 0.6pt solid rgb(175,145,48); padding-top: 4pt; display: flex; justify-content: space-between;
  align-items: flex-start; gap: 10pt; font-family: NS, NB, sans-serif; color: rgb(245,242,234); }}
.cta b {{ display: block; font-family: NB, NS; font-size: 9.5pt; line-height: 1.25; color: rgb(210,173,53); font-weight: 600; }}
.cta span {{ display: block; font-size: 8pt; line-height: 1.3; }}
.mail {{ text-align: right; font-size: 8pt; line-height: 1.35; white-space: nowrap; }}
.mail i {{ font-style: normal; color: rgb(175,145,48); }}
</style></head><body><div class="band">
<div class="cta"><b>{CTA_BN}</b><span>{CTA_EN}</span></div>
<div class="mail"><i>Email</i> {EMAILS[0]}<br><i>Support</i> {EMAILS[1]}</div>
</div></body></html>"""

async def overlay(path: Path):
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()
        await page.set_content(HTML, wait_until="networkidle")
        await page.evaluate("document.fonts.ready")
        await page.pdf(path=str(path), prefer_css_page_size=True, print_background=False)
        await b.close()

def main(src: str, dst: str):
    out = Path(dst); out.mkdir(parents=True, exist_ok=True)
    ov = out / "_overlay.pdf"
    asyncio.run(overlay(ov))
    stamp = PdfReader(ov).pages[0]
    for f in sorted(Path(src).glob("*.pdf")):
        r = PdfReader(f); w = PdfWriter()
        for i, pg in enumerate(r.pages):
            if i == 0: pg.merge_page(stamp)
            w.add_page(pg)
        w.write(out / f.name)
        print("stamped", f.name)
    ov.unlink()

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
