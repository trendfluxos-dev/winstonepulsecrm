import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/crm/AppShell";
import { MessengerInbox } from "@/components/crm/MessengerInbox";

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
  return (
    <AppShell>
      <MessengerInbox />
    </AppShell>
  );
}
