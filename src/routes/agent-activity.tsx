import { createFileRoute } from "@tanstack/react-router";
import { Activity, KeyRound, Loader2, Printer, RefreshCw, Smartphone } from "lucide-react";

import { AppShell } from "@/components/crm/AppShell";
import { dhaka, useAgentActivity } from "@/components/crm/AgentOnboarding";
import { RoleGate } from "@/components/crm/RoleGate";
import { Button } from "@/components/ui/button";
import { daysWaiting, pendingResets } from "@/lib/pending-password-resets";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/agent-activity")({
  head: () => ({
    meta: [
      { title: "Agent activity — Winstone Pulse" },
      { name: "description", content: "Staff-only view of agent last login, pending backlog and Android sign-in." },
      { property: "og:title", content: "Agent activity — Winstone Pulse" },
      { property: "og:description", content: "Last login, backlog and Android status for each agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        icon={<Activity className="size-7" />}
        title="এজেন্ট অ্যাক্টিভিটি"
        description="শুধু IT / HQ — PIN দিয়ে খুলুন।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

function status(r: { isActive: boolean; approved: boolean; mustChangePassword: boolean; hasAccount: boolean }) {
  if (!r.hasAccount) return "অ্যাকাউন্ট নেই";
  if (r.mustChangePassword) return "নতুন পাসওয়ার্ড বাকি";
  if (!r.approved) return "অনুমোদন বাকি";
  return r.isActive ? "সক্রিয়" : "নিষ্ক্রিয়";
}

function Board() {
  const { data, isLoading, refetch, isFetching } = useAgentActivity();
  const rows = (data?.rows ?? []).filter((r) => r.role === "agent" || r.role === "team_leader");
  return (
    <div className="space-y-4 p-4 print:p-0">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="flex-1 text-lg font-semibold">এজেন্ট অ্যাক্টিভিটি ও লগইন তালিকা</h1>
        <Button size="sm" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className="size-3.5" /> রিফ্রেশ
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-3.5" /> প্রিন্ট (IT-only)
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        IT-only · পাসওয়ার্ড এখানে নেই, কখনো দেখানো হয় না · তৈরি: {dhaka(data?.generatedAt ?? null)} (ঢাকা)
      </p>
      {!isLoading && <PendingResets rows={data?.rows ?? []} />}
      {isLoading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <div className="table-scroll rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">নাম</th>
                <th className="p-2">ইমেইল</th>
                <th className="p-2">ফোন</th>
                <th className="p-2">স্ট্যাটাস</th>
                <th className="p-2">শেষ লগইন</th>
                <th className="p-2">পেন্ডিং রিপোর্ট</th>
                <th className="p-2">ওভারডিউ ফলো-আপ</th>
                <th className="p-2">Android</th>
                <th className="hidden p-2 print:table-cell">পাসওয়ার্ড (হাতে লিখুন)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profileId} className="border-t border-border">
                  <td className="tabular p-2">{r.employeeId ?? "—"}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2 text-xs">{r.email ?? "—"}</td>
                  <td className="tabular p-2">{r.phone ?? "—"}</td>
                  <td className="p-2">{status(r)}</td>
                  <td className="tabular p-2 text-xs">{dhaka(r.lastLoginAt)}</td>
                  <td className="tabular p-2">{r.pendingReports}</td>
                  <td className={`tabular p-2 ${r.overdueFollowUps > 0 ? "text-destructive" : ""}`}>
                    {r.overdueFollowUps}
                  </td>
                  <td className="p-2 text-xs">
                    {r.androidSignedIn ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Smartphone className="size-3.5" /> সাইন ইন · {r.androidVersion ?? "?"} ·{" "}
                        {dhaka(r.androidLastSeenAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">সাইন ইন নেই</span>
                    )}
                  </td>
                  <td className="hidden p-2 print:table-cell">______________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type ActivityRows = NonNullable<ReturnType<typeof useAgentActivity>["data"]>["rows"];

function PendingResets({ rows }: { rows: ActivityRows }) {
  const t = useT();
  const list = pendingResets(rows);
  const now = new Date();
  return (
    <section className="rounded-lg border border-border bg-card p-3 print:hidden" aria-labelledby="pending-resets">
      <h2 id="pending-resets" className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="size-4" />
        {t({ bn: "নতুন পাসওয়ার্ড দেওয়া বাকি", en: "Still need to set a new password" })} ({list.length})
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({
          bn: "এই অ্যাকাউন্টগুলো রিসেটের পর এখনো নতুন পাসওয়ার্ড সেভ করেনি। সবচেয়ে পুরোনো রিসেট আগে।",
          en: "These accounts were reset but have not saved a new password yet. Oldest reset first.",
        })}
      </p>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t({ bn: "কেউ বাকি নেই — সবাই নতুন পাসওয়ার্ড দিয়েছে।", en: "Nobody is waiting — everyone has set a new password." })}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {list.map((r) => {
            const days = daysWaiting(r.resetIssuedAt, now);
            return (
              <li key={r.profileId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{r.name}</span>{" "}
                  <span className="tabular text-xs text-muted-foreground">{r.employeeId ?? "—"}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.resetIssuedAt
                    ? `${t({ bn: "রিসেট", en: "Reset" })}: ${dhaka(r.resetIssuedAt)} · ${
                        r.resetKind === "link"
                          ? t({ bn: "ইমেইল লিংক", en: "email link" })
                          : t({ bn: "IT অস্থায়ী পাসওয়ার্ড", en: "IT temporary password" })
                      } · ${days === 0 ? t({ bn: "আজ", en: "today" }) : `${days} ${t({ bn: "দিন অপেক্ষা", en: "days waiting" })}`}`
                    : t({ bn: "রিসেটের সময় রেকর্ডে নেই", en: "Reset time not on record" })}
                  {" · "}
                  {t({ bn: "শেষ লগইন", en: "Last sign-in" })}: {dhaka(r.lastLoginAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
