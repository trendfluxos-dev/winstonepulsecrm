import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { WindsorReporting } from "@/components/crm/WindsorReporting";
import { useT } from "@/lib/i18n";
export const Route = createFileRoute("/facebook-ads")({
  head: () => ({ meta: [
    { title: "Facebook Ads Reporting Preparation — Winstone Pulse" },
    { name: "description", content: "Disconnected Windsor.ai read-only Facebook Ads reporting preparation for Winstone Pulse." },
    { property: "og:title", content: "Facebook Ads Reporting Preparation — Winstone Pulse" },
    { property: "og:description", content: "Secure reporting prerequisites and bounded date ranges; no campaign or budget actions." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: FacebookAdsPage,
});
function FacebookAdsPage() {
  const t = useT();
  return <AppShell><RoleGate allow={["authority"]} title={t({ bn: "Facebook Ads রিপোর্ট", en: "Facebook Ads reports" })} description={t({ bn: "রিপোর্ট প্রস্তুতি দেখার জন্য HQ / IT প্রবেশাধিকার দরকার।", en: "HQ / IT access is required to view reporting preparation." })} icon={<BarChart3 className="size-6" />}><WindsorReporting /></RoleGate></AppShell>;
}