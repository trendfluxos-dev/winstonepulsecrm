import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { inspectMetaConnection } from "@/lib/meta-connection-test.functions";
import type { MetaCheck } from "@/lib/meta-connection-test.server";

const reasons: Record<string, { bn: string; en: string }> = {
  CONFIGURATION_REQUIRED: { bn: "প্রয়োজনীয় নিরাপদ App/Page সেটআপ অসম্পূর্ণ।", en: "Required secure App/Page configuration is incomplete." },
  PAGE_MISMATCH: { bn: "Token-এর Page নির্বাচিত Page-এর সঙ্গে মেলেনি।", en: "The token's Page does not match the configured Page." },
  ACCESS_REJECTED: { bn: "Meta এই পড়ার অনুরোধে অনুমতি দেয়নি।", en: "Meta rejected access to this read request." },
  PAGE_APP_NOT_SUBSCRIBED: { bn: "Page-এর subscription-এ নির্বাচিত App পাওয়া যায়নি।", en: "The selected App was not found in Page subscriptions." },
  INCOMPLETE_SUBSCRIPTION_READ: { bn: "Subscription তালিকা অসম্পূর্ণ; অনুমোদন নিশ্চিত নয়।", en: "Subscription list is incomplete; authorization remains unverified." },
  MESSAGES_SUBSCRIPTION_MISSING: { bn: "App ও Page উভয় স্তরে messages subscription নিশ্চিত হয়নি।", en: "Messages subscription was not confirmed at both App and Page levels." },
  APP_REVIEW_AND_PERMISSION_EVIDENCE_REQUIRED: { bn: "Subscription মিলেছে; App Review, Live mode ও messaging অনুমোদনের প্রমাণ এখনও দরকার। মেসেজ সিঙ্ক বন্ধ।", en: "Subscriptions match; App Review, Live mode and messaging permission evidence are still required. Message sync remains disabled." },
  META_CHECK_FAILED: { bn: "Meta পরীক্ষা সম্পন্ন হয়নি; গোপন মান বা মূল ত্রুটি প্রকাশ করা হয়নি।", en: "Meta check did not complete; credentials and raw errors were not exposed." },
  INVALID_META_RESPONSE: { bn: "Meta-এর উত্তর যাচাই করা যায়নি।", en: "Meta response could not be validated." },
};
export function MetaConnectionTest() {
  const t = useT();
  const adminToken = useAdminToken();
  const inspect = useServerFn(inspectMetaConnection);
  const [result, setResult] = useState<MetaCheck | null>(null);
  const [pending, setPending] = useState(false);
  const [denied, setDenied] = useState(false);
  const reason = result ? reasons[result.reason] : undefined;
  async function check() {
    setPending(true); setDenied(false); setResult(null);
    try { setResult(await inspect({ data: { adminToken } })); }
    catch { setDenied(true); }
    finally { setPending(false); }
  }
  return <div className="space-y-2">
    <Button variant="outline" size="sm" disabled={pending} onClick={check}><ShieldCheck className="size-4" />{t(pending ? { bn: "পরীক্ষা চলছে…", en: "Checking…" } : { bn: "নিরাপদ Meta সংযোগ পরীক্ষা", en: "Safe Meta connection test" })}</Button>
    {denied && <p role="alert" className="text-xs text-destructive">{t({ bn: "পরীক্ষা হয়নি; পূর্ণ IT PIN দিয়ে IT Console খুলতে হবে।", en: "Not checked; unlock IT Console with the full IT PIN first." })}</p>}
    {result && <div role="status" className="space-y-1 text-xs text-muted-foreground"><p>{t({ bn: "সর্বশেষ পরীক্ষা (ঢাকা): ", en: "Last check (Dhaka): " })}{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "medium" }).format(new Date(result.checkedAt))}</p><p>{t({ bn: "Page পরিচয়: ", en: "Page identity: " })}{t(result.page === "identity_verified" ? { bn: "মিলেছে", en: "Matched" } : { bn: "যাচাই বাকি", en: "Unverified" })}</p><p>{t({ bn: "App/Page subscription: ", en: "App/Page subscription: " })}{t(result.webhook === "subscriptions_verified" ? { bn: "মিলেছে", en: "Matched" } : { bn: "যাচাই বাকি", en: "Unverified" })}</p><p>{t(reason ?? { bn: "Meta পরীক্ষা সম্পন্ন হয়নি।", en: "Meta check did not complete." })}</p></div>}
  </div>;
}