import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";
import { getAgentWhatsAppAdmin, setAgentWhatsAppEnabled } from "@/lib/agent-whatsapp.functions";

const REVIEW: Record<string, { en: string; bn: string }> = {
  APPROVED: { en: "Approved", bn: "অনুমোদিত" },
  PENDING: { en: "Waiting for Meta review", bn: "Meta-র রিভিউয়ের অপেক্ষায়" },
  REJECTED: { en: "Rejected by Meta", bn: "Meta বাতিল করেছে" },
  MISSING: { en: "Not found", bn: "পাওয়া যায়নি" },
};

/** IT master switch and health for agent WhatsApp alerts (full IT PIN; aggregates only). */
export function AgentWhatsAppAlertsPanel() {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const read = useServerFn(getAgentWhatsAppAdmin);
  const save = useServerFn(setAgentWhatsAppEnabled);
  const q = useQuery({ queryKey: ["agent-wa-admin", Boolean(adminToken)], enabled: Boolean(adminToken), queryFn: () => read({ data: { adminToken: getAdminToken() } }) });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => save({ data: { adminToken: getAdminToken(), enabled } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agent-wa-admin"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const d = q.data;
  const allApproved = d?.templates?.every((x) => x.status === "APPROVED") ?? false;

  return (
    <section className="card-elevated space-y-3 p-5" aria-label="Agent WhatsApp alerts">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><MessageCircle className="size-4 text-primary" />{t({ en: "Agent WhatsApp alerts", bn: "এজেন্ট WhatsApp alert" })}</h2>
          <p className="text-xs text-muted-foreground">{t({
            en: "Count-only messages from the business WhatsApp number to agents who opted in: new-lead alerts every 30 minutes (09:00–17:30) and own progress at 17:40 Dhaka. Fridays and holidays are skipped.",
            bn: "বিজনেস WhatsApp নম্বর থেকে যেসব এজেন্ট চালু করেছেন তাদের শুধু সংখ্যাসহ মেসেজ: প্রতি ৩০ মিনিটে নতুন লিড (০৯:০০–১৭:৩০) এবং ১৭:৪০-এ নিজের অগ্রগতি। শুক্রবার ও ছুটির দিনে বন্ধ।",
          })}</p>
        </div>
        {d && <Switch checked={d.enabled} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label={t({ en: "Send agent WhatsApp alerts", bn: "এজেন্ট WhatsApp alert পাঠানো" })} />}
      </div>
      {!adminToken && <p className="text-sm text-muted-foreground">{t({ en: "Unlock IT Console with the full IT PIN first.", bn: "আগে পূর্ণ IT PIN দিয়ে IT Console খুলুন।" })}</p>}
      {q.isError && <p className="text-sm text-destructive">{t({ en: "Alert overview could not be loaded.", bn: "Alert-এর তথ্য আনা যায়নি।" })}</p>}
      {d && (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">{t({ en: "Message templates", bn: "মেসেজ টেমপ্লেট" })}</dt>
            <dd>{d.templates ? d.templates.map((x) => <div key={x.name} className="text-xs"><span className="font-medium">{x.name}</span>: {t(REVIEW[x.status] ?? { en: x.status, bn: x.status })}</div>) : t({ en: "Could not check", bn: "যাচাই করা যায়নি" })}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t({ en: "Agents opted in", bn: "চালু করেছেন এমন এজেন্ট" })}</dt><dd className="font-semibold">{d.optedIn}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t({ en: "Alerts, last 7 days", bn: "গত ৭ দিনের alert" })}</dt>
            <dd className="text-xs">{Object.keys(d.last7Days).length === 0 ? "—" : Object.entries(d.last7Days).map(([k, v]) => `${k}: ${v}`).join(" · ")}</dd></div>
        </dl>
      )}
      {d && d.enabled && !allApproved && <p className="text-xs text-muted-foreground">{t({ en: "Sending is on, but WhatsApp will refuse messages until Meta approves both templates.", bn: "পাঠানো চালু, কিন্তু Meta দুটি টেমপ্লেট অনুমোদন না করা পর্যন্ত WhatsApp মেসেজ নেবে না।" })}</p>}
    </section>
  );
}
