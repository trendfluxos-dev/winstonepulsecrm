import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { MetaControlCenter } from "@/components/crm/MetaControlCenter";
import { RoleGate } from "@/components/crm/RoleGate";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/meta-control-center")({
  head: () => ({ meta: [
    { title: "Meta Integration & Webhook Control Center — Winstone Pulse" },
    { name: "description", content: "Secure Meta Page and webhook preparation, permission evidence, diagnostics boundaries and isolated synthetic tests for Winstone Pulse." },
    { property: "og:title", content: "Meta Control Center — Winstone Pulse" },
    { property: "og:description", content: "Unverified Meta readiness with raw-body signature validation and synthetic-only event diagnostics." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: MetaControlCenterPage,
});
function MetaControlCenterPage() {
  const t = useT();
  return <AppShell><RoleGate allow={["authority"]} title="Meta Control Center" description={t({ bn: "HQ / IT-এর বিদ্যমান প্রবেশাধিকার দরকার; কোনো অনুমতি পরিবর্তন হবে না।", en: "Existing HQ / IT access is required; permissions are unchanged." })} icon={<ShieldCheck className="size-6" />}><MetaControlCenter /></RoleGate></AppShell>;
}