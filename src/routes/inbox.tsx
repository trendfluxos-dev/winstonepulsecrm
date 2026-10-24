import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Bot, Inbox, Loader2, UserRound } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { ConversationWorkspace } from "@/components/support/ConversationWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessengerInbox } from "@/components/crm/MessengerInbox";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { listSupportInbox } from "@/lib/support-staff.functions";
import {
  CONVERSATION_STATUSES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  formatMinutes,
  relativeTime,
  slaMinutesLeft,
  type ConversationStatus,
  type Priority,
} from "@/lib/support-shared";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: "Support & Messenger Inbox — Winstone Pulse" },
      {
        name: "description",
        content:
          "Separate Support Desk and Messenger queues in Winstone Pulse; Messenger remains a disconnected demo until verified setup.",
      },
      { property: "og:title", content: "Support & Messenger Inbox — Winstone Pulse" },
      {
        property: "og:description",
        content: "Separate support and Messenger workspaces with existing access controls and honest connection status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-destructive">The support inbox could not be loaded.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: InboxPage,
});

function InboxPage() {
  const t = useT();
  const [queue, setQueue] = useState("support");
  return <AppShell><Tabs value={queue} onValueChange={setQueue}>
    <TabsList className="mb-4"><TabsTrigger value="support">Support Desk</TabsTrigger><TabsTrigger value="messenger">{t({ bn: "Messenger", en: "Messenger" })}</TabsTrigger></TabsList>
    <TabsContent value="support">{queue === "support" && <SupportInbox />}</TabsContent>
    <TabsContent value="messenger">{queue === "messenger" && <MessengerInbox />}</TabsContent>
  </Tabs></AppShell>;
}

function SupportInbox() {
  const adminToken = useAdminToken();
  const [status, setStatus] = useState<"all" | ConversationStatus>("open");
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const inbox = useQuery({
    queryKey: ["support", "inbox", status, mine, search, adminToken],
    queryFn: () =>
      listSupportInbox({
        data: { adminToken, status, mine, search: search.trim() || undefined },
      }),
    refetchInterval: 20000,
  });

  const conversations = inbox.data?.conversations ?? [];
  const activeId = selected ?? conversations[0]?.id ?? null;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Inbox className="size-5 text-primary" /> Support inbox
          </h1>
          <p className="text-xs text-muted-foreground">
            {inbox.data
              ? `${conversations.length} conversation${conversations.length === 1 ? "" : "s"} · signed in as ${
                  inbox.data.me.name ?? inbox.data.me.scope
                }${inbox.data.me.readOnly ? " (view-only)" : ""}`
              : "Loading queue…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search subject"
            className="h-9 w-44"
            aria-label="Search conversations"
          />
          <select
            aria-label="Filter by status"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | ConversationStatus)}
          >
            <option value="all">All statuses</option>
            {CONVERSATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant={mine ? "default" : "outline"}
            className="h-9 text-xs"
            onClick={() => setMine((current) => !current)}
          >
            Assigned to me
          </Button>
        </div>
      </div>

      <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[360px_1fr]">
        <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {inbox.isLoading && (
            <li className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Loading…
            </li>
          )}
          {!inbox.isLoading && conversations.length === 0 && (
            <li className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
              Nothing in this view. New customer chats land here automatically.
            </li>
          )}
          {conversations.map((conversation) => {
            const sla = slaMinutesLeft(conversation.sla_due_at);
            const overdue = sla !== null && sla < 0 && !conversation.first_human_response_at;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => setSelected(conversation.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    activeId === conversation.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {conversation.ai_handled ? (
                      <Bot className="size-3.5" />
                    ) : (
                      <UserRound className="size-3.5" />
                    )}
                    {conversation.customer?.name ?? conversation.customer?.email ?? "Unknown"}
                    <span className="ml-auto">{relativeTime(conversation.last_message_at)}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium">
                    {conversation.subject ?? "Support conversation"}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-muted px-1.5 py-0.5">
                      {STATUS_LABEL[conversation.status as ConversationStatus]}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5">
                      {PRIORITY_LABEL[conversation.priority as Priority]}
                    </span>
                    {conversation.unread_for_agent && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                        New
                      </span>
                    )}
                    {overdue && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-destructive">
                        <AlertTriangle className="size-3" /> {formatMinutes(sla)} over
                      </span>
                    )}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>

        <section className="min-h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2/40">
          {activeId ? (
            <ConversationWorkspace conversationId={activeId} />
          ) : (
            <p className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
              Select a conversation to start working.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
