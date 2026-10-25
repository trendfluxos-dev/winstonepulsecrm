import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleOff, Clock3, Cloud, FolderOpen, MessageCircle, Network, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { integrationStatus, type IntegrationStatus } from "@/lib/integration-status";
import { WorkspaceRoadmap } from "@/components/crm/WorkspaceRoadmap";
import { DriveKnowledgePanel } from "@/components/crm/DriveKnowledgePanel";
import { InventorySheetPanel } from "@/components/crm/InventorySheetPanel";

const ICONS = { messenger: MessageCircle, whatsapp: MessageCircle, windsor: BarChart3, drive: FolderOpen, os: Cloud };

function ServiceLinks({ id }: { id: IntegrationStatus["id"] }) {
  const t = useT();
  if (id === "messenger") return <Button asChild variant="outline" size="sm"><Link to="/inbox"><ArrowUpRight className="size-4" />{t({ bn: "ইনবক্স ও IT পরীক্ষা", en: "Inbox & IT diagnostic" })}</Link></Button>;
  if (id === "windsor") return <Button asChild variant="outline" size="sm"><Link to="/facebook-ads"><ArrowUpRight className="size-4" />{t({ bn: "রিপোর্ট প্রস্তুতি · HQ/IT", en: "Report preparation · HQ/IT" })}</Link></Button>;
  if (id === "drive") return <div className="flex flex-wrap gap-2"><Button asChild variant="outline" size="sm"><Link to="/system"><ArrowUpRight className="size-4" />IT Console</Link></Button><Button asChild variant="outline" size="sm"><Link to="/recorder"><ArrowUpRight className="size-4" />{t({ bn: "রেকর্ডার", en: "Recorder" })}</Link></Button></div>;
  if (id === "os") return <Button asChild variant="outline" size="sm"><Link to="/system"><ArrowUpRight className="size-4" />IT Console</Link></Button>;
  return null;
}

/** Non-sensitive evidence checklist; visiting never tests or activates a provider. */
export function IntegrationStatusPage() {
  const t = useT();
  const services = integrationStatus();
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="space-y-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Network className="size-5 text-primary" />Winstone Pulse</div>
      <h1 className="text-2xl font-semibold">{t({ bn: "সংযোগের অবস্থা", en: "Integration status" })}</h1>
      <p className="text-sm text-muted-foreground">Messenger · WhatsApp · Windsor.ai · Google Drive · Winstone OS</p>
    </header>
    <div role="status" className="flex items-start gap-3 border-y border-border bg-muted px-4 py-4">
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-1"><p className="font-medium">{t({ bn: "কোনো সংযোগের বর্তমান কার্যকারিতা এখানে যাচাই করা হয়নি", en: "No integration’s current operation has been verified here" })}</p>
        <p className="text-sm text-muted-foreground">{t({ bn: "Messenger ও Windsor.ai বন্ধ। অন্য তিনটির বাস্তব সংযোগ অযাচাইকৃত—বন্ধ বলে ধরে নেওয়া হয়নি। শেষ যাচাইয়ের প্রমাণ না থাকলে সময় দেখানো হয় না।", en: "Messenger and Windsor.ai are inactive. The other three are unverified, not assumed disconnected. No verification timestamp is invented." })}</p></div>
    </div>
    <nav aria-label={t({ bn: "সংযোগ নির্বাচন", en: "Choose integration" })} className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4">{services.map(service => <a key={service.id} href={`#${service.id}`} className="text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{service.name}</a>)}</nav>
    <div className="divide-y divide-border">{services.map(service => {
      const Icon = ICONS[service.id];
      return <section id={service.id} key={service.id} aria-labelledby={`${service.id}-heading`} className="scroll-mt-36 grid min-w-0 gap-5 py-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0 space-y-3">
          <header className="flex flex-wrap items-center gap-2"><Icon className="size-5 text-primary" /><h2 id={`${service.id}-heading`} className="text-lg font-semibold">{service.name}</h2></header>
          <p className={`flex items-center gap-2 text-sm font-medium ${service.state === "inactive" ? "text-muted-foreground" : "text-warning"}`}><CircleOff className="size-4 shrink-0" />{t(service.state === "inactive" ? { bn: "চালু হয়নি", en: "Inactive" } : { bn: "বাস্তব সংযোগ অযাচাইকৃত", en: "Live connection unverified" })}</p>
          <p className="flex items-start gap-2 text-xs text-muted-foreground"><Clock3 className="size-4 shrink-0" />{t({ bn: "সর্বশেষ যাচাই (ঢাকা): ", en: "Last verification (Dhaka): " })}{service.verifiedAt ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date(service.verifiedAt)) : t({ bn: "যাচাইকৃত সময় নেই", en: "No verified timestamp" })}</p>
          <p className="text-sm">{t(service.evidence)}</p>
          <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{t({ bn: "যাচাইয়ের বাধা: ", en: "Verification blocker: " })}</span>{t(service.blocker)}</p>
          <ServiceLinks id={service.id} />
        </div>
        <div className="min-w-0 space-y-3"><h3 className="text-sm font-semibold">{t({ bn: "যাচাইয়ের প্রয়োজনীয় ধাপ", en: "Required verification steps" })}</h3><ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed marker:text-muted-foreground">{service.steps.map(step => <li key={step.en} className="pl-1">{t(step)}</li>)}</ol></div>
      </section>;
    })}</div>
    <WorkspaceRoadmap />
    <InventorySheetPanel />
    <DriveKnowledgePanel />
    <p className="border-t border-border pt-4 text-xs text-muted-foreground">{t({ bn: "প্রকাশ্য roadmap কোনো সংযোগ পরীক্ষা করে না। শিটের তথ্য দেখতে স্টাফ সাইন ইন এবং সংযোগ বদলাতে IT অনুমতি প্রয়োজন; মেসেজ পাঠানো হয় না।", en: "The public roadmap does not test connections. Sheet data requires staff sign-in and configuration requires IT authority; no messages are sent." })}</p>
  </div>;
}