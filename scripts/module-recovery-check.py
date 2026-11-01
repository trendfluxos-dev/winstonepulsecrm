"""
Regression check: simulate a failed dynamic module import in a running preview
tab and verify (1) the waiting notice appears, (2) concurrent failures coalesce
into one availability probe, (3) the app reloads itself, and (4) after repeated
failed probes a clear fallback screen with a refresh button shows — never a
blank page. Local dev only; telemetry posts are stubbed so nothing is recorded.
Run: bun run test:recovery   (exit 0 = pass)
"""
import asyncio
import os
import sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
FAIL_MSG = os.environ.get("MODULE_RECOVERY_TEST_ERROR", "TypeError: Failed to fetch dynamically imported module: /src/x.tsx")


async def main():
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.route("**/api/public/telemetry/runtime-error", lambda r: r.fulfill(status=204))
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/", wait_until="networkidle", timeout=60_000)
        if errors:
            failures.append(f"fresh boot runtime errors: {errors[:2]}")

        probes = []
        probe_down = {"on": False}

        async def head(route):
            # The recovery probe is a no-store fetch of the current page; page
            # navigations (document) must pass through untouched.
            if route.request.resource_type == "fetch":
                probes.append(1)
                if probe_down["on"]:
                    await route.abort()
                    return
                await asyncio.sleep(1)
            await route.continue_()

        await page.route(BASE + "/", head)
        loads = []
        page.on("load", lambda: loads.append(1))
        await page.evaluate(
            "m => { for (let i = 0; i < 4; i++) window.dispatchEvent(new CustomEvent('winstone:module-load-error', { detail: m })); }",
            FAIL_MSG,
        )
        try:
            await page.locator("#deploy-notice").wait_for(timeout=5000)
        except Exception:
            failures.append("waiting notice (#deploy-notice) did not appear")
        await page.wait_for_timeout(4000)
        if len(probes) != 1:
            failures.append(f"expected 1 coalesced probe, got {len(probes)}")
        if not loads:
            failures.append("app did not reload after failed import")
        body = (await page.inner_text("body")).strip()
        if len(body) < 20:
            failures.append("blank page after reload")

        # Dev preview never caps reloads, so reach the fallback the way a real
        # outage does: the probe keeps failing (~2 minutes of 2s probes).
        await page.wait_for_load_state("networkidle", timeout=60_000)
        await page.wait_for_function("() => typeof window.__winstoneRecover === 'function'", timeout=30_000)
        probes.clear()
        probe_down["on"] = True
        await page.evaluate(
            "m => window.dispatchEvent(new CustomEvent('winstone:module-load-error', { detail: m }))",
            FAIL_MSG,
        )
        try:
            await page.locator("#deploy-recovery").wait_for(timeout=180_000)
            if await page.locator("#deploy-recovery button").count() == 0:
                failures.append("fallback screen has no refresh button")
            if await page.locator("#deploy-recovery a[href='/']").count() == 0:
                failures.append("fallback screen has no home link")
            await page.locator("#deploy-recovery button").click()
            probe_down["on"] = False
            await page.wait_for_url("**_fresh=*", timeout=10_000)
            await page.wait_for_load_state("networkidle", timeout=60_000)
            if await page.locator("#deploy-recovery").count():
                failures.append("fallback screen still shown after Try again")
            left = await page.evaluate("() => sessionStorage.getItem('deployment-reload-attempted:n')")
            if left:
                failures.append("Try again did not reset the reload counter")
        except Exception as e:
            failures.append(f"fallback/retry flow failed: {str(e)[:160]} (probes during outage: {len(probes)})")
        await browser.close()

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print("PASS: notice, coalesced probe, auto reload and fallback screen verified")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
