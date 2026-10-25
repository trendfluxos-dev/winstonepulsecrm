import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Power, PowerOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { META_VERIFICATION_TRACKS } from "@/lib/meta-verification";
import { latestSyncDecision } from "@/lib/messenger-sync-decisions";
import { listMessengerSyncDecisions, recordMessengerSyncDecision } from "@/lib/messenger-sync-decisions.functions";

const dhakaTime = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

const trackLabel = (id: string) =>
  META_VERIFICATION_TRACKS.find((track) => track.id === id)?.label ?? { bn: id, en: id };

/**
 * Sync enable/disable audit log. Every decision shows staff, Dhaka time, the
 * verification snapshot and the reason. An enable decision is refused by the
 * server until every verification checklist track is verified.
 */
export function MessengerSyncAudit() {
  const t = useT();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();

  const audit = useQuery({
    queryKey: ["messenger", "sync-decisions", adminToken],
    queryFn: () => listMessengerSyncDecisions({ data: { adminToken } }),
    refetchInterval: 30000,
  });
  const decisions = audit.data?.ok ? audit.data.decisions : [];
  const latest = latestSyncDecision(decisions);
  const syncOn = latest?.action === "enable";

  const [action, setAction] = useState<"enable" | "disable">("enable");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => recordMessengerSyncDecision({ data: { adminToken, action, reason } }),
    onSuccess: (result) => {
      if (result.ok) {
        setReason("");
        void queryClient.invalidateQueries({ queryKey: ["messenger", "sync-decisions"] });
      }
    },
  });

  return (
    <section
      aria-label={t({ bn: "সিঙ্ক সিদ্ধান্তের অডিট লগ", en: "Sync decision audit log" })}
      className="space-y-2 rounded-xl border border-border bg-card p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <History className="size-4 text-muted-foreground" />
        {t({ bn: "সিঙ্ক চালু/বন্ধের অডিট লগ", en: "Sync enable/disable audit log" })}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-xs">
        {syncOn ? <Power className="size-3.5 text-primary" /> : <PowerOff className="size-3.5 text-muted-foreground" />}
        <span className="font-medium">
          {syncOn
            ? t({ bn: "সর্বশেষ সিদ্ধান্ত: সিঙ্ক চালু", en: "Latest decision: sync on" })
            : t({ bn: "সর্বশেষ সিদ্ধান্ত: সিঙ্ক বন্ধ", en: "Latest decision: sync off" })}
        </span>
        {latest ? (
          <span className="text-muted-foreground">
            — {latest.actorLabel ?? t({ bn: "কর্মী", en: "staff" })}, {t({ bn: "ঢাকা", en: "Dhaka" })} {dhakaTime(latest.createdAt)}
          </span>
        ) : (
          <span className="text-muted-foreground">{t({ bn: "এখনও কোনো সিদ্ধান্ত নথিভুক্ত হয়নি", en: "No decision recorded yet" })}</span>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t({
          bn: "সিঙ্ক চালু হতে হলে চারটি যাচাই-ট্র্যাকই 'যাচাইকৃত' থাকতে হবে; অন্যথায় সার্ভার সিদ্ধান্ত বাতিল করে। চূড়ান্ত চালু আরও নির্ভর করে সার্ভারের সুইচ ও গোপন মানের উপর।",
          en: "Enabling sync requires all four verification tracks to be 'verified'; otherwise the server refuses the decision. Final activation also depends on the server switch and secrets.",
        })}
      </p>

      {decisions.length > 0 && (
        <ul className="space-y-2">
          {decisions.slice(0, 10).map((decision) => (
            <li key={decision.id} className="rounded-lg border border-border bg-background p-2.5 text-xs">
              <p className="flex flex-wrap items-center justify-between gap-2 font-medium">
                <span>{decision.action === "enable" ? t({ bn: "চালু", en: "Enable" }) : t({ bn: "বন্ধ", en: "Disable" })}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {decision.actorLabel ?? t({ bn: "কর্মী", en: "staff" })} · {t({ bn: "ঢাকা", en: "Dhaka" })} {dhakaTime(decision.createdAt)}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{decision.reason}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t({ bn: "যাচাইকৃত ট্র্যাক:", en: "Verified tracks:" })}{" "}
                {decision.verifiedTracks.length > 0
                  ? decision.verifiedTracks.map((id) => t(trackLabel(id))).join(", ")
                  : t({ bn: "কোনোটিই নয়", en: "none" })}
                {decision.missingTracks.length > 0 && (
                  <>
                    {" · "}
                    {t({ bn: "বাকি:", en: "Missing:" })} {decision.missingTracks.map((id) => t(trackLabel(id))).join(", ")}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-2 rounded-lg border border-border bg-background p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <p className="text-xs font-medium">{t({ bn: "সিদ্ধান্ত নথিভুক্ত করুন (IT)", en: "Record a decision (IT)" })}</p>
        <select
          aria-label={t({ bn: "সিদ্ধান্ত", en: "Decision" })}
          className="h-9 rounded-md border border-border bg-card px-2 text-xs"
          value={action}
          onChange={(event) => setAction(event.target.value as "enable" | "disable")}
        >
          <option value="enable">{t({ bn: "সিঙ্ক চালু", en: "Enable sync" })}</option>
          <option value="disable">{t({ bn: "সিঙ্ক বন্ধ", en: "Disable sync" })}</option>
        </select>
        <textarea
          aria-label={t({ bn: "কারণ", en: "Reason" })}
          className="min-h-16 w-full rounded-md border border-border bg-card p-2 text-xs"
          placeholder={t({ bn: "সিদ্ধান্তের কারণ লিখুন — access token বা গোপন মান কখনও নয়", en: "Why this decision — never an access token or secret value" })}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={save.isPending || reason.trim().length < 10}>
            {save.isPending ? t({ bn: "সংরক্ষণ হচ্ছে…", en: "Saving…" }) : t({ bn: "নথিভুক্ত করুন", en: "Record" })}
          </Button>
          {save.data && !save.data.ok && (
            <p className="text-[11px] text-destructive">
              {save.data.code === "VERIFICATION_INCOMPLETE"
                ? t({
                    bn: `যাচাই অসম্পূর্ণ — আগে প্রমাণ দরকার: ${save.data.missingTracks.map((id) => t(trackLabel(id))).join(", ")}`,
                    en: `Verification incomplete — evidence needed first: ${save.data.missingTracks.map((id) => t(trackLabel(id))).join(", ")}`,
                  })
                : save.data.code === "NOTE_CONTAINS_CREDENTIAL"
                  ? t({ bn: "এই লেখায় token-সদৃশ মান আছে — সেটি সংরক্ষণ করা যাবে না।", en: "This reason looks like it contains a token — it cannot be stored." })
                  : save.data.code === "FORBIDDEN"
                    ? t({ bn: "শুধু IT কর্মী সিদ্ধান্ত নথিভুক্ত করতে পারেন।", en: "Only IT staff can record decisions." })
                    : t({ bn: "সংরক্ষণ হয়নি; কারণ ১০–৫০০ অক্ষরের হতে হবে।", en: "Not saved; the reason must be 10–500 characters." })}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
