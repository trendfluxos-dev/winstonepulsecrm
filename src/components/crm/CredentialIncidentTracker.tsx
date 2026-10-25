import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CREDENTIAL_INCIDENT_STATUSES,
  CREDENTIAL_SERVICES,
  type CredentialIncident,
} from "@/lib/credential-incidents";
import { listCredentialIncidents, recordCredentialIncident } from "@/lib/credential-incidents.functions";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";

const dhakaTime = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

const STATUS_STYLE: Record<string, string> = {
  exposed: "bg-destructive/10 text-destructive",
  revoked: "bg-warning/15 text-warning",
  replaced: "bg-info/15 text-info",
  verified_active: "bg-success/15 text-success",
};

/**
 * Credential-incident tracker: records exposure → revocation → replacement
 * status per credential WITHOUT ever storing the credential value. The server
 * rejects credential-like notes; the log is append-only.
 */
export function CredentialIncidentTracker() {
  const t = useT();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();

  const records = useQuery({
    queryKey: ["credential-incidents", adminToken],
    queryFn: () => listCredentialIncidents({ data: { adminToken } }),
    refetchInterval: 30000,
  });
  const latest = new Map(
    Object.entries(records.data && records.data.ok ? (records.data.latest ?? {}) : {}),
  ) as Map<string, CredentialIncident>;

  const [service, setService] = useState<string>(CREDENTIAL_SERVICES[0].id);
  const [status, setStatus] = useState<string>(CREDENTIAL_INCIDENT_STATUSES[0].id);
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () =>
      recordCredentialIncident({ data: { adminToken, service: service as never, status: status as never, note } }),
    onSuccess: (result) => {
      if (result.ok) {
        setNote("");
        void queryClient.invalidateQueries({ queryKey: ["credential-incidents"] });
      }
    },
  });

  const statusLabel = (id: string) => CREDENTIAL_INCIDENT_STATUSES.find((s) => s.id === id)?.label;

  return (
    <section
      aria-label={t({ bn: "Credential ঘটনা ট্র্যাকার", en: "Credential incident tracker" })}
      className="space-y-2 rounded-xl border border-border bg-card p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldAlert className="size-4 text-muted-foreground" />
        {t({ bn: "Credential ঘটনা ট্র্যাকার (secret ছাড়া)", en: "Credential incident tracker (no secrets)" })}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t({
          bn: "উন্মুক্ত credential বাতিল ও প্রতিস্থাপনের অবস্থা এখানে নথিবদ্ধ হয় — কখনও credential-এর মান নয়।",
          en: "Tracks revocation and replacement of exposed credentials — never the credential values themselves.",
        })}
      </p>

      <ul className="space-y-2">
        {CREDENTIAL_SERVICES.map((item) => {
          const record = latest.get(item.id);
          return (
            <li key={item.id} className="rounded-lg border border-border bg-background p-2.5">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <span>{t(item.label)}</span>
                {record ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_STYLE[record.status] ?? "bg-muted"}`}>
                    {statusLabel(record.status) ? t(statusLabel(record.status)!) : record.status}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t({ bn: "কোনো রেকর্ড নেই", en: "No record" })}
                  </span>
                )}
              </p>
              {record && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {record.note} — {record.actorLabel ?? t({ bn: "কর্মী", en: "staff" })},{" "}
                  {t({ bn: "ঢাকা", en: "Dhaka" })} {dhakaTime(record.createdAt)}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="space-y-2 rounded-lg border border-border bg-background p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-xs font-medium">{t({ bn: "অবস্থা নথিভুক্ত করুন (IT)", en: "Record status (IT)" })}</p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t({ bn: "Credential", en: "Credential" })}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs"
            value={service}
            onChange={(event) => setService(event.target.value)}
          >
            {CREDENTIAL_SERVICES.map((item) => (
              <option key={item.id} value={item.id}>{t(item.label)}</option>
            ))}
          </select>
          <select
            aria-label={t({ bn: "অবস্থা", en: "Status" })}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {CREDENTIAL_INCIDENT_STATUSES.map((item) => (
              <option key={item.id} value={item.id}>{t(item.label)}</option>
            ))}
          </select>
        </div>
        <textarea
          aria-label={t({ bn: "অবস্থার বিবরণ", en: "Status note" })}
          className="min-h-16 w-full rounded-md border border-border bg-card p-2 text-xs"
          placeholder={t({
            bn: "যেমন: পুরোনো token Meta-তে revoke করা হয়েছে — credential-এর মান কখনও নয়",
            en: "e.g. old token revoked in Meta dashboard — never the credential value",
          })}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending || note.trim().length < 10}>
            {save.isPending ? t({ bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" }) : t({ bn: "নথিভুক্ত করুন", en: "Record" })}
          </Button>
          {save.data && !save.data.ok && (
            <p className="text-[11px] text-destructive">
              {save.data.code === "NOTE_CONTAINS_CREDENTIAL"
                ? t({ bn: "এই লেখায় credential-সদৃশ মান আছে — সংরক্ষণ করা যাবে না।", en: "This note looks like it contains a credential — it cannot be stored." })
                : save.data.code === "FORBIDDEN"
                  ? t({ bn: "শুধু IT কর্মী অবস্থা নথিভুক্ত করতে পারেন।", en: "Only IT staff can record status." })
                  : t({ bn: "সংরক্ষণ হয়নি; বিবরণ ১০–৫০০ অক্ষরের হতে হবে।", en: "Not saved; the note must be 10–500 characters." })}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
