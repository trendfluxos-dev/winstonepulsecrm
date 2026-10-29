import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDeviceCompatibilityReport } from "@/lib/call-diagnostics.functions";
import { getAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

export function DeviceCompatibilityReport() {
  const t = useT();
  const read = useServerFn(getDeviceCompatibilityReport);
  const q = useQuery({ queryKey: ["device-compat-report"], queryFn: () => read({ data: { adminToken: getAdminToken() } }), retry: false, staleTime: 120_000 });
  const rows = q.data?.rows ?? [];
  return <section className="space-y-4 border-b border-border pb-6" aria-label="Android compatibility report">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">{t({ en: "Android compatibility by phone", bn: "ফোন অনুযায়ী অ্যান্ড্রয়েড সামঞ্জস্য" })}</h2>
      <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" />{t({ en: "Refresh", bn: "আবার দেখুন" })}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t({ en: "HQ/IT only · last 30 days · phone model and Android version totals, no agent or customer details. Detected = call synced from that phone; Recorded = upload confirmed; Summary = AI summary saved. Technical diagnostics, never a performance score.", bn: "শুধু HQ/IT · গত ৩০ দিন · ফোন মডেল ও অ্যান্ড্রয়েড সংস্করণভিত্তিক মোট, এজেন্ট বা গ্রাহকের তথ্য নেই। শনাক্ত = ফোন থেকে কল সিঙ্ক; রেকর্ড = আপলোড নিশ্চিত; সারাংশ = AI সারাংশ সংরক্ষিত। এটি পারফরম্যান্স স্কোর নয়।" })}</p>
    {q.isLoading && <p role="status">{t({ en: "Loading…", bn: "তথ্য আসছে…" })}</p>}
    {q.isError && <p role="alert" className="text-destructive">{q.error.message}</p>}
    {q.data?.truncated && <p role="alert" className="text-sm text-destructive">{t({ en: "Row limit reached — totals may be incomplete.", bn: "সীমা পূর্ণ — মোট অসম্পূর্ণ হতে পারে।" })}</p>}
    {q.data && !rows.length && <p className="text-muted-foreground">{t({ en: "No Android phones registered yet.", bn: "এখনো কোনো অ্যান্ড্রয়েড ফোন নিবন্ধিত নেই।" })}</p>}
    {rows.length > 0 && <>
      <ul className="space-y-2 md:hidden">{rows.map(r => <li key={r.key} className="rounded-md border border-border p-3 text-sm">
        <p className="font-medium">{r.manufacturer} {r.model} · Android {r.androidVersion}</p>
        <p>{r.devices} {t({ en: "phones", bn: "ফোন" })} · {t({ en: "Detected", bn: "শনাক্ত" })} {r.callsDetected}</p>
        <p>{t({ en: "Recorded", bn: "রেকর্ড" })} {r.recordingsUploaded} ({pct(r.recordingRate)}) · {t({ en: "Summary", bn: "সারাংশ" })} {r.summariesSaved} ({pct(r.summaryRate)}) · {t({ en: "Failed", bn: "ব্যর্থ" })} {r.summariesFailed}</p>
        <p className="text-xs text-muted-foreground">{t({ en: "Phone-reported capable/tested", bn: "ফোনের রিপোর্ট সক্ষম/পরীক্ষিত" })}: {r.reportedCapable}/{r.reportedTested}</p>
      </li>)}</ul>
      <div className="hidden md:block table-scroll"><table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-2">{t({ en: "Phone", bn: "ফোন" })}</th><th>Android</th><th>{t({ en: "Phones", bn: "সংখ্যা" })}</th><th>{t({ en: "Detected", bn: "শনাক্ত" })}</th><th>{t({ en: "Recorded", bn: "রেকর্ড" })}</th><th>{t({ en: "Summary", bn: "সারাংশ" })}</th><th>{t({ en: "Failed", bn: "ব্যর্থ" })}</th><th>{t({ en: "Capable/tested", bn: "সক্ষম/পরীক্ষিত" })}</th></tr></thead>
        <tbody className="divide-y divide-border">{rows.map(r => <tr key={r.key}><td className="py-2">{r.manufacturer} {r.model}</td><td>{r.androidVersion}</td><td>{r.devices}</td><td>{r.callsDetected}</td><td>{r.recordingsUploaded} ({pct(r.recordingRate)})</td><td>{r.summariesSaved} ({pct(r.summaryRate)})</td><td>{r.summariesFailed}</td><td>{r.reportedCapable}/{r.reportedTested}</td></tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
