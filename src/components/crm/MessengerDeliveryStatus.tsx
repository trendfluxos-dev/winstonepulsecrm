import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useAdminToken } from "@/lib/local-session";
import { getMessengerDeliverySummary } from "@/lib/messenger-delivery.functions";

/**
 * Webhook delivery diagnostics on /inbox: receipt processing, delivery/read
 * counts, outbox retry state and the latest failure code. Counts only — never
 * message content. While ingestion is off every count is genuinely zero.
 */
export function MessengerDeliveryStatus() {
  const t = useT();
  const adminToken = useAdminToken();
  const query = useQuery({
    queryKey: ["messenger", "delivery-summary", adminToken],
    queryFn: () => getMessengerDeliverySummary({ data: { adminToken } }),
    refetchInterval: 30000,
  });

  const summary = query.data?.ok ? query.data.summary : null;

  return (
    <section
      aria-label={t({ bn: "Webhook ডেলিভারি অবস্থা", en: "Webhook delivery status" })}
      className="space-y-2 rounded-xl border border-border bg-card p-3"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Activity className="size-4 text-muted-foreground" />
        {t({ bn: "Webhook ডেলিভারি অবস্থা", en: "Webhook delivery status" })}
      </p>
      {query.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> {t({ bn: "লোড হচ্ছে…", en: "Loading…" })}
        </p>
      )}
      {!query.isLoading && !summary && (
        <p className="text-xs text-muted-foreground">
          {t({ bn: "ডেলিভারি তথ্য পড়া যায়নি; সংযোগ বন্ধ থাকায় এটি প্রত্যাশিত।", en: "Delivery data could not be read; expected while the connection is off." })}
        </p>
      )}
      {summary && !summary.storageReady && (
        <p className="text-xs text-muted-foreground">
          {t({ bn: "স্থায়ী সংরক্ষণ এই পরিবেশে পড়া যাচ্ছে না — খালি ইতিহাস ধরে নেওয়া হয়নি।", en: "Durable storage is not readable in this environment — not assumed empty." })}
        </p>
      )}
      {summary?.storageReady && (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-background p-2">
              <dt className="text-muted-foreground">{t({ bn: "গৃহীত ইভেন্ট", en: "Receipts" })}</dt>
              <dd className="text-sm font-semibold">{summary.receipts.total}</dd>
            </div>
            <div className="rounded-lg bg-background p-2">
              <dt className="text-muted-foreground">{t({ bn: "অপেক্ষমাণ", en: "Pending" })}</dt>
              <dd className="text-sm font-semibold">{summary.receipts.pending}</dd>
            </div>
            <div className="rounded-lg bg-background p-2">
              <dt className="text-muted-foreground">{t({ bn: "ডেলিভারি/পঠিত", en: "Delivery/read" })}</dt>
              <dd className="text-sm font-semibold">{summary.statuses.delivery}/{summary.statuses.read}</dd>
            </div>
            <div className="rounded-lg bg-background p-2">
              <dt className="text-muted-foreground">{t({ bn: "পুনঃচেষ্টা বাকি", en: "Retries left" })}</dt>
              <dd className="text-sm font-semibold">{summary.outbox.pendingRetries}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">
            {summary.lastFailure
              ? t({ bn: `সর্বশেষ ব্যর্থতা: ${summary.lastFailure.code}`, en: `Latest failure: ${summary.lastFailure.code}` })
              : t({ bn: "কোনো ব্যর্থতা রেকর্ড হয়নি; সিঙ্ক বন্ধ থাকায় বাস্তব ডেলিভারিও নেই।", en: "No failure recorded; with sync off there are no real deliveries either." })}
          </p>
        </>
      )}
    </section>
  );
}
