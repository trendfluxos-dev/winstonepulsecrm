import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PHONE_TEST_CHECKS, PhoneTestReportSchema, type PhoneTestCheck } from "@/lib/phone-test-report";
import { getMyPhoneTestReports, submitPhoneTestReport } from "@/lib/phone-test-report.functions";
import { useT } from "@/lib/i18n";

type L = { en: string; bn: string };
const LABEL: Record<PhoneTestCheck, L> = {
  install: { en: "App installed and opens", bn: "অ্যাপ ইনস্টল হয়ে খোলে" },
  signin: { en: "Sign-in works", bn: "সাইন-ইন কাজ করে" },
  call_detected: { en: "Test call shows in CRM", bn: "টেস্ট কল CRM-এ দেখায়" },
  recording_upload: { en: "Recording uploads", bn: "রেকর্ডিং আপলোড হয়" },
  rejection_report: { en: "Short rejection report works", bn: "সংক্ষিপ্ত বাতিল রিপোর্ট কাজ করে" },
  normal_report: { en: "Normal call report works", bn: "সাধারণ কল রিপোর্ট কাজ করে" },
};

/** Agent pass/fail report for the test APK; optional hand-off to IT. Never touches leads or scores. */
export function PhoneTestResultsForm() {
  const t = useT();
  const qc = useQueryClient();
  const [phoneModel, setPhoneModel] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [results, setResults] = useState<Partial<Record<PhoneTestCheck, "pass" | "fail">>>({});
  const [issue, setIssue] = useState("");
  const [sendToIt, setSendToIt] = useState(true);
  const save = useServerFn(submitPhoneTestReport);
  const list = useServerFn(getMyPhoneTestReports);
  const history = useQuery({ queryKey: ["my-phone-test-reports"], queryFn: () => list(), retry: false });
  const parsed = PhoneTestReportSchema.safeParse({ phoneModel, appVersion: appVersion || undefined, results, issue: issue || undefined, sendToIt });
  const anyFail = Object.values(results).includes("fail");
  const m = useMutation({
    mutationFn: () => save({ data: parsed.data! }),
    onSuccess: () => {
      toast.success(sendToIt ? t({ en: "Report sent to IT", bn: "রিপোর্ট IT-তে পাঠানো হয়েছে" }) : t({ en: "Report saved", bn: "রিপোর্ট সংরক্ষিত" }));
      setResults({}); setIssue("");
      void qc.invalidateQueries({ queryKey: ["my-phone-test-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return <section className="space-y-4 border-b border-border pb-6" aria-label="Phone test results">
    <h2 className="text-xl font-semibold">{t({ en: "Phone test results", bn: "ফোন টেস্ট ফলাফল" })}</h2>
    <p className="text-xs text-muted-foreground">{t({ en: "Mark each check Pass or Fail. Describe any failure and send it to IT.", bn: "প্রতিটি যাচাই পাস বা ফেল চিহ্নিত করুন। ফেল হলে সমস্যা লিখে IT-তে পাঠান।" })}</p>
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (parsed.success) m.mutate(); }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Phone model" maxLength={80} placeholder={t({ en: "Phone model", bn: "ফোন মডেল" })} value={phoneModel} onChange={(e) => setPhoneModel(e.target.value)} />
        <Input aria-label="App version" maxLength={30} placeholder={t({ en: "App version (optional)", bn: "অ্যাপ সংস্করণ (ঐচ্ছিক)" })} value={appVersion} onChange={(e) => setAppVersion(e.target.value)} />
      </div>
      <ul className="space-y-2">{PHONE_TEST_CHECKS.map((k) => <li key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
        <span>{t(LABEL[k])}</span>
        <div className="flex gap-2">{(["pass", "fail"] as const).map((v) => <Button key={v} type="button" size="sm" variant={results[k] === v ? (v === "fail" ? "destructive" : "default") : "outline"} aria-pressed={results[k] === v} onClick={() => setResults((p) => ({ ...p, [k]: v }))}>
          {v === "pass" ? t({ en: "Pass", bn: "পাস" }) : t({ en: "Fail", bn: "ফেল" })}</Button>)}</div>
      </li>)}</ul>
      <Textarea aria-label="Issue" maxLength={1000} placeholder={anyFail ? t({ en: "What failed? (required)", bn: "কী ফেল হয়েছে? (আবশ্যক)" }) : t({ en: "Other notes (optional)", bn: "অন্য নোট (ঐচ্ছিক)" })} value={issue} onChange={(e) => setIssue(e.target.value)} />
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={sendToIt} onCheckedChange={(v) => setSendToIt(v === true)} />{t({ en: "Send this report to IT", bn: "এই রিপোর্ট IT-তে পাঠান" })}</label>
      {!parsed.success && <p className="text-xs text-muted-foreground">{t({ en: "Enter the phone model, mark every check, and describe any failure.", bn: "ফোন মডেল দিন, প্রতিটি যাচাই চিহ্নিত করুন এবং ফেল হলে সমস্যা লিখুন।" })}</p>}
      <Button type="submit" disabled={!parsed.success || m.isPending}>{sendToIt ? t({ en: "Send to IT", bn: "IT-তে পাঠান" }) : t({ en: "Save report", bn: "রিপোর্ট সংরক্ষণ" })}</Button>
    </form>
    {(history.data?.length ?? 0) > 0 && <ul className="divide-y divide-border text-sm">{history.data!.map((h) => <li key={h.id} className="py-2">
      {new Date(h.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {h.phone_model}{h.app_version ? ` · v${h.app_version}` : ""} · {h.failed_count === 0 ? t({ en: "all passed", bn: "সব পাস" }) : t({ en: `${h.failed_count} failed`, bn: `${h.failed_count}টি ফেল` })}{h.sent_to_it ? ` · ${t({ en: "sent to IT", bn: "IT-তে পাঠানো" })}` : ""}
    </li>)}</ul>}
  </section>;
}
