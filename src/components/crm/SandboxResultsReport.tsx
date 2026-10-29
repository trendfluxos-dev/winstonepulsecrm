import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { parseSandboxResults, type CheckResult, type SandboxReport } from "@/lib/sandbox-results";
import { useT } from "@/lib/i18n";

const badge = (r: CheckResult) => r === "pass" ? <Badge>PASS</Badge> : r === "fail" ? <Badge variant="destructive">FAIL</Badge> : <Badge variant="outline">NOT RUN</Badge>;

export function SandboxResultsReport() {
  const t = useT();
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function onFile(file: File | undefined) {
    setReport(null); setError(null);
    if (!file) return;
    if (file.size > 1_000_000) { setError("File too large for a sandbox results file."); return; }
    try { setReport(parseSandboxResults(await file.text())); } catch (e) { setError((e as Error).message); }
  }
  return <section className="space-y-3 border-b border-border pb-6" aria-label="Sandbox results report">
    <h2 className="text-xl font-semibold">{t({ en: "Sandbox app results", bn: "স্যান্ডবক্স অ্যাপের ফলাফল" })}</h2>
    <p className="text-xs text-muted-foreground">{t({ en: "Choose winstone-sandbox-results.json from the sandbox app. It is read on this device only — nothing is uploaded or saved.", bn: "স্যান্ডবক্স অ্যাপের winstone-sandbox-results.json বেছে নিন। এটি শুধু এই ডিভাইসে পড়া হয় — কিছু আপলোড বা সংরক্ষণ হয় না।" })}</p>
    <Input type="file" accept="application/json,.json" aria-label="Sandbox results file" onChange={e => void onFile(e.target.files?.[0])} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {report && <div className="space-y-2">
      <p className="flex items-center gap-2 font-medium">{t({ en: "Overall", bn: "সামগ্রিক" })}: {badge(report.overall)}</p>
      <p className="text-xs text-muted-foreground">{t({ en: "Tested", bn: "পরীক্ষার সময়" })}: {new Date(report.checkedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} Dhaka</p>
      <ul className="divide-y divide-border text-sm">{report.checks.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-2"><span><span className="font-medium">{c.label}</span><span className="block text-xs text-muted-foreground">{c.detail}</span></span>{badge(c.result)}</li>)}</ul>
      <p className="text-xs text-muted-foreground">{t({ en: "Sandbox uses a fake lead and a simulated summary; a pass here does not prove live CRM sync or two-sided call audio.", bn: "স্যান্ডবক্সে নকল লিড ও সিমুলেটেড সারাংশ ব্যবহৃত হয়; এখানে পাস মানে লাইভ CRM সিঙ্ক বা দুই পক্ষের অডিও প্রমাণিত নয়।" })}</p>
    </div>}
  </section>;
}
