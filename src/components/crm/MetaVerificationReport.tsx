import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ShieldQuestion, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { metaVerificationReport } from "@/lib/meta-verification-report";
import { META_VERIFICATION_TRACKS, type MetaVerificationRecord } from "@/lib/meta-verification";
import { listMetaVerification, recordMetaVerification } from "@/lib/meta-verification.functions";

const dhakaTime = (iso: string) =>
  new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

/**
 * Read-only verification report plus the safe evidence checklist. The three
 * preparation tracks stay preparation-only; the four checklist tracks accept
 * staff-recorded evidence notes — never access tokens (the server rejects
 * credential-like text before storing).
 */
export function MetaVerificationReport() {
  const t = useT();
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const report = metaVerificationReport();

  const records = useQuery({
    queryKey: ["meta", "verification", adminToken],
    queryFn: () => listMetaVerification({ data: { adminToken } }),
    refetchInterval: 30000,
  });
  const latest = new Map(Object.entries(records.data && records.data.ok ? records.data.latest : {})) as Map<string, MetaVerificationRecord>;

  const [track, setTrack] = useState<string>(META_VERIFICATION_TRACKS[0].id);
  const [outcome, setOutcome] = useState<"verified" | "failed">("verified");
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => recordMetaVerification({ data: { adminToken, track: track as never, outcome, note } }),
    onSuccess: (result) => {
      if (result.ok) {
        setNote("");
        void queryClient.invalidateQueries({ queryKey: ["meta", "verification"] });
      }
    },
  });

  return (
    <section
      aria-label={t({ bn: "যাচাই প্রতিবেদন", en: "Verification report" })}
      className="space-y-2 rounded-xl border border-border bg-card p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <ShieldQuestion className="size-4 text-muted-foreground" />
        {t({ bn: "যাচাই প্রতিবেদন (শুধু পড়া)", en: "Verification report (read-only)" })}
      </p>
      <ul className="space-y-2">
        {report.tracks.map((item) => (
          <li key={item.id} className="rounded-lg border border-border bg-background p-2.5">
            <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
              <span>{t(item.label)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t({ bn: "অযাচাইকৃত", en: "Unverified" })}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t(item.evidence)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium">{t({ bn: "প্রয়োজন:", en: "Needed:" })}</span> {t(item.blocker)}
            </p>
          </li>
        ))}
      </ul>

      <p className="pt-1 text-sm font-medium">{t({ bn: "প্রমাণ চেকলিস্ট", en: "Evidence checklist" })}</p>
      <ul className="space-y-2">
        {META_VERIFICATION_TRACKS.map((item) => {
          const record = latest.get(item.id);
          return (
            <li key={item.id} className="rounded-lg border border-border bg-background p-2.5">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                <span>{t(item.label)}</span>
                {record ? (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                      record.outcome === "verified" ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {record.outcome === "verified" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                    {record.outcome === "verified" ? t({ bn: "যাচাইকৃত", en: "Verified" }) : t({ bn: "ব্যর্থ", en: "Failed" })}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                    {t({ bn: "প্রমাণ নেই", en: "No evidence" })}
                  </span>
                )}
              </p>
              {record ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {record.note} — {record.actorLabel ?? t({ bn: "কর্মী", en: "staff" })}, {t({ bn: "ঢাকা", en: "Dhaka" })} {dhakaTime(record.createdAt)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">{t(item.hint)}</p>
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
        <p className="text-xs font-medium">{t({ bn: "প্রমাণ নথিভুক্ত করুন (IT)", en: "Record evidence (IT)" })}</p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t({ bn: "চেকলিস্ট আইটেম", en: "Checklist item" })}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs"
            value={track}
            onChange={(event) => setTrack(event.target.value)}
          >
            {META_VERIFICATION_TRACKS.map((item) => (
              <option key={item.id} value={item.id}>{t(item.label)}</option>
            ))}
          </select>
          <select
            aria-label={t({ bn: "ফলাফল", en: "Outcome" })}
            className="h-9 rounded-md border border-border bg-card px-2 text-xs"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as "verified" | "failed")}
          >
            <option value="verified">{t({ bn: "যাচাইকৃত", en: "Verified" })}</option>
            <option value="failed">{t({ bn: "ব্যর্থ", en: "Failed" })}</option>
          </select>
        </div>
        <textarea
          aria-label={t({ bn: "প্রমাণের বিবরণ", en: "Evidence note" })}
          className="min-h-16 w-full rounded-md border border-border bg-card p-2 text-xs"
          placeholder={t({ bn: "কী দেখেছেন লিখুন — access token বা গোপন মান কখনও নয়", en: "Describe what you saw — never an access token or secret value" })}
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
                ? t({ bn: "এই লেখায় token-সদৃশ মান আছে — সেটি সংরক্ষণ করা যাবে না।", en: "This note looks like it contains a token — it cannot be stored." })
                : save.data.code === "FORBIDDEN"
                  ? t({ bn: "শুধু IT কর্মী প্রমাণ নথিভুক্ত করতে পারেন।", en: "Only IT staff can record evidence." })
                  : t({ bn: "সংরক্ষণ হয়নি; বিবরণ ১০–৫০০ অক্ষরের হতে হবে।", en: "Not saved; the note must be 10–500 characters." })}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
