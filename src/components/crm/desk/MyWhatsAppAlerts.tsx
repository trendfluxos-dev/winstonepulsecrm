import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/i18n";
import { displayAgentWhatsApp, normalizeAgentWhatsApp } from "@/lib/agent-whatsapp";
import { getMyWhatsAppAlerts, sendMyWhatsAppTest, setMyWhatsAppAlerts } from "@/lib/agent-whatsapp.functions";

const STATUS: Record<string, { en: string; bn: string }> = {
  sending: { en: "Sending", bn: "পাঠানো হচ্ছে" },
  accepted: { en: "Accepted by WhatsApp", bn: "WhatsApp গ্রহণ করেছে" },
  sent: { en: "Sent", bn: "পাঠানো হয়েছে" },
  delivered: { en: "Delivered", bn: "পৌঁছেছে" },
  read: { en: "Read", bn: "পড়া হয়েছে" },
  failed: { en: "Not delivered", bn: "পৌঁছায়নি" },
};
const KIND: Record<string, { en: string; bn: string }> = {
  new_leads: { en: "New leads", bn: "নতুন লিড" },
  daily_progress: { en: "Daily progress", bn: "দৈনিক অগ্রগতি" },
  test: { en: "Test", bn: "টেস্ট" },
};

/** Agent's own opt-in for count-only WhatsApp alerts (no customer details are ever sent). */
export function MyWhatsAppAlerts() {
  const t = useT();
  const qc = useQueryClient();
  const read = useServerFn(getMyWhatsAppAlerts);
  const save = useServerFn(setMyWhatsAppAlerts);
  const test = useServerFn(sendMyWhatsAppTest);
  const q = useQuery({ queryKey: ["my-whatsapp-alerts"], queryFn: () => read() });
  const [number, setNumber] = useState("");
  useEffect(() => { if (q.data?.number) setNumber(displayAgentWhatsApp(q.data.number)); }, [q.data?.number]);
  const valid = normalizeAgentWhatsApp(number) != null;

  const toggle = useMutation({
    mutationFn: (optedIn: boolean) => save({ data: { number, optedIn } }),
    onSuccess: (r) => {
      toast.success(r.optedIn ? t({ en: "WhatsApp alerts turned on", bn: "WhatsApp alert চালু হয়েছে" }) : t({ en: "WhatsApp alerts turned off", bn: "WhatsApp alert বন্ধ হয়েছে" }));
      void qc.invalidateQueries({ queryKey: ["my-whatsapp-alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const sendTest = useMutation({
    mutationFn: () => test(),
    onSuccess: (r) => {
      if (r.outcome === "sent") toast.success(t({ en: "Test sent — check WhatsApp in a minute", bn: "টেস্ট পাঠানো হয়েছে — এক মিনিটের মধ্যে WhatsApp দেখুন" }));
      else if (r.outcome === "duplicate") toast.info(t({ en: "You already sent today's test", bn: "আজকের টেস্ট আগেই পাঠানো হয়েছে" }));
      else toast.error(t({ en: "WhatsApp did not accept the test. Templates may still be waiting for Meta approval.", bn: "WhatsApp টেস্ট গ্রহণ করেনি। টেমপ্লেট সম্ভবত এখনো Meta-র অনুমোদনের অপেক্ষায়।" }));
      void qc.invalidateQueries({ queryKey: ["my-whatsapp-alerts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const d = q.data;
  return (
    <section className="space-y-3 rounded-lg border border-border p-3" aria-label={t({ en: "WhatsApp alerts", bn: "WhatsApp alert" })}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="size-4 text-primary" />{t({ en: "WhatsApp alerts", bn: "WhatsApp alert" })}</h3>
          <p className="text-xs text-muted-foreground">{t({
            en: "Get a WhatsApp message when new leads arrive, and your own progress after 5:30 PM. Only counts are sent — never customer names or numbers. Reply STOP to turn off.",
            bn: "নতুন লিড এলে এবং বিকেল ৫:৩০-এর পর নিজের অগ্রগতি WhatsApp-এ পাবেন। শুধু সংখ্যা পাঠানো হয় — কখনো গ্রাহকের নাম বা নম্বর নয়। বন্ধ করতে STOP লিখে উত্তর দিন।",
          })}</p>
        </div>
        {d && (
          <Switch checked={d.optedIn} disabled={toggle.isPending || (!d.optedIn && !valid)} onCheckedChange={(v) => toggle.mutate(v)}
            aria-label={t({ en: "Receive WhatsApp alerts", bn: "WhatsApp alert পেতে চাই" })} />
        )}
      </div>
      {q.isError && <p className="text-xs text-destructive">{t({ en: "Settings could not be loaded.", bn: "সেটিং আনা যায়নি।" })}</p>}
      {d && (
        <>
          <label className="block space-y-1 text-xs">
            <span className="font-medium">{t({ en: "Your WhatsApp number", bn: "আপনার WhatsApp নম্বর" })}</span>
            <Input inputMode="tel" autoComplete="tel" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="01XXX-XXXXXX" className="h-10" disabled={d.optedIn} />
          </label>
          {!valid && number && <p className="text-xs text-destructive">{t({ en: "Enter a Bangladesh mobile number.", bn: "বাংলাদেশি মোবাইল নম্বর দিন।" })}</p>}
          {d.optedOutByReply && <p className="text-xs text-muted-foreground">{t({ en: "You turned alerts off by replying STOP.", bn: "STOP লিখে আপনি alert বন্ধ করেছেন।" })}</p>}
          {!d.enabled && <p className="text-xs text-muted-foreground">{t({ en: "IT hasn't switched on WhatsApp alerts for the team yet. You can still send yourself a test.", bn: "IT এখনো টিমের জন্য WhatsApp alert চালু করেনি। তবু নিজেকে টেস্ট পাঠাতে পারবেন।" })}</p>}
          {d.optedIn && (
            <Button variant="outline" size="sm" onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
              {sendTest.isPending ? "…" : t({ en: "Send me a test", bn: "আমাকে টেস্ট পাঠান" })}
            </Button>
          )}
          {d.recent.length > 0 && (
            <ul className="space-y-1 text-xs" aria-label={t({ en: "Recent alerts", bn: "সাম্প্রতিক alert" })}>
              {d.recent.map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span>{t(KIND[r.kind] ?? { en: r.kind, bn: r.kind })} · {new Date(r.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                  <span className={r.failed ? "text-destructive" : "text-muted-foreground"}>{t(STATUS[r.status] ?? { en: r.status, bn: r.status })}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
