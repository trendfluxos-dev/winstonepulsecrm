import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

import { AppShell } from "@/components/crm/AppShell";
import { MessengerInbox } from "@/components/crm/MessengerInbox";
import { CredentialRedactor } from "@/components/crm/CredentialRedactor";

export const Route = createFileRoute("/messenger")({
  head: () => ({
    meta: [
      { title: "Messenger Inbox — Winstone Pulse" },
      { name: "description", content: "Facebook Messenger shared inbox for Winstone agents — preview with demo conversations until the Page is connected." },
      { property: "og:title", content: "Messenger Inbox — Winstone Pulse" },
      { property: "og:description", content: "Role-scoped Messenger inbox foundation for Winstone sales agents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessengerPage,
});

function MessengerPage() {
  const t = useT();
  return (
    <AppShell>
      <div className="mb-4"><Button asChild variant="outline" size="sm"><Link to="/messenger-setup"><Activity className="size-4" />{t({ bn: "সংযোগের প্রগ্রেস", en: "Connection progress" })}</Link></Button></div>
      <MessengerInbox />
      <CredentialRedactor />
    </AppShell>
  );
}
