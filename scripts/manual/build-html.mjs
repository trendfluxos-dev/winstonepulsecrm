// Renders docs/CRM_OPERATIONS_MANUAL.md to print-ready HTML (headings, lists, tables, page breaks)
// with embedded Noto fonts (Latin + Bengali). Deterministic: same Markdown → same HTML.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const md = readFileSync(resolve(root, "docs/CRM_OPERATIONS_MANUAL.md"), "utf8");
const version = md.match(/manual-version:\s*([\d.]+)/)?.[1];
const updated = md.match(/manual-updated:\s*([\d-]+)/)?.[1];
const font = (f) => readFileSync(resolve(root, "scripts/manual/fonts", f)).toString("base64");
const body = marked.parse(md.replace(/\s*\{#[\w-]+\}\s*$/gm, ""), { gfm: true });
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:M;src:url(data:font/ttf;base64,${font("NotoSans.ttf")})}
@font-face{font-family:M;font-weight:700;src:url(data:font/ttf;base64,${font("NotoSans-Bold.ttf")})}
@font-face{font-family:MB;src:url(data:font/ttf;base64,${font("NotoSansBengali.ttf")})}
body{font-family:M,MB,sans-serif;font-size:10.5pt;line-height:1.5;color:#222}
h1{font-size:20pt;margin:0 0 6pt} h2{font-size:13pt;margin:18pt 0 6pt;break-after:avoid}
h2{break-before:page} h2:first-of-type{break-before:auto}
li{margin:3pt 0} blockquote{color:#555;border-left:3px solid #c9a96e;margin:0;padding-left:10pt}
table{border-collapse:collapse;width:100%} td,th{border:1px solid #ccc;padding:4pt;text-align:left}
code{font-size:9.5pt}
</style></head><body><p style="font-size:9pt;color:#777">Version ${version} · ${updated}</p>${body}</body></html>`;
mkdirSync(resolve(root, "tmp-manual"), { recursive: true });
writeFileSync(resolve(root, "tmp-manual/manual.html"), html);
console.log(`HTML written for manual v${version}`);
