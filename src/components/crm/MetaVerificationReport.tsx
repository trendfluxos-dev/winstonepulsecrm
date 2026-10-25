import { ShieldQuestion } from "lucide-react";
import { useT } from "@/lib/i18n";
import { metaVerificationReport } from "@/lib/meta-verification-report";

/**
 * Read-only verification report: Messenger approval, Page subscription and
 * old-token revocation as three separate evidence tracks. Preparation only —
 * no live provider call, no invented timestamp.
 */
export function MetaVerificationReport() {
  const t = useT();
  const report = metaVerificationReport();
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
        {report.tracks.map((track) => (
          <li key={track.id} className="rounded-lg border border-border bg-background p-2.5">
            <p className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
              <span>{t(track.label)}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t({ bn: "অযাচাইকৃত", en: "Unverified" })}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t(track.evidence)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              <span className="font-medium">{t({ bn: "প্রয়োজন:", en: "Needed:" })}</span> {t(track.blocker)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t({ bn: "সর্বশেষ যাচাই (ঢাকা): পরীক্ষা হয়নি", en: "Last verification (Dhaka): not checked" })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
