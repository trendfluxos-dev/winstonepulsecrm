import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { integrationPreparation } from "@/lib/integration-readiness";
import { MESSENGER_RETENTION_NOTE } from "@/lib/messenger-retention";
import { MetaConnectionTest } from "@/components/crm/MetaConnectionTest";
import { MetaVerificationReport } from "@/components/crm/MetaVerificationReport";
import { MessengerDeliveryStatus } from "@/components/crm/MessengerDeliveryStatus";
import { MessengerSyncAudit } from "@/components/crm/MessengerSyncAudit";

/** Public preparation summary only, never a live Meta or secret check. */
export function MessengerConnectionStatus() {
  const t = useT();
  const verification = integrationPreparation().verification.messenger;
  return <section aria-label={t({ bn: "Messenger সংযোগের অবস্থা", en: "Messenger connection status" })} className="mb-4 space-y-3 border-y border-border py-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="flex items-center gap-2 text-sm font-medium"><Lock className="size-4 text-muted-foreground" />{t({ bn: "Facebook এখনও সংযুক্ত হয়নি", en: "Facebook not connected yet" })}</p><Button asChild variant="outline" size="sm"><Link to="/messenger-setup">{t({ bn: "সংযোগের প্রগ্রেস", en: "Connection progress" })}</Link></Button></div>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">{[
      { bn: "Meta App অনুমোদন", en: "Meta App approval" },
      { bn: "Facebook Page অনুমোদন", en: "Facebook Page consent" },
      { bn: "Messenger webhook subscription", en: "Messenger webhook subscription" },
    ].map((label) => <div key={label.en}><dt>{t(label)}</dt><dd className="text-muted-foreground">{t({ bn: "যাচাই বাকি", en: "Unverified" })}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">{t({ bn: "সর্বশেষ যাচাই (ঢাকা): পরীক্ষা হয়নি", en: "Last verification (Dhaka): not checked" })}</p>
    <p className="text-xs text-muted-foreground">{t(verification.reason)}</p>
    <MetaVerificationReport />
    <MessengerDeliveryStatus />
    <MessengerSyncAudit />
    <p className="text-xs text-muted-foreground">{t(MESSENGER_RETENTION_NOTE)}</p>
    <MetaConnectionTest />
    <p className="text-xs text-muted-foreground">{t({ bn: "Signed webhook: সার্ভারে স্বাক্ষর পরীক্ষার ব্যবস্থা আছে; বাস্তব যাচাইয়ের প্রমাণ নেই। গোপন তথ্য সেভ হওয়া মেসেজ সিঙ্কের প্রমাণ নয়।", en: "Signed webhook: server signature validation is implemented; no live verification evidence exists. Saved secrets do not prove message sync." })}</p>
  </section>;
}