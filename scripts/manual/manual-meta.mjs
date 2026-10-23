// `write` records version/date/hashes after a PDF build; `check` fails (exit 1) when the
// Markdown, PDF or metadata drift apart. PDF bytes include Chromium timestamps, so the
// check compares the recorded PDF hash, never a fresh re-render.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const md = readFileSync(resolve(root, "docs/CRM_OPERATIONS_MANUAL.md"));
const pdfPath = resolve(root, "public/winstone-system-manual.pdf");
const metaPath = resolve(root, "public/winstone-system-manual.json");
const text = md.toString("utf8");
const version = text.match(/manual-version:\s*([\d.]+)/)?.[1];
const updated = text.match(/manual-updated:\s*([\d-]+)/)?.[1];

if (process.argv[2] === "write") {
  const meta = { version, updated, sourceSha256: sha(md), pdfSha256: sha(readFileSync(pdfPath)) };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log(JSON.stringify(meta));
} else {
  const problems = [];
  if (!existsSync(pdfPath) || !existsSync(metaPath)) problems.push("PDF or metadata missing — run npm run manual:pdf");
  else {
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    if (meta.sourceSha256 !== sha(md)) problems.push("Manual Markdown changed since the PDF was built — run npm run manual:pdf");
    if (meta.version !== version) problems.push(`PDF is v${meta.version}, Markdown is v${version}`);
    if (meta.pdfSha256 !== sha(readFileSync(pdfPath))) problems.push("PDF file does not match recorded hash");
  }
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  console.log(`Manual PDF in sync (v${version})`);
}
