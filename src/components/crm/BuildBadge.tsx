import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { APP_VERSION, BUILD_STAMP, buildChannel, formatBuildStamp, type BuildChannel } from "@/lib/build-info";

/**
 * Small version line so staff can confirm they are on the published live build.
 * Screen readers get one full sentence; the dot is decorative because the
 * Live/Preview word always carries the meaning (never colour alone).
 */
export function BuildBadge({ compact = false }: { compact?: boolean }) {
  const [channel, setChannel] = useState<BuildChannel | null>(null);
  useEffect(() => setChannel(buildChannel(window.location.hostname)), []);
  return <BuildBadgeView channel={channel} compact={compact} />;
}

/** Presentational part; `channel === null` means the address is still being checked. */
export function BuildBadgeView({ channel, compact = false }: { channel: BuildChannel | null; compact?: boolean }) {
  const t = useT();
  const stamp = formatBuildStamp(BUILD_STAMP);
  const isLive = channel === "live";
  const label =
    channel === null ? t({ bn: "যাচাই হচ্ছে", en: "Checking" }) : isLive ? t({ bn: "লাইভ", en: "Live" }) : t({ bn: "প্রিভিউ", en: "Preview" });
  const spoken = t({
    bn: `CRM সংস্করণ: ${label}, ভার্সন ${APP_VERSION}, প্রকাশিত ${stamp} ঢাকা সময়`,
    en: `CRM version: ${label}, version ${APP_VERSION}, published ${stamp} Dhaka time`,
  });
  return (
    <p
      className="flex items-center gap-1.5 text-[11px] leading-tight text-foreground/80"
      title={spoken}
      data-testid="build-badge"
      data-channel={channel ?? "unknown"}
    >
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ring-1 ring-foreground/20 ${isLive ? "bg-success" : "bg-warning"}`}
      />
      <span className="sr-only" data-testid="build-badge-sr">{spoken}</span>
      {!compact && (
        <span aria-hidden="true" className="truncate" data-testid="build-badge-visible">
          <span className="font-semibold text-foreground">{label}</span> · v{APP_VERSION} · {stamp}
        </span>
      )}
    </p>
  );
}
