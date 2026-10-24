import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Clock, FlaskConical, Lock, MessageCircle, Search, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { getMessengerStatus } from "@/lib/messenger.functions";
import { filterDemoThreads, NOT_CONNECTED, withinMessagingWindow, type DemoThread } from "@/lib/messenger-shared";

/**
 * Messenger inbox body shared by the /messenger page and the agent desk tab.
 * Facebook is NOT connected: everything shown is demo sample data, nothing is
 * stored or sent. Server-side role scoping in messenger.functions.ts applies.
 */
export function MessengerInbox() {
  const t = useT();
  const adminToken = useAdminToken();
  const status = useQuery({
    queryKey: ["messenger", "status", adminToken],
    queryFn: () => getMessengerStatus({ data: { adminToken } }),
  });
  const [tab, setTab] = useState<"mine" | "unassigned">("mine");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | DemoThread["status"]>("all");

  const view = status.data?.view;
  if (status.isLoading) {
    return <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>;
  }
  if (status.error || !view?.canOpen) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm">{t({ bn: "Messenger ইনবক্স দেখতে স্টাফ অ্যাকাউন্টে সাইন ইন করুন।", en: "Sign in with a staff account to open the Messenger inbox." })}</p>
      </div>
    );
  }

  const list = filterDemoThreads(view, { queue: tab, search, status: filter });
  const active = list.find((x) => x.id === selected) ?? list[0] ?? null;
  const mobileThreadOpen = selected !== null && list.some((thread) => thread.id === selected);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <MessageCircle className="size-5 text-primary" /> {t({ bn: "Messenger ইনবক্স", en: "Messenger inbox" })}
          </h1>
          <p className="text-xs text-muted-foreground">
            {view.ownOnly
              ? t({ bn: "শুধু আপনার নামে দেওয়া কথোপকথন", en: "Only conversations assigned to you" })
              : t({ bn: "সব কথোপকথন" + (view.readOnly ? " (শুধু দেখা)" : ""), en: "All conversations" + (view.readOnly ? " (view-only)" : "") })}
          </p>
        </div>
        {view.canSeeUnassigned && (
          <div className="flex gap-2">
            <Button size="sm" variant={tab === "mine" ? "default" : "outline"} onClick={() => { setTab("mine"); setSelected(null); }}>{t({ bn: "সব", en: "All" })}</Button>
            <Button size="sm" variant={tab === "unassigned" ? "default" : "outline"} onClick={() => { setTab("unassigned"); setSelected(null); }}>{t({ bn: "অ্যাসাইন হয়নি", en: "Unassigned" })}</Button>
          </div>
        )}
      </div>

      <div role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p>
          <strong>{t(status.data?.notice ?? NOT_CONNECTED)}।</strong>{" "}
          {t({ bn: "নিচের সব কথোপকথন ডেমো নমুনা — আসল Facebook বার্তা নয়, কোথাও সংরক্ষিত বা পাঠানো হয় না।", en: "Everything below is demo sample data — not real Facebook messages; nothing is stored or sent." })}
        </p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input aria-label={t({ bn: "কথোপকথন খুঁজুন", en: "Search conversations" })} value={search} onChange={(event) => { setSearch(event.target.value); setSelected(null); }} placeholder={t({ bn: "কথোপকথন খুঁজুন", en: "Search conversations" })} className="min-w-0 w-full bg-transparent text-sm outline-none" />
        </label>
        <Select value={filter} onValueChange={(value) => { if (value === "all" || value === "open" || value === "pending" || value === "closed") { setFilter(value); setSelected(null); } }}>
          <SelectTrigger className="w-36" aria-label={t({ bn: "অবস্থা", en: "Status" })}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t({ bn: "সব অবস্থা", en: "All statuses" })}</SelectItem>
            <SelectItem value="open">{t({ bn: "চলমান", en: "Open" })}</SelectItem>
            <SelectItem value="pending">{t({ bn: "অপেক্ষমাণ", en: "Pending" })}</SelectItem>
            <SelectItem value="closed">{t({ bn: "বন্ধ", en: "Closed" })}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
        <ul className={`space-y-2 ${mobileThreadOpen ? "hidden md:block" : ""}`} aria-label={t({ bn: "কথোপকথন", en: "Conversations" })}>
          {list.length === 0 && <li className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">{t({ bn: "এই তালিকায় কিছু নেই।", en: "Nothing here." })}</li>}
          {list.map((th) => (
            <li key={th.id}>
              <Button type="button" variant="outline" onClick={() => setSelected(th.id)}
                className={`h-auto w-full flex-col items-stretch rounded-lg border p-3 text-left whitespace-normal ${active?.id === th.id ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {th.customer}
                  <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground"><FlaskConical className="inline size-3" /> {t({ bn: "ডেমো", en: "Demo" })}</span>
                  {th.unread > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{th.unread}</span>}
                </span>
                <span className="mt-1 line-clamp-1 text-xs text-muted-foreground">{th.preview}</span>
              </Button>
            </li>
          ))}
        </ul>
        {active ? <div className={mobileThreadOpen ? "min-w-0" : "hidden min-w-0 md:block"}><ThreadPane thread={active} canReply={view.canReply && active.assignedTo === "me"} canAssign={view.canAssign} onBack={() => setSelected(null)} /></div> : null}
      </div>
    </div>
  );
}

function ThreadPane({ thread, canReply, canAssign, onBack }: { thread: DemoThread; canReply: boolean; canAssign: boolean; onBack: () => void }) {
  const t = useT();
  const open = withinMessagingWindow(thread.lastInboundMinutesAgo);
  return (
    <section className="flex min-h-[60vh] flex-col rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <Button size="icon" variant="ghost" className="md:hidden" aria-label={t({ bn: "কথোপকথনের তালিকায় ফিরুন", en: "Back to conversations" })} onClick={onBack}><ArrowLeft className="size-4" /></Button>
        <p className="text-sm font-semibold">{thread.customer}</p>
        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${open ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Clock className="size-3" /> {open ? t({ bn: "২৪ ঘণ্টার মধ্যে", en: "Within 24h" }) : t({ bn: "২৪ ঘণ্টা পার", en: "24h window closed" })}
        </span>
        {canAssign && (
          <Button size="sm" variant="outline" className="ml-auto" disabled title={t({ bn: "Facebook সংযুক্ত হলে LeadHub থেকে চালু হবে", en: "Enabled via LeadHub once Facebook is connected" })}>
            {t({ bn: "অ্যাসাইন (শীঘ্রই)", en: "Assign (soon)" })}
          </Button>
        )}
      </header>
      <ol className="flex-1 space-y-2 p-3">
        {thread.messages.map((m, i) => (
          <li key={i} className={`max-w-[80%] break-words rounded-lg px-3 py-2 text-sm ${m.from === "agent" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>{m.text}</li>
        ))}
      </ol>
      <footer className="border-t border-border p-3">
        {canReply ? (
          <div className="flex gap-2">
            <input disabled aria-label={t({ bn: "উত্তর", en: "Reply" })} placeholder={t({ bn: "Facebook সংযুক্ত হলে উত্তর দেওয়া যাবে", en: "Replies open once Facebook is connected" })}
               className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm" />
            <Button size="sm" disabled aria-label={t({ bn: "পাঠান", en: "Send" })}><Send className="size-4" /></Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t({ bn: "এই কথোপকথনে আপনি উত্তর দিতে পারবেন না।", en: "You cannot reply in this conversation." })}</p>
        )}
      </footer>
    </section>
  );
}
