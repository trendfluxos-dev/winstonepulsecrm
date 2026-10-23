import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled billing reminder: raises the current month's invoice if missing,
 * flips lapsed invoices to overdue, and alerts HQ/IT when a bill becomes due
 * or goes overdue. Caller must present the cron secret.
 */
export const Route = createFileRoute("/api/public/hooks/service-billing")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const header =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stored } = await supabaseAdmin
          .from("system_settings")
          .select("value")
          .eq("key", "shift_cron_secret")
          .maybeSingle();
        const storedSecret =
          stored && typeof stored.value === "object" && stored.value !== null
            ? (stored.value as { secret?: string }).secret
            : undefined;

        const accepted = [
          process.env["SHIFT_CRON_SECRET"],
          process.env["LOVABLE_CRON_SECRET"],
          storedSecret,
        ].filter((value): value is string => Boolean(value));
        if (accepted.length === 0 || !header || !accepted.includes(header)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Daily (10:00 Dhaka) maintenance reminders for HQ/IT: renewal day
        // (12th) and each grace day (13th, 14th) while payment is not verified.
        // Deduped per period+day; never pays or approves anything.
        const m = await import("@/lib/maintenance.server");
        const state = await m.maintenanceAccess();
        const day = Number(
          new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric" }).format(new Date()),
        );
        if (state.paymentStatus === "verified" || state.locked || day < 12 || day > 14) {
          return Response.json({ ok: true, sent: false, day, payment: state.paymentStatus });
        }
        const lock = new Date(state.lockAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
        const msg: Record<number, [string, string]> = {
          12: ["মাসিক আর্কিটেকচার চার্জ — পেমেন্ট যাচাই বাকি", "$35.29 USD (১৫% VAT সহ) ১৫ তারিখ ০০:০০ (ঢাকা)-র আগে যাচাই হতে হবে।"],
          13: ["আর্কিটেকচার চার্জ এখনো যাচাই হয়নি", "$35.29 USD (VAT সহ) এখনো যাচাই হয়নি। শেষ সময় ১৫ তারিখ ০০:০০ (ঢাকা)।"],
          14: ["আজ গ্রেসের শেষ দিন — রাত ১২টায় লক", "$35.29 USD (VAT সহ) যাচাই না হলে ১৫ তারিখ ০০:০০ (ঢাকা)-তে CRM লক হবে।"],
        };
        const [title, body] = msg[day]!;
        const sent = await m.notifyOnce(
          `maintenance_reminder_${state.period}_d${day}`,
          day === 12 ? "warning" : "critical",
          title,
          `${body} লক সময়: ${lock} (ঢাকা)। পেমেন্ট অবস্থা: ${state.paymentStatus}। IT Console-এ পেমেন্ট রেফারেন্স দিন।`,
        );
        return Response.json({ ok: true, sent, day });
      },
    },
  },
});
