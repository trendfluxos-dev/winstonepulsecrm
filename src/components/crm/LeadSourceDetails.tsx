import { useT } from "@/lib/i18n";
import { leadProvenance } from "@/lib/lead-provenance";

export function LeadSourceDetails({ source }: { source: string | null }) {
  const t = useT();
  const evidence = leadProvenance({ source });
  return <dl className="space-y-1 text-xs">
    <div className="flex flex-wrap gap-1"><dt className="text-muted-foreground">{t({ bn: "উৎস:", en: "Source:" })}</dt><dd className="break-words">{evidence.source ?? t({ bn: "সংরক্ষিত নেই", en: "Not recorded" })}</dd></div>
    {evidence.messenger && <>
      <div className="flex flex-wrap gap-1"><dt className="text-muted-foreground">{t({ bn: "মূল মেসেজ আগমনের সময় (ঢাকা):", en: "Original message arrival (Dhaka):" })}</dt><dd>{t({ bn: "সংরক্ষিত প্রমাণ নেই", en: "No recorded evidence" })}</dd></div>
      <div className="flex flex-wrap gap-1"><dt className="text-muted-foreground">{t({ bn: "সংযোগ যাচাই:", en: "Connection verification:" })}</dt><dd>{t({ bn: "যাচাই বাকি", en: "Unverified" })}</dd></div>
    </>}
  </dl>;
}