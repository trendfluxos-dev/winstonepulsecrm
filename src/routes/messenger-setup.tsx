import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Circle, Lock } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { messengerPreparation } from "@/lib/messenger-readiness";

export const Route = createFileRoute("/messenger-setup")({
  head: () => ({ meta: [
    { title: "Messenger Setup Progress — Winstone Pulse" },
    { name: "description", content: "Winstone Messenger setup prerequisites, unverified App and Page approvals and activation blockers." },
    { property: "og:title", content: "Messenger Setup Progress — Winstone Pulse" },
    { property: "og:description", content: "Honest Messenger preparation status, webhook readiness and activation blockers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SetupPage,
});

function SetupPage() {
  const t = useT();
  const state = messengerPreparation();
  const steps = [
    { title: { bn: "Meta App অনুমোদন", en: "Meta App approval" }, value: state.appApproval, note: { bn: "App, Live mode ও প্রয়োজনীয় অনুমতির অনুমোদনের প্রমাণ এখনও যাচাই হয়নি।", en: "App identity, Live mode and required permission approvals have not been verified." } },
    { title: { bn: "Page consent", en: "Page consent" }, value: state.pageConsent, note: { bn: "সঠিক Page-এর অনুমতি ও App-এর সঙ্গে সংযোগ যাচাই বাকি। গোপন তথ্য সেভ হওয়া অনুমোদনের প্রমাণ নয়।", en: "Authorization for the correct Page and its association with the App remain unverified. Saved secrets are not proof of consent." } },
    { title: { bn: "Webhook token ও যাচাই", en: "Webhook token and verification" }, value: state.webhook, note: { bn: "প্রয়োজনীয় App Secret ও verify token সেটআপ বাকি; যাচাই ও বার্তা গ্রহণের অনুরোধ 503 দেয়। শুধু token দিলে ইনবক্স চালু হয় না।", en: "App Secret and verify-token setup remain pending; verification and ingestion requests return 503. A token alone cannot enable the inbox." } },
    { title: { bn: "Messenger ইনবক্স", en: "Messenger inbox" }, value: state.inbox, note: { bn: "শুধু নমুনা কথোপকথন। আসল বার্তা গ্রহণ, সংরক্ষণ, অ্যাসাইন ও পাঠানোর যাচাই বাকি।", en: "Sample conversations only. Real ingestion, storage, assignment and sending remain pending." } },
  ];
  return <AppShell><div className="mx-auto max-w-3xl space-y-6">
    <header className="space-y-3"><Button asChild variant="ghost" size="sm"><Link to="/messenger"><ArrowLeft className="size-4" />{t({ bn: "Messenger", en: "Messenger" })}</Link></Button>
      <h1 className="text-xl font-semibold">{t({ bn: "Messenger সংযোগের প্রগ্রেস", en: "Messenger connection progress" })}</h1>
      <p role="status" className="flex items-center gap-2 text-sm"><Lock className="size-4 text-primary" />{t({ bn: "Facebook এখনও সংযুক্ত হয়নি", en: "Facebook not connected yet" })}</p>
    </header>
    <ol className="divide-y divide-border border-y border-border">{steps.map((step) => <li key={step.value + step.title.en} className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-medium"><Circle className="size-4 text-muted-foreground" />{t(step.title)}</h2><span className="text-xs text-muted-foreground">{step.value === "unverified" ? t({ bn: "যাচাই বাকি", en: "Unverified" }) : step.value === "disabled" ? t({ bn: "বন্ধ", en: "Disabled" }) : t({ bn: "ডেমো", en: "Demo" })}</span></div>
      <p className="mt-2 text-sm text-muted-foreground">{t(step.note)}</p>
    </li>)}</ol>
    <section className="space-y-2"><h2 className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="size-4 text-primary" />{t({ bn: "চালু করার বাধা", en: "Activation blockers" })}</h2><p className="text-sm text-muted-foreground">{t({ bn: "App ও Page অনুমোদনের যাচাই, গোপন webhook সেটআপ, অনুমোদিত তথ্য সংরক্ষণ ও আলাদা পরীক্ষার পরিবেশ দরকার। লাইভ প্রকাশ বা তথ্য কাঠামো বদলের অনুমতি ছাড়া বর্তমান ইনবক্স চালু করা যাবে না।", en: "Verified App/Page approvals, secure webhook configuration, approved message storage and isolated testing are required. The inbox cannot go live without separately authorized deployment and storage changes." })}</p></section>
  </div></AppShell>;
}