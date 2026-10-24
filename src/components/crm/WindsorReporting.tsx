import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Lock, ShieldCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { inspectWindsorReport } from "@/lib/windsor-reporting.functions";
import { WINDSOR_REPORT_FIELDS, WindsorReportRequest, type WindsorStatus } from "@/lib/windsor-reporting";

export function WindsorReporting() {
  const t = useT();
  const adminToken = useAdminToken();
  const inspect = useServerFn(inspectWindsorReport);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<WindsorStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"range" | "access" | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = WindsorReportRequest.safeParse({ from, to, timezone: "Asia/Dhaka", fields: [...WINDSOR_REPORT_FIELDS] });
    if (!parsed.success) { setError("range"); return; }
    setError(null); setStatus(null); setPending(true);
    try { setStatus(await inspect({ data: { adminToken, report: parsed.data } })); }
    catch { setError("access"); }
    finally { setPending(false); }
  }
  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="space-y-2"><div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />{t({ bn: "শুধু রিপোর্ট · Windsor.ai", en: "Read-only reporting · Windsor.ai" })}</div><h1 className="text-2xl font-semibold">{t({ bn: "Facebook Ads রিপোর্ট", en: "Facebook Ads reports" })}</h1><p role="status" className="flex items-center gap-2 text-sm"><Lock className="size-4 text-primary" />{t({ bn: "Windsor.ai এখনও সংযুক্ত নয়", en: "Windsor.ai not connected yet" })}</p></header>
    <section className="space-y-3 border-y border-border py-5"><h2 className="text-base font-semibold">{t({ bn: "রিপোর্টের সময়কাল", en: "Reporting period" })}</h2>
      <form onSubmit={submit} className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{[{ id: "from", value: from, set: setFrom, label: { bn: "শুরুর তারিখ", en: "From" } }, { id: "to", value: to, set: setTo, label: { bn: "শেষ তারিখ", en: "To" } }].map((field) => <label key={field.id} className="space-y-1 text-sm" htmlFor={`windsor-${field.id}`}><span className="block">{t(field.label)}</span><input id={`windsor-${field.id}`} type="date" required value={field.value} onChange={(e) => { field.set(e.target.value); setStatus(null); }} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>)}</div>
      <p className="text-xs text-muted-foreground">{t({ bn: "সর্বোচ্চ ৩১ দিন, দুই তারিখসহ · Asia/Dhaka; বিজ্ঞাপন অ্যাকাউন্টের সময় অঞ্চল যাচাই বাকি।", en: "Maximum 31 inclusive days · Asia/Dhaka; ad-account timezone is not yet verified." })}</p>
      <Button type="submit" variant="outline" disabled={pending}><RefreshCw className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`} />{pending ? t({ bn: "যাচাই চলছে…", en: "Checking…" }) : t({ bn: "প্রস্তুতির অবস্থা যাচাই", en: "Check preparation status" })}</Button></form>
      {error && <p role="alert" className="text-sm text-destructive">{error === "range" ? t({ bn: "সঠিক তারিখ ও ১–৩১ দিনের সময়কাল বেছে নিন।", en: "Choose valid dates spanning 1–31 inclusive days." }) : t({ bn: "অবস্থা যাচাই হয়নি। পূর্ণ IT PIN প্রয়োজন; অনুমতি না থাকলে IT টিমকে জানান।", en: "Status could not be checked. A full IT PIN is required; contact IT if access is unavailable." })}</p>}
      {status && <p role="status" className="text-sm text-muted-foreground">{status.configured ? t({ bn: "গোপন সেটআপ আছে; রিপোর্টের ঠিকানা, অ্যাকাউন্ট ও তথ্যের ধরন যাচাই বাকি। সংযোগ বন্ধ।", en: "Secret configured; reporting endpoint, account and schema remain unverified. Connection disabled." }) : t({ bn: "WINDSOR_AI_API_KEY সেট করা নেই। সংযোগ বন্ধ।", en: "WINDSOR_AI_API_KEY is not configured. Connection disabled." })}</p>}
    </section>
    <section className="flex items-start gap-3 py-3"><BarChart3 className="mt-1 size-6 shrink-0 text-muted-foreground" /><div className="space-y-1"><h2 className="text-base font-semibold">{t({ bn: "রিপোর্ট পাওয়া যায়নি", en: "No report available" })}</h2><p className="text-sm text-muted-foreground">{t({ bn: "খরচ, ক্লিক ও ইমপ্রেশন এখনও আনা হয়নি। অ্যাকাউন্ট, মুদ্রা ও সর্বশেষ তথ্যের সময় যাচাই বাকি।", en: "Spend, clicks and impressions have not been fetched. Account, currency and data freshness remain unverified." })}</p></div></section>
    <section className="space-y-3 border-t border-border pt-5"><h2 className="text-base font-semibold">{t({ bn: "সেটআপের বাকি কাজ", en: "Remaining setup" })}</h2><ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground"><li>{t({ bn: "আগে শেয়ার করা API key বাতিল করুন। নতুন key শুধুমাত্র Project Settings → Secrets-এ WINDSOR_AI_API_KEY নামে রাখুন; চ্যাটে দেবেন না।", en: "Revoke the previously shared API key. Save a replacement only in Project Settings → Secrets as WINDSOR_AI_API_KEY; never paste it into chat." })}</li><li>{t({ bn: "Windsor.ai-তে সঠিক Facebook Ads অ্যাকাউন্ট ও শুধু রিপোর্ট পড়ার অনুমতি নিশ্চিত করুন।", en: "Confirm the intended Facebook Ads account and read-only reporting authorization in Windsor.ai." })}</li><li>{t({ bn: "অফিশিয়াল রিপোর্টের ঠিকানা, তথ্যের ধরন, মুদ্রা, সময় অঞ্চল ও অনুরোধের সীমা যাচাই দরকার। শুধু key রাখলে সংযোগ চালু হবে না।", en: "Confirm the official report endpoint, schema, currency, timezone and request limits. Saving a key alone will not enable the connection." })}</li></ol></section>
  </div>;
}