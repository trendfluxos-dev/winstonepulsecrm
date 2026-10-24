import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CircleOff, LockKeyhole } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { integrationPreparation } from "@/lib/integration-readiness";

export const Route = createFileRoute("/messenger-setup")({
  head: () => ({ meta: [
    { title: "Messenger & Windsor.ai Connection Progress — Winstone Pulse" },
    { name: "description", content: "Messenger and Windsor.ai preparation status with unverified approvals and inactive connections." },
    { property: "og:title", content: "Messenger & Windsor.ai Connection Progress — Winstone Pulse" },
    { property: "og:description", content: "Combined Messenger and Windsor.ai status without inferred connection or fabricated metrics." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SetupPage,
});

function SetupPage() {
  const t = useT();
  const state = integrationPreparation();
  const services = [
    { name: "Messenger", verification: state.verification.messenger, connected: state.messenger.connected, rows: [
      { label: { bn: "Meta App অনুমোদন", en: "Meta App approval" }, value: { bn: "যাচাই বাকি", en: "Unverified" } },
      { label: { bn: "Page consent", en: "Page consent" }, value: { bn: "যাচাই বাকি", en: "Unverified" } },
      { label: { bn: "Webhook", en: "Webhook" }, value: { bn: "বন্ধ", en: "Disabled" } },
      { label: { bn: "বাস্তব মেসেজ সিঙ্ক", en: "Real message sync" }, value: { bn: "চালু হয়নি", en: "Inactive" } },
    ], note: { bn: "App ও Page অনুমোদন, signed webhook এবং নিরাপদ বার্তা সংরক্ষণের যাচাই বাকি। ইনবক্সে শুধু নমুনা কথোপকথন আছে।", en: "App/Page approvals, signed webhook and secure message storage remain unverified. Inbox conversations are samples only." } },
    { name: "Windsor.ai", verification: state.verification.windsor, connected: state.windsor.connected, rows: [
      { label: { bn: "রিপোর্টের API ও তথ্যের ধরন", en: "Report API and schema" }, value: { bn: "যাচাই বাকি", en: "Unverified" } },
      { label: { bn: "বিজ্ঞাপন অ্যাকাউন্টের অনুমতি", en: "Ad account permission" }, value: { bn: "যাচাই বাকি", en: "Unverified" } },
      { label: { bn: "গোপন কনফিগারেশন", en: "Secret configuration" }, value: { bn: "এখানে পরীক্ষা করা হয়নি", en: "Not checked here" } },
      { label: { bn: "বাস্তব বিজ্ঞাপন রিপোর্ট", en: "Live ads reporting" }, value: { bn: "চালু হয়নি", en: "Inactive" } },
    ], note: { bn: "অফিশিয়াল রিপোর্টের ঠিকানা, তথ্যের ধরন, মুদ্রা, সময় অঞ্চল ও অ্যাকাউন্টের অনুমতি যাচাই বাকি। কোনো বিজ্ঞাপন তথ্য আনা হয়নি।", en: "Official report endpoint, schema, currency, timezone and account permission remain unverified. No ads data has been fetched." } },
  ];
  return <AppShell><div className="mx-auto max-w-4xl space-y-6">
    <header className="space-y-3">
      <Button asChild variant="ghost" size="sm"><Link to="/messenger"><ArrowLeft className="size-4" />Messenger</Link></Button>
      <h1 className="text-xl font-semibold">{t({ bn: "Messenger ও Windsor.ai সংযোগের প্রগ্রেস", en: "Messenger & Windsor.ai connection progress" })}</h1>
    </header>
    {state.noneConnected && <div role="status" className="flex items-start gap-3 border-y border-border bg-muted px-4 py-4"><CircleOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><div className="space-y-1"><p className="font-medium">{t({ bn: "কোনো সংযোগ চালু নেই", en: "No connections are active" })}</p><p className="text-sm text-muted-foreground">{t({ bn: "Facebook এখনও সংযুক্ত হয়নি; Windsor.ai রিপোর্টও বন্ধ। এটি প্রস্তুতির অবস্থা, সরাসরি সংযোগ পরীক্ষা নয়।", en: "Facebook is not connected yet; Windsor.ai reporting is also disabled. This is preparation status, not a live connection check." })}</p></div></div>}
    <div className="grid gap-6 md:grid-cols-2">{services.map((service) => <section key={service.name} className="min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{service.name}</h2><span className="flex items-center gap-1.5 text-sm text-muted-foreground"><LockKeyhole className="size-4" />{t({ bn: "সংযুক্ত নয়", en: "Disconnected" })}</span></header>
      <p className="text-xs text-muted-foreground">{t({ bn: "সর্বশেষ যাচাই (ঢাকা): পরীক্ষা হয়নি", en: "Last verification (Dhaka): not checked" })}</p>
      <p className="text-xs text-muted-foreground">{t({ bn: "বাধার কারণ: ", en: "Blocker: " })}{t(service.verification.reason)}</p>
      <dl className="divide-y divide-border border-y border-border">{service.rows.map((row) => <div key={row.label.en} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-3 text-sm"><dt>{t(row.label)}</dt><dd className="text-muted-foreground">{t(row.value)}</dd></div>)}</dl>
      <p className="text-sm text-muted-foreground">{t(service.note)}</p>
    </section>)}</div>
  </div></AppShell>;
}