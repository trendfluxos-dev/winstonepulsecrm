import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyCallDiagnostics } from "@/lib/call-diagnostics.functions";
import { useT } from "@/lib/i18n";
const time = (value: string) => new Date(value).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
export function CallDiagnosticsPanel() {
  const t = useT();
  const read = useServerFn(getMyCallDiagnostics);
  const q = useQuery({ queryKey: ["my-call-diagnostics"], queryFn: () => read(), retry: false, staleTime: 60_000 });
  return <section className="space-y-4 border-b border-border pb-6" aria-label="Call diagnostics">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{t({ en: "Call diagnostics", bn: "কল ডায়াগনস্টিক্স" })}</h2><Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className="size-4" />{t({ en: "Refresh", bn: "আবার দেখুন" })}</Button></div>
    {q.isLoading && <p role="status">{t({ en: "Loading…", bn: "তথ্য আসছে…" })}</p>}
    {q.isError && <p role="alert" className="text-destructive">{q.error.message}</p>}
    {q.data && <>
      <p className="text-xs text-muted-foreground">{time(q.data.checkedAt)} Dhaka · {t({ en: "Your account only · technical diagnostics, not performance", bn: "শুধু আপনার অ্যাকাউন্ট · কারিগরি তথ্য, পারফরম্যান্স নয়" })}</p>
      <div className="space-y-2"><h3 className="font-medium">{t({ en: "Android call-log access", bn: "অ্যান্ড্রয়েড কল-লগ অনুমতি" })}</h3><p>{t({ en: "Unknown — current call-log permission is not reported to CRM. Browser microphone permission is separate.", bn: "অজানা — বর্তমান কল-লগ অনুমতি CRM-এ রিপোর্ট হয় না। ব্রাউজারের মাইক্রোফোন অনুমতি আলাদা।" })}</p></div>
      <h3 className="font-medium">{t({ en: "Registered devices (latest 10)", bn: "নিবন্ধিত ডিভাইস (শেষ ১০টি)" })}</h3>
      {!q.data.devices.length && <p className="text-muted-foreground">{t({ en: "No active device registration found.", bn: "সক্রিয় ডিভাইস নিবন্ধন পাওয়া যায়নি।" })}</p>}
      <ul className="divide-y divide-border">{q.data.devices.map(d => <li key={d.id} className="space-y-1 py-2 text-sm"><p>{d.platform} · {d.app_version ?? "Version unknown"}</p><p>{t({ en: "Reported recording capability", bn: "রিপোর্ট করা রেকর্ডিং সক্ষমতা" })}: {d.recording_capable === null ? "Unknown" : d.recording_capable ? "Yes" : "No"} · {d.recording_mode ?? "Mode unknown"}</p><p className="text-xs text-muted-foreground">Last seen: {time(d.last_seen_at)} Dhaka{d.recording_checked_at ? ` · Checked: ${time(d.recording_checked_at)} Dhaka` : " · Capability check time unknown"}</p></li>)}</ul>
      <h3 className="font-medium">{t({ en: "Recording & summary status (latest 30 rows)", bn: "রেকর্ডিং ও সারাংশের অবস্থা (শেষ ৩০টি রেকর্ড)" })}</h3>
      <p className="text-xs text-muted-foreground">{t({ en: "Saved upload evidence does not verify playback or both sides of a call. No audio or AI processing is started here.", bn: "সংরক্ষিত আপলোডের তথ্য অডিও শোনা বা উভয় পক্ষের কণ্ঠ নিশ্চিত করে না। এখানে অডিও বা AI কাজ শুরু হয় না।" })}</p>
      {!q.data.recordings.length && <p className="text-muted-foreground">{t({ en: "No scoped recording records returned.", bn: "আপনার আওতায় রেকর্ডিং তথ্য পাওয়া যায়নি।" })}</p>}
      <ul className="divide-y divide-border">{q.data.recordings.map(r => <li key={r.id} className="space-y-1 py-2 text-sm"><p>{time(r.createdAt)} Dhaka</p><p>{t({ en: "Recording", bn: "রেকর্ডিং" })}: {r.recording === "upload_recorded" ? "Upload recorded" : r.recording === "file_reference_only" ? "File reference only — upload unconfirmed" : "No file recorded"}</p><p>{t({ en: "Summary", bn: "সারাংশ" })}: {r.summary === "saved" ? "Saved" : r.summary === "processing" ? "Processing" : r.summary === "failed" ? "Failed" : "Not saved"}</p></li>)}</ul>
    </>}
  </section>;
}