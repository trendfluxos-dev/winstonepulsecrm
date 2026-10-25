import { Link } from "@tanstack/react-router";
import { Copy, ExternalLink, FlaskConical, Lock, Play, RotateCcw, ShieldCheck, Webhook } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { integrationPreparation } from "@/lib/integration-readiness";
import { useT } from "@/lib/i18n";
import { META_CALLBACK_URL, META_SIMULATOR_CASES, simulateMetaEvent, type MetaSimulatorCase, type SimulationLedger, type SimulationResult } from "@/lib/meta-control-center";

const scenarios = {
  valid: { bn: "নতুন নমুনা event", en: "New synthetic event" },
  duplicate: { bn: "একই event আবার", en: "Duplicate replay" },
  conflict: { bn: "একই ID, ভিন্ন payload", en: "Same ID, changed payload" },
  invalid_signature: { bn: "ভুল signature", en: "Invalid signature" },
  invalid_payload: { bn: "ভুল payload", en: "Invalid payload" },
};
const results: Record<SimulationResult["code"], { bn: string; en: string }> = {
  SIMULATED_NEW_EVENT: { bn: "নমুনা event-এর local receipt তৈরি হয়েছে; কোনো বাস্তব মেসেজ বা লিড নয়।", en: "A local synthetic receipt was created; this is not a real message or lead." },
  SIMULATED_DUPLICATE: { bn: "নমুনা duplicate শনাক্ত; দ্বিতীয় receipt তৈরি হয়নি।", en: "Synthetic duplicate detected; no second receipt created." },
  SIMULATED_CONFLICT: { bn: "একই নমুনা ID-এর payload বদলেছে; conflict প্রত্যাখ্যাত, আগের receipt অপরিবর্তিত।", en: "The synthetic ID was reused with changed payload; conflict rejected, original receipt preserved." },
  SIMULATED_INVALID_SIGNATURE: { bn: "নমুনা signature gate-এ প্রত্যাখ্যাত; payload process হয়নি।", en: "Rejected at the simulated signature gate; payload was not processed." },
  SIMULATED_INVALID_PAYLOAD: { bn: "নমুনা payload validation-এ প্রত্যাখ্যাত; receipt তৈরি হয়নি।", en: "Rejected by synthetic payload validation; no receipt created." },
};

