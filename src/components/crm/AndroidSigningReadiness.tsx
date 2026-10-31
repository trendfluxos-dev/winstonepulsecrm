import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleAlert, KeyRound, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getAndroidSigningReadiness } from "@/lib/github-status.functions";
import { CRM_REPOSITORY } from "@/lib/github-access";
import {
  FINGERPRINT_VARIABLE,
  LIVE_PACKAGE_ID,
  REQUIRED_SIGNING_SECRETS,
  TEST_PACKAGE_ID,
} from "@/lib/android-signing-readiness";
import { useT } from "@/lib/i18n";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * Live agent app signing readiness (full IT PIN). Lists setting NAMES only, never values, and never
 * starts a build. Explains the blocker and the only valid path that needs no signing settings.
 */
export function AndroidSigningReadiness() {
  const t = useT();
  const adminToken = useAdminToken();
  const [asked, setAsked] = useState(false);
  const load = useServerFn(getAndroidSigningReadiness);
  const q = useQuery({
    queryKey: ["android-signing-readiness", CRM_REPOSITORY],
    queryFn: () => load({ data: { adminToken: getAdminToken(), repository: CRM_REPOSITORY } }),
    enabled: asked && !!adminToken,
    retry: false,
  });
  const d = q.data;
  const verdictBadge = !d ? null : d.verdict === "ready" ? (
    <Badge>
      {t({ en: "Ready for a signed live build", bn: "সাইন করা লাইভ build-এর জন্য প্রস্তুত" })}
    </Badge>
  ) : d.verdict === "blocked" ? (
    <Badge variant="destructive">
      {t({ en: "Live build blocked", bn: "লাইভ build আটকে আছে" })}
    </Badge>
  ) : (
    <Badge variant="secondary">{t({ en: "Could not check", bn: "যাচাই করা যায়নি" })}</Badge>
  );

  const row = (ok: boolean | null, label: string) => (
    <li className="flex items-start gap-2">
      {ok === null ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      ) : ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      )}
      <span className="min-w-0 break-words font-mono text-xs">{label}</span>
    </li>
  );

  return (
    <section
      className="card-elevated space-y-4 p-5"
      aria-label={t({ en: "Live agent app signing", bn: "লাইভ এজেন্ট অ্যাপ সাইনিং" })}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4 text-primary" />
            {t({ en: "Live agent app signing", bn: "লাইভ এজেন্ট অ্যাপ সাইনিং" })}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t({
              en: `Checks ${CRM_REPOSITORY} for the company signing settings by name only. Values are never read or shown, and this never starts a build.`,
              bn: `${CRM_REPOSITORY}-এ কোম্পানির সাইনিং সেটিং শুধু নাম দিয়ে যাচাই করে। মান কখনো পড়া বা দেখানো হয় না, আর এটি কোনো build শুরু করে না।`,
            })}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          disabled={!adminToken || q.isFetching}
          onClick={() => (asked ? void q.refetch() : setAsked(true))}
        >
          <RefreshCw className={q.isFetching ? "size-4 animate-spin" : "size-4"} />
          {asked
            ? t({ en: "Check again", bn: "আবার যাচাই" })
            : t({ en: "Check signing readiness", bn: "সাইনিং প্রস্তুতি যাচাই" })}
        </Button>
      </div>

      {!adminToken && (
        <p className="text-sm text-muted-foreground">
          {t({
            en: "Unlock IT Console with the full IT PIN first.",
            bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।",
          })}
        </p>
      )}
      {q.isError && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

      {d && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {verdictBadge}
            <span className="text-xs text-muted-foreground">
              {t({ en: "Checked", bn: "যাচাই" })}: {when(d.checkedAt)}
            </span>
          </div>
          {d.verdict === "check_failed" && (
            <p className="text-sm text-muted-foreground">
              {d.readStatus === "no_admin_access"
                ? t({
                    en: "The linked GitHub account can't list this repository's settings (admin access needed). Nothing is assumed missing or present.",
                    bn: "যুক্ত GitHub অ্যাকাউন্ট এই রিপোজিটরির সেটিং দেখতে পারে না (admin অ্যাক্সেস লাগবে)। কিছুই আছে বা নেই ধরা হয়নি।",
                  })
                : t({
                    en: "GitHub could not be read just now. Nothing is assumed missing or present; try again.",
                    bn: "এই মুহূর্তে GitHub পড়া যায়নি। কিছুই আছে বা নেই ধরা হয়নি; আবার চেষ্টা করুন।",
                  })}
            </p>
          )}
          {d.verdict !== "check_failed" && (
            <ul
              className="space-y-1.5"
              aria-label={t({ en: "Required settings", bn: "প্রয়োজনীয় সেটিং" })}
            >
              {REQUIRED_SIGNING_SECRETS.map((n) =>
                row(
                  !d.missingSecrets.includes(n),
                  `${n} — ${t({ en: "secret", bn: "গোপন সেটিং" })}`,
                ),
              )}
              {row(
                d.fingerprintRecorded,
                `${FINGERPRINT_VARIABLE} — ${t({ en: "public company fingerprint", bn: "কোম্পানির পাবলিক fingerprint" })}`,
              )}
            </ul>
          )}

          {d.verdict === "blocked" && (
            <div className="space-y-3 rounded-md border border-destructive/40 p-3 text-sm">
              <p className="font-medium">
                {t({
                  en: "No signed live app will be built or offered to agents until every item above is present.",
                  bn: "উপরের সবগুলো না থাকা পর্যন্ত কোনো সাইন করা লাইভ অ্যাপ তৈরি বা এজেন্টদের দেওয়া হবে না।",
                })}
              </p>
              <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed">
                <li>
                  {t({
                    en: "Only the IT person who holds the backed-up company key made under the 28 Oct 2026 decision can add these, in GitHub → repository Settings → Secrets and variables → Actions. They are never pasted into the CRM or chat.",
                    bn: "২৮ অক্টোবর ২০২৬-এর সিদ্ধান্ত অনুযায়ী তৈরি ও ব্যাকআপ রাখা কোম্পানির কী যে IT ব্যক্তির কাছে আছে, শুধু তিনিই GitHub → রিপোজিটরি Settings → Secrets and variables → Actions-এ এগুলো যোগ করবেন। CRM বা চ্যাটে কখনো পেস্ট করা হবে না।",
                  })}
                </li>
                <li>
                  {t({
                    en: "Do not use the old key — it was retired on 28 Oct 2026 because it may be exposed. It is removed from the current code but old copies remain in code history.",
                    bn: "পুরনো কী ব্যবহার করবেন না — সম্ভাব্য ফাঁস হওয়ার কারণে ২৮ অক্টোবর ২০২৬-এ এটি বাতিল করা হয়েছে। বর্তমান কোড থেকে সরানো হয়েছে, তবে পুরনো কপি কোডের ইতিহাসে রয়ে গেছে।",
                  })}
                </li>
                <li>
                  {t({
                    en: `Do not create a new key or change the app ID (${LIVE_PACKAGE_ID}). Agents' installed app would stop updating in place.`,
                    bn: `নতুন কী তৈরি বা অ্যাপ ID (${LIVE_PACKAGE_ID}) বদলাবেন না। এজেন্টদের ইনস্টল করা অ্যাপ আর সরাসরি আপডেট হবে না।`,
                  })}
                </li>
                <li>
                  {t({
                    en: "If the key backup is lost, stop and decide with the owner before anything else: any replacement key means every agent must uninstall and reinstall.",
                    bn: "কী-এর ব্যাকআপ হারিয়ে গেলে আগে মালিকের সাথে সিদ্ধান্ত নিন: যেকোনো নতুন কী মানে প্রত্যেক এজেন্টকে আনইনস্টল করে আবার ইনস্টল করতে হবে।",
                  })}
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">
                {t({
                  en: "Google Play App Signing is not set up for this app (it is installed directly, not from Play), so it can't stand in for these settings.",
                  bn: "এই অ্যাপের জন্য Google Play App Signing চালু নেই (Play থেকে নয়, সরাসরি ইনস্টল হয়), তাই এটি এই সেটিংগুলোর বিকল্প হতে পারে না।",
                })}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-md border p-3 text-xs leading-relaxed">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <span className="font-medium">
                {t({ en: "Path with no signing settings: ", bn: "সাইনিং সেটিং ছাড়া পথ: " })}
              </span>
              {t({
                en: `the test app (${TEST_PACKAGE_ID}). It connects to the live CRM and passes the same version and checksum checks, but it is a separate app on the phone — it is never labelled or offered as the live app.`,
                bn: `টেস্ট অ্যাপ (${TEST_PACKAGE_ID})। এটি লাইভ CRM-এ যুক্ত হয় এবং একই ভার্সন ও চেকসাম যাচাই পার হয়, কিন্তু ফোনে এটি আলাদা অ্যাপ — কখনো লাইভ অ্যাপ হিসেবে দেখানো বা দেওয়া হয় না।`,
              })}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
