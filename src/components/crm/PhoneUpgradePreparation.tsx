import { Link } from "@tanstack/react-router";
import { Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

export function PhoneUpgradePreparation() {
  const t = useT();
  return <section className="space-y-3 border-y border-border py-4">
    <h2 className="flex items-center gap-2 font-semibold"><Smartphone className="size-4 text-primary" />{t({ en: "Phone upgrade preparation", bn: "ফোন আপডেটের প্রস্তুতি" })}</h2>
    <p className="text-sm font-medium text-warning">{t({ en: "Price awaiting owner confirmation", bn: "মূল্য মালিকের নিশ্চিতকরণের অপেক্ষায়" })}</p>
    <p className="text-sm text-muted-foreground">{t({ en: "Older Preview: no new upgrade fee. Updated phone: billing and distribution are not activated.", bn: "পুরনো Preview-তে নতুন আপডেট ফি নেই। নতুন ফোন সংস্করণের বিল ও বিতরণ চালু হয়নি।" })}</p>
    <p className="flex items-start gap-2 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />{t({ en: "Payment verification and unlock: verified Architect profile only. Monthly maintenance remains separate.", bn: "পেমেন্ট যাচাই ও আনলক: শুধু যাচাইকৃত Architect প্রোফাইল। মাসিক রক্ষণাবেক্ষণ বিল আলাদা থাকবে।" })}</p>
    <Button asChild size="sm" variant="outline"><Link to="/versions">{t({ en: "Version choices", bn: "সংস্করণ নির্বাচন" })}</Link></Button>
  </section>;
}