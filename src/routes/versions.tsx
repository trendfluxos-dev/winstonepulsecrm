import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Globe, Smartphone, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPhoneUpgradePreparation, requestPhoneUpgradeBill } from "@/lib/phone-upgrade.functions";
import { useT } from "@/lib/i18n";

const preparation = queryOptions({ queryKey: ["phone-upgrade-preparation"], queryFn: () => getPhoneUpgradePreparation(), staleTime: 60_000, retry: false });
export const Route = createFileRoute("/versions")({
  head: () => ({ meta: [
    { title: "Version choices — Winstone Pulse" },
    { name: "description", content: "Winstone Pulse Preview access and phone upgrade preparation with Architect-only payment approval." },
    { property: "og:title", content: "Version choices — Winstone Pulse" },
    { property: "og:description", content: "Preview access and phone upgrade preparation; pricing awaits owner confirmation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(preparation),
  component: VersionChoices,
});
function VersionChoices() {
  const t = useT();
  const { data } = useSuspenseQuery(preparation);
  const requestBill = useServerFn(requestPhoneUpgradeBill);
  const bill = useMutation({ mutationFn: () => requestBill({ data: {} }) });
  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-4 py-8 sm:px-6">
    <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="size-4" />Winstone Pulse</Link></Button>
    <header className="space-y-2"><h1 className="text-2xl font-semibold">{t({ en: "Choose your version", bn: "আপনার সংস্করণ বেছে নিন" })}</h1><p className="text-sm text-muted-foreground">{t({ en: "Monthly maintenance and existing account permissions remain unchanged.", bn: "মাসিক রক্ষণাবেক্ষণ ও বর্তমান অ্যাকাউন্টের অনুমতি অপরিবর্তিত থাকবে।" })}</p></header>
    <div className="grid gap-4 md:grid-cols-2">
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Globe className="size-6 text-primary" /><h2 className="text-lg font-semibold">{t({ en: "Continue Preview", bn: "Preview ব্যবহার চালিয়ে যান" })}</h2>
        <p className="text-sm">{t({ en: "No new phone-upgrade payment required.", bn: "নতুন ফোন আপডেটের পেমেন্ট লাগবে না।" })}</p>
        <Button asChild className="w-full"><Link to="/signin">{t({ en: "Continue", bn: "চালিয়ে যান" })}</Link></Button>
        <p className="text-xs text-muted-foreground">{data.legacyRelease ? `${t({ en: "Pre-midnight release record", bn: "মধ্যরাতের আগের সংস্করণ রেকর্ড" })}: ${data.legacyRelease.versionName}` : t({ en: "Pre-midnight phone release is not confirmed.", bn: "মধ্যরাতের আগের ফোন সংস্করণ নিশ্চিত নয়।" })}</p>
        {data.archiveState !== "verified" && <p className="text-xs text-muted-foreground">{t({ en: "Archived older APK is not verified; no old-build download is offered.", bn: "পুরনো APK সংরক্ষণ যাচাই হয়নি; পুরনো ফাইলের ডাউনলোড দেওয়া হচ্ছে না।" })}</p>}
      </section>
      <section className="space-y-4 rounded-lg border border-border bg-card p-5">
        <Smartphone className="size-6 text-primary" /><h2 className="text-lg font-semibold">{t({ en: "Updated phone version", bn: "আপডেট করা ফোন সংস্করণ" })}</h2>
        <p className="text-sm font-medium text-warning">{t({ en: "Price awaiting owner confirmation", bn: "মূল্য মালিকের নিশ্চিতকরণের অপেক্ষায়" })}</p>
        <p className="flex items-start gap-2 text-sm"><LockKeyhole className="mt-0.5 size-4 shrink-0" />{t({ en: "Payment must be verified by the Architect before unlock.", bn: "আনলকের আগে Architect-কে পেমেন্ট যাচাই করতে হবে।" })}</p>
        <Button variant="outline" className="w-full" onClick={() => bill.mutate()} disabled={bill.isPending}>{t({ en: "Upgrade bill status", bn: "আপডেট বিলের অবস্থা" })}</Button>
        {bill.isError && <p role="alert" className="text-sm text-warning">{t({ en: "No payable bill yet. Owner pricing, payer and final release confirmation are required before activation.", bn: "এখনো পরিশোধযোগ্য বিল নেই। চালুর আগে মালিকের মূল্য, প্রদানকারী ও চূড়ান্ত সংস্করণের নিশ্চিতকরণ লাগবে।" })}</p>}
      </section>
    </div>
  </main>;
}