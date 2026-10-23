// Usage: bun scripts/check-live-release.ts  — exits 1 unless live /manual shows this release.
import { evaluateManualHtml } from "../src/lib/release-check";

const res = await fetch(`https://crm.winstonebd.com/manual?check=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
const r = evaluateManualHtml(await res.text());
console.log(`HTTP ${res.status} · live version ${r.liveVersion ?? "unknown"}`);
for (const m of r.results) console.log(`${m.ok ? "PASS" : "FAIL"} ${m.label}`);
console.log(r.deployed ? "DEPLOYED" : "NOT DEPLOYED");
process.exit(r.deployed ? 0 : 1);
