import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DeviceCallTestSchema, type DeviceCallTestInput } from "@/lib/device-call-test";
import { getMyDeviceCallTests, submitDeviceCallTest } from "@/lib/device-call-test.functions";
import { useT } from "@/lib/i18n";

type L = { en: string; bn: string };
const PERM: [string, L][] = [["granted", { en: "Allowed", bn: "অনুমতি আছে" }], ["denied", { en: "Denied", bn: "অনুমতি নেই" }], ["unknown", { en: "Not sure", bn: "নিশ্চিত নই" }]];
const OUT: [string, L][] = [["yes", { en: "Yes", bn: "হ্যাঁ" }], ["no", { en: "No", bn: "না" }], ["unsure", { en: "Not sure", bn: "নিশ্চিত নই" }]];
const NET: [string, L][] = [["wifi", { en: "Wi-Fi", bn: "ওয়াই-ফাই" }], ["mobile_data", { en: "Mobile data", bn: "মোবাইল ডেটা" }], ["offline", { en: "Offline", bn: "অফলাইন" }]];
const CALL: [string, L][] = [["sim_outgoing", { en: "SIM call out", bn: "সিম আউটগোয়িং" }], ["sim_incoming", { en: "SIM call in", bn: "সিম ইনকামিং" }], ["whatsapp", { en: "WhatsApp call", bn: "হোয়াটসঅ্যাপ কল" }]];

const EMPTY: Partial<DeviceCallTestInput> = {};

export function DeviceCallTestChecklist() {
  const t = useT();
  const qc = useQueryClient();
  const [f, setF] = useState<Partial<DeviceCallTestInput>>(EMPTY);
  const save = useServerFn(submitDeviceCallTest);
  const list = useServerFn(getMyDeviceCallTests);
  const history = useQuery({ queryKey: ["my-device-call-tests"], queryFn: () => list(), retry: false });
  const parsed = DeviceCallTestSchema.safeParse(f);
  const m = useMutation({
    mutationFn: () => save({ data: parsed.success ? parsed.data : (f as DeviceCallTestInput) }),
    onSuccess: () => { toast.success(t({ en: "Test result saved", bn: "টেস্ট ফলাফল সংরক্ষিত" })); setF(EMPTY); void qc.invalidateQueries({ queryKey: ["my-device-call-tests"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = <K extends keyof DeviceCallTestInput>(k: K, v: DeviceCallTestInput[K]) => setF(p => ({ ...p, [k]: v }));
  const choice = (k: keyof DeviceCallTestInput, label: L, opts: [string, L][]) => (
    <fieldset className="space-y-1"><legend className="text-sm font-medium">{t(label)}</legend>
      <div className="flex flex-wrap gap-2">{opts.map(([v, l]) => <Button key={v} type="button" size="sm" variant={f[k] === v ? "default" : "outline"} aria-pressed={f[k] === v} onClick={() => set(k, v as never)}>{t(l)}</Button>)}</div>
    </fieldset>);

  return <section className="space-y-4 border-b border-border pb-6" aria-label="Real-call test checklist">
    <h2 className="text-xl font-semibold">{t({ en: "Real-call test checklist", bn: "আসল কল টেস্ট চেকলিস্ট" })}</h2>
    <p className="text-xs text-muted-foreground">{t({ en: "Use a test number, not a customer. Saving this only records the test result — no lead, call report or score changes.", bn: "গ্রাহক নয়, টেস্ট নম্বরে কল করুন। এটি শুধু টেস্ট ফলাফল রাখে — কোনো লিড, কল রিপোর্ট বা স্কোর বদলায় না।" })}</p>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (parsed.success) m.mutate(); }}>
      <div><h3 className="font-medium">1. {t({ en: "Your phone", bn: "আপনার ফোন" })}</h3>
        <p className="text-xs text-muted-foreground">{t({ en: "Settings → About phone", bn: "সেটিংস → ফোন সম্পর্কে" })}</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <Input aria-label="Phone model" placeholder={t({ en: "Model (e.g. Samsung A15)", bn: "মডেল (যেমন Samsung A15)" })} value={f.phoneModel ?? ""} onChange={e => set("phoneModel", e.target.value)} />
          <Input aria-label="Android version" placeholder={t({ en: "Android version", bn: "অ্যান্ড্রয়েড সংস্করণ" })} value={f.androidVersion ?? ""} onChange={e => set("androidVersion", e.target.value)} />
          <Input aria-label="App version" placeholder={t({ en: "App version (optional)", bn: "অ্যাপ সংস্করণ (ঐচ্ছিক)" })} value={f.appVersion ?? ""} onChange={e => set("appVersion", e.target.value)} />
        </div></div>
      <div className="space-y-3"><h3 className="font-medium">2. {t({ en: "Permissions (Settings → Apps → Winstone Pulse → Permissions)", bn: "অনুমতি (সেটিংস → অ্যাপস → Winstone Pulse → অনুমতি)" })}</h3>
        {choice("permPhone", { en: "Phone", bn: "ফোন" }, PERM)}
        {choice("permCallLog", { en: "Call logs", bn: "কল লগ" }, PERM)}
        {choice("permMicrophone", { en: "Microphone", bn: "মাইক্রোফোন" }, PERM)}
        {choice("permNotifications", { en: "Notifications", bn: "নোটিফিকেশন" }, PERM)}</div>
      <div className="space-y-3"><h3 className="font-medium">3. {t({ en: "Make the test call", bn: "টেস্ট কল করুন" })}</h3>
        {choice("network", { en: "Network during the call", bn: "কলের সময় নেটওয়ার্ক" }, NET)}
        {choice("callType", { en: "Call type", bn: "কলের ধরন" }, CALL)}</div>
      <div className="space-y-3"><h3 className="font-medium">4. {t({ en: "Results (check Recorder after 2–3 minutes)", bn: "ফলাফল (২–৩ মিনিট পর রেকর্ডার দেখুন)" })}</h3>
        {choice("callDetected", { en: "Did the call appear in the CRM?", bn: "কলটি কি CRM-এ দেখা গেছে?" }, OUT)}
        {choice("recording", { en: "Does the recording play with both voices?", bn: "রেকর্ডিং কি দুই পক্ষের কণ্ঠসহ বাজে?" }, OUT)}
        {choice("summary", { en: "Did an AI summary appear?", bn: "AI সারাংশ কি এসেছে?" }, OUT)}
        <Textarea aria-label="Notes" maxLength={500} placeholder={t({ en: "Anything unusual? (optional)", bn: "অস্বাভাবিক কিছু? (ঐচ্ছিক)" })} value={f.notes ?? ""} onChange={e => set("notes", e.target.value)} /></div>
      {!parsed.success && <p className="text-xs text-muted-foreground">{t({ en: "Answer every step to save.", bn: "সংরক্ষণ করতে সব ধাপের উত্তর দিন।" })}</p>}
      <Button type="submit" disabled={!parsed.success || m.isPending}>{t({ en: "Save test result", bn: "টেস্ট ফলাফল সংরক্ষণ" })}</Button>
    </form>
    {(history.data?.length ?? 0) > 0 && <div><h3 className="font-medium">{t({ en: "Your recent tests", bn: "আপনার সাম্প্রতিক টেস্ট" })}</h3>
      <ul className="divide-y divide-border text-sm">{history.data!.map(h => <li key={h.id} className="py-2">
        <p>{new Date(h.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} · {h.phone_model} · Android {h.android_version}</p>
        <p className="text-muted-foreground">{h.call_type} · {h.network} · detected {h.call_detected} · recording {h.recording} · summary {h.summary}</p></li>)}</ul></div>}
  </section>;
}