export function MetaControlCenter() {
  const t = useT();
  const prep = integrationPreparation();
  const [scenario, setScenario] = useState<MetaSimulatorCase>("valid");
  const [ledger, setLedger] = useState<SimulationLedger>({});
  const [events, setEvents] = useState<SimulationResult[]>([]);
  const [pending, setPending] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [failed, setFailed] = useState(false);
  async function run() {
    setPending(true); setFailed(false);
    try {
      const output = await simulateMetaEvent(scenario, ledger);
      setLedger(output.ledger);
      setEvents(items => [output.result, ...items].slice(0, 10));
    } catch { setFailed(true); }
    finally { setPending(false); }
  }
  async function copyCallback() {
    try { await navigator.clipboard.writeText(META_CALLBACK_URL); setCopyState("copied"); }
    catch { setCopyState("failed"); }
  }
  return <div className="mx-auto max-w-6xl space-y-7">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div><p className="text-xs font-medium text-gold-ink">Winstone Pulse · TechOps</p><h1 className="mt-2 text-2xl font-semibold">Meta Integration &amp; Webhook Control Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t({ bn: "Page, অনুমতি ও webhook-এর প্রস্তুতি; বাস্তব সংযোগ এখনও অযাচাইকৃত।", en: "Page, permission and webhook preparation; real connectivity remains unverified." })}</p></div>
      <Badge variant="outline"><Lock className="mr-1 size-3" />{t({ bn: "লাইভ মেসেজ বন্ধ", en: "Live ingestion disabled" })}</Badge>
    </header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { title: { bn: "Facebook Page", en: "Facebook Page" }, detail: { bn: "পরিচয় ও consent যাচাই বাকি", en: "Identity and consent unverified" } },
        { title: { bn: "Meta App", en: "Meta App" }, detail: { bn: "App Review ও Live mode যাচাই বাকি", en: "App Review and Live mode unverified" } },
        { title: { bn: "Webhook", en: "Webhook" }, detail: { bn: "Signed POST প্রস্তুত; handshake বন্ধ", en: "Signed POST prepared; handshake disabled" } },
        { title: { bn: "সর্বশেষ বাস্তব পরীক্ষা", en: "Last real check" }, detail: { bn: "কোনো সংরক্ষিত যাচাইয়ের প্রমাণ নেই", en: "No recorded verification evidence" } },
      ].map(item => <article key={item.title.en} className="rounded-md border border-border bg-card p-4"><h2 className="text-sm font-medium">{t(item.title)}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{t(item.detail)}</p></article>)}
    </div>
    <p className="flex items-start gap-2 border-l-2 border-gold bg-secondary p-4 text-sm leading-6"><ShieldCheck className="mt-1 size-4 shrink-0 text-gold-ink" /><span>{t(prep.verification.messenger.reason)}</span></p>
    <Tabs defaultValue="configuration">
      <TabsList className="h-auto w-full" aria-label={t({ bn: "Control Center বিভাগ", en: "Control Center sections" })}>
        <TabsTrigger value="configuration">{t({ bn: "Webhook সেটআপ", en: "Webhook setup" })}</TabsTrigger>
        <TabsTrigger value="permissions">{t({ bn: "অনুমতি", en: "Permissions" })}</TabsTrigger>
        <TabsTrigger value="diagnostics">{t({ bn: "বাস্তব diagnostics", en: "Real diagnostics" })}</TabsTrigger>
        <TabsTrigger value="simulator"><FlaskConical className="mr-2 size-4" />{t({ bn: "নমুনা simulator", en: "Synthetic simulator" })}</TabsTrigger>
      </TabsList>
      <TabsContent value="configuration" className="space-y-6 pt-5">
        <section><h2 className="flex items-center gap-2 text-lg font-semibold"><Webhook className="size-5 text-gold-ink" />{t({ bn: "নির্ধারিত callback", en: "Planned callback" })}</h2><div className="mt-3 flex flex-wrap items-center gap-3 border-y border-border py-4"><code className="min-w-0 flex-1 break-all text-sm">{META_CALLBACK_URL}</code><Button variant="outline" size="icon" aria-label={t({ bn: "Callback URL কপি", en: "Copy callback URL" })} title={t({ bn: "Callback URL কপি", en: "Copy callback URL" })} onClick={copyCallback}><Copy /></Button></div>{copyState !== "idle" && <p role="status" className="mt-2 text-xs text-muted-foreground">{t(copyState === "copied" ? { bn: "URL কপি হয়েছে।", en: "URL copied." } : { bn: "কপি হয়নি; উপরের URL নির্বাচন করুন।", en: "Copy failed; select the URL above." })}</p>}<p className="mt-3 text-sm leading-6 text-muted-foreground">{t({ bn: "এখন কার্যকর webhook হিসেবে নিবন্ধন করবেন না: GET challenge ও বার্তা গ্রহণ বন্ধ। URL কপি কোনো সংযোগ চালু করে না।", en: "Do not register this as a working webhook yet: GET challenge and ingestion remain disabled. Copying the URL does not activate it." })}</p></section>
        <section><h2 className="text-lg font-semibold">{t({ bn: "নিরাপদ গ্রহণের ধাপ", en: "Safe receipt pipeline" })}</h2><ol className="mt-4 grid gap-4 sm:grid-cols-2">{[
          { bn: "১. Raw body সর্বোচ্চ 262144 bytes; X-Hub-Signature-256 যাচাই প্রথমে।", en: "1. Raw body bounded to 262144 bytes; verify X-Hub-Signature-256 first." },
          { bn: "২. Signature মেলার পরে UTF-8 ও bounded Page event payload যাচাই।", en: "2. After signature verification, validate UTF-8 and bounded Page event structure." },
          { bn: "৩. Durable receipt ও atomic duplicate/conflict handling না থাকলে ingestion প্রত্যাখ্যান।", en: "3. Refuse ingestion until durable receipts and atomic duplicate/conflict handling exist." },
          { bn: "৪. প্রকৃত বার্তা review-এর পর canonical intake; লিড unassigned, বরাদ্দ শুধু LeadHub-এ।", en: "4. Review genuine messages before canonical intake; leads stay unassigned, assignment only through LeadHub." },
        ].map(item => <li key={item.en} className="border-b border-border pb-4 text-sm leading-7">{t(item)}</li>)}</ol></section>
        <section className="border-t border-border pt-5"><h2 className="text-sm font-semibold">{t({ bn: "গোপন মান শুধু সার্ভারে", en: "Credentials stay server-side" })}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{t({ bn: "App Secret, Page token ও verify token-এর কোনো input বা মান এখানে নেই। পুরোনো উন্মুক্ত মান Meta-তে বাতিল করে শুধু managed secret form-এ replacement দিন; এই পাতায় কোনো secret বদল হয় না।", en: "No App Secret, Page token or verify-token input or value appears here. Revoke exposed credentials in Meta and replace them only through the managed secret form; this page changes no secrets." })}</p></section>
      </TabsContent>
      <TabsContent value="permissions" className="space-y-5 pt-5">
        <h2 className="text-lg font-semibold">{t({ bn: "প্রমাণের checklist", en: "Evidence checklist" })}</h2>
        {[
          { label: "App Review · pages_messaging", detail: { bn: "প্রয়োজনীয় access tier ও App Review-এর Meta-side প্রমাণ দরকার।", en: "Meta-side evidence of the required access tier and App Review is needed." } },
          { label: "App Live mode", detail: { bn: "Marketing API ইমেইল App Live বা Messenger approval-এর প্রমাণ নয়।", en: "A Marketing API email does not prove Live mode or Messenger approval." } },
          { label: "Page consent · messaging access", detail: { bn: "প্রকৃত Page ও অনুমোদিত ব্যক্তির messaging access যাচাই করুন; শুধু admin নাম যথেষ্ট নয়।", en: "Verify the actual Page and authorized person’s messaging access; an admin label alone is insufficient." } },
          { label: "App + Page · messages subscription", detail: { bn: "উভয় স্তরে subscription ও সফল signed durable test receipt দরকার।", en: "Both subscription levels and a successful signed, durable test receipt are required." } },
        ].map(item => <div key={item.label} className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4"><div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{item.label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{t(item.detail)}</p></div><Badge variant="outline">{t({ bn: "অযাচাইকৃত", en: "Unverified" })}</Badge></div>)}
        <p className="text-sm leading-7 text-muted-foreground">{t({ bn: "প্রোফাইল sign-in ব্যক্তিগত Messenger পড়ার অনুমতি নয়। এই Control Center role, PIN বা agent ownership পরিবর্তন করে না।", en: "Profile sign-in does not grant personal Messenger access. This Control Center does not change roles, PINs or agent ownership." })}</p>
      </TabsContent>
      <TabsContent value="diagnostics" className="space-y-5 pt-5">
        <h2 className="text-lg font-semibold">{t({ bn: "বাস্তব event-এর প্রমাণ নেই", en: "No real event evidence" })}</h2>
        <p className="text-sm leading-7 text-muted-foreground">{t({ bn: "সফল receipt, শেষ delivery সময় ও real event count জানা নেই। এই পাতায় provider পরীক্ষা, secret inventory বা production event read হয় না।", en: "Successful receipts, last delivery time and real event counts are unknown. This page performs no provider checks, secret inventory or production event reads." })}</p>
        <dl className="grid gap-4 border-y border-border py-5 sm:grid-cols-2">{[
          ["401", { bn: "Signature নেই বা মেলেনি", en: "Missing or invalid signature" }],
          ["413", { bn: "Raw body সীমার বেশি", en: "Raw body exceeds limit" }],
          ["400", { bn: "Body/payload পড়া বা যাচাই ব্যর্থ", en: "Body/payload read or validation failure" }],
          ["503", { bn: "সেটআপ অনুপস্থিত অথবা durable ingestion প্রস্তুত নয়", en: "Configuration missing or durable ingestion not ready" }],
        ].map(([code, detail]) => <div key={String(code)}><dt className="font-mono text-sm font-medium">{String(code)}</dt><dd className="mt-1 text-sm text-muted-foreground">{t(detail as { bn: string; en: string })}</dd></div>)}</dl>
        <Button asChild variant="outline"><Link to="/integrations">{t({ bn: "সব সংযোগের অবস্থা", en: "All integration status" })}<ExternalLink /></Link></Button>
      </TabsContent>
      <TabsContent value="simulator" className="space-y-5 pt-5">
        <div className="flex items-start gap-3 border-l-2 border-gold bg-secondary p-4"><FlaskConical className="size-5 shrink-0 text-gold-ink" /><div><h2 className="text-lg font-semibold">{t({ bn: "শুধু নমুনা পরীক্ষা", en: "Synthetic tests only" })}</h2><p className="mt-1 text-sm leading-7 text-muted-foreground">{t({ bn: "স্থির কৃত্রিম preset; কোনো নাম, ফোন, token বা আসল payload লিখবেন না। ফল কেবল এই tab-এর memory-তে; CRM, webhook ও LeadHub-এ পাঠানো হয় না।", en: "Fixed synthetic presets; no names, phones, tokens or real payload input. Results remain in this tab’s memory; nothing is sent to the CRM, webhook or LeadHub." })}</p></div></div>
        <div className="flex flex-wrap items-end gap-3"><div className="w-full max-w-sm"><label className="mb-2 block text-sm font-medium">{t({ bn: "নমুনা পরিস্থিতি", en: "Synthetic scenario" })}</label><Select value={scenario} onValueChange={value => { if (META_SIMULATOR_CASES.some(item => item === value)) setScenario(value as MetaSimulatorCase); }}><SelectTrigger aria-label={t({ bn: "নমুনা পরিস্থিতি", en: "Synthetic scenario" })}><SelectValue /></SelectTrigger><SelectContent>{META_SIMULATOR_CASES.map(item => <SelectItem key={item} value={item}>{t(scenarios[item])}</SelectItem>)}</SelectContent></Select></div><Button onClick={run} disabled={pending}><Play />{t(pending ? { bn: "পরীক্ষা চলছে…", en: "Testing…" } : { bn: "নমুনা পরীক্ষা চালান", en: "Run synthetic test" })}</Button><Button variant="ghost" onClick={() => { setLedger({}); setEvents([]); setFailed(false); }} disabled={pending}><RotateCcw />{t({ bn: "মুছুন", en: "Reset simulation" })}</Button></div>
        {failed && <p role="alert" className="text-sm text-destructive">{t({ bn: "স্থানীয় পরীক্ষা শেষ হয়নি; বাস্তব সংযোগে কোনো পরিবর্তন হয়নি।", en: "Local test did not complete; real connectivity is unchanged." })}</p>}
        <p className="text-sm font-medium">{t({ bn: "বাস্তব CRM রেকর্ড তৈরি: ০", en: "Real CRM records created: 0" })}</p>
        <div aria-live="polite" className="space-y-3">{events.length === 0 ? <p className="border-t border-border pt-4 text-sm text-muted-foreground">{t({ bn: "এখনও নমুনা পরীক্ষা হয়নি।", en: "No synthetic tests run yet." })}</p> : events.map((item, index) => <article key={`${index}-${item.code}`} className="rounded-md border border-border bg-card p-4"><Badge variant="outline">{t({ bn: "নমুনা — বাস্তব নয়", en: "SIMULATED — NOT LIVE" })}</Badge><h3 className="mt-2 text-sm font-medium">{t(scenarios[item.scenario])}</h3><p className="mt-2 text-sm leading-7">{t(results[item.code])}</p><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{item.code}</p></article>)}</div>
      </TabsContent>
    </Tabs>
  </div>;
}