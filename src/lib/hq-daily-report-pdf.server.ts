/**
 * Builds the Bangla HQ daily report PDF (server only).
 * pdf-lib + fontkit shape Bangla conjuncts; text is drawn in per-script runs
 * because fontkit picks one shaping script per string.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import regularFont from "@/assets/fonts/HindSiliguri-Regular.ttf?inline";
import boldFont from "@/assets/fonts/HindSiliguri-SemiBold.ttf?inline";
import { bnDate, bnNum, hqTotals, scriptRuns, sortAgentRows, type AgentDayRow } from "@/lib/hq-daily-report";

const INK = rgb(0.13, 0.12, 0.1);
const MUTED = rgb(0.42, 0.4, 0.36);
const GOLD = rgb(0.72, 0.59, 0.35);
const RULE = rgb(0.89, 0.87, 0.82);
const BAND = rgb(0.98, 0.97, 0.95);

function dataUriBytes(uri: string): Uint8Array {
  const b64 = uri.slice(uri.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function ensureRegenerator() {
  const g = globalThis as { regeneratorRuntime?: unknown };
  if (!g.regeneratorRuntime) {
    const mod = (await import("regenerator-runtime/runtime")) as { default?: unknown };
    g.regeneratorRuntime ??= mod.default ?? mod;
  }
}

function widthOf(text: string, font: PDFFont, size: number) {
  return scriptRuns(text).reduce((w, r) => w + font.widthOfTextAtSize(r.text, size), 0);
}

function draw(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = INK, align: "left" | "right" | "center" = "left") {
  const total = widthOf(text, font, size);
  let cx = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  for (const run of scriptRuns(text)) {
    page.drawText(run.text, { x: cx, y, size, font, color });
    cx += font.widthOfTextAtSize(run.text, size);
  }
}

export async function buildHqDailyReportPdf(input: { day: string; rows: AgentDayRow[]; generatedAt: Date; sample?: boolean }): Promise<Uint8Array> {
  await ensureRegenerator();
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Winstone Pulse দৈনিক রিপোর্ট ${input.day}`);
  const reg = await doc.embedFont(dataUriBytes(regularFont), { subset: true });
  const bold = await doc.embedFont(dataUriBytes(boldFont), { subset: true });

  const W = 595, H = 842, M = 40;
  const rows = sortAgentRows(input.rows);
  const t = hqTotals(rows);
  const time = input.generatedAt.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" });

  let page = doc.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];

  draw(page, "WINSTONE PULSE CRM", M, y - 10, bold, 10, GOLD);
  draw(page, `দৈনিক কাজের রিপোর্ট ও সারাংশ${input.sample ? " (নমুনা)" : ""}`, M, y - 34, bold, 20);
  draw(page, `${bnDate(input.day)} · তৈরি: ${bnNum(time)} (ঢাকা সময়)`, M, y - 54, reg, 11, MUTED);
  page.drawRectangle({ x: M, y: y - 66, width: W - 2 * M, height: 1.5, color: GOLD });
  y -= 90;

  const cards: Array<[string, number]> = [
    ["বরাদ্দকৃত নতুন লিড", t.received], ["জমা দেওয়া রিপোর্ট", t.reports],
    ["যাচাইকৃত সংযুক্ত কল", t.verifiedConnected], ["নতুন ফলো-আপ", t.newFollowUps], ["সক্রিয় এজেন্ট", t.activeAgents],
  ];
  const cw = (W - 2 * M - 4 * 8) / 5;
  cards.forEach(([label, value], i) => {
    const x = M + i * (cw + 8);
    page.drawRectangle({ x, y: y - 58, width: cw, height: 62, color: BAND, borderColor: RULE, borderWidth: 1 });
    draw(page, bnNum(value), x + 10, y - 26, bold, 20);
    draw(page, label, x + 10, y - 46, reg, 8.5, MUTED);
  });
  y -= 86;

  const cols = [
    { label: "#", x: M + 6, align: "left" as const },
    { label: "এজেন্ট", x: M + 30, align: "left" as const },
    { label: "নতুন লিড", x: M + 300, align: "right" as const },
    { label: "রিপোর্ট", x: M + 370, align: "right" as const },
    { label: "যাচাইকৃত সংযুক্ত", x: M + 450, align: "right" as const },
    { label: "নতুন ফলো-আপ", x: W - M - 6, align: "right" as const },
  ];
  const header = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: M, y: yy - 8, width: W - 2 * M, height: 24, color: INK });
    for (const c of cols) draw(p, c.label, c.x, yy, bold, 9.5, rgb(1, 1, 1), c.align);
  };
  draw(page, "এজেন্টভিত্তিক বিস্তারিত", M, y, bold, 13);
  y -= 26;
  header(page, y);
  y -= 26;

  if (rows.length === 0) {
    draw(page, "আজ কোনো সক্রিয় এজেন্টের তথ্য পাওয়া যায়নি।", M + 6, y, reg, 10, MUTED);
    y -= 22;
  }
  rows.forEach((r, i) => {
    if (y < M + 60) {
      page = doc.addPage([W, H]); pages.push(page); y = H - M - 10;
      header(page, y); y -= 26;
    }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 7, width: W - 2 * M, height: 22, color: BAND });
    const vals = [bnNum(i + 1), r.name, bnNum(r.received), bnNum(r.reports), bnNum(r.verifiedConnected), bnNum(r.newFollowUps)];
    cols.forEach((c, k) => draw(page, vals[k] ?? "", c.x, y, k === 1 ? bold : reg, 10, INK, c.align));
    y -= 22;
  });

  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: M + 14, width: W - 2 * M, height: 0.8, color: RULE });
    draw(p, "শুধু সংখ্যা — গ্রাহকের নাম বা ফোন নম্বর এই রিপোর্টে নেই। \"যাচাইকৃত সংযুক্ত\" = ফোনের কল-লগে প্রমাণিত সংযুক্ত কল।", M, M, reg, 7.5, MUTED);
    draw(p, `পৃষ্ঠা ${bnNum(i + 1)}/${bnNum(pages.length)}`, W - M, M, reg, 7.5, MUTED, "right");
  });
  return doc.save();
}
