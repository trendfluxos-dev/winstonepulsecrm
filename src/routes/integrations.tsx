import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/crm/AppShell";
import { IntegrationStatusPage } from "@/components/crm/IntegrationStatusPage";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [
    { title: "Integration Status — Winstone Pulse" },
    { name: "description", content: "Messenger, WhatsApp, Windsor.ai, Google Drive and Winstone OS status, evidence boundaries and required verification steps." },
    { property: "og:title", content: "Integration Status — Winstone Pulse" },
    { property: "og:description", content: "Five-service verification checklist without inferred connectivity or live activation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AppShell><IntegrationStatusPage /></AppShell>,
});