import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { APP_VERSION, BUILD_STAMP, buildChannel, formatBuildStamp, type BuildChannel } from "@/lib/build-info";

/** Small version line so staff can confirm they are on the published live build. */
export function BuildBadge({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const [channel, setChannel] = useState<BuildChannel | null>(null);
  useEffect(() => setChannel(buildChannel(window.location.hostname)), []);
  const stamp = formatBuildStamp(BUILD_STAMP);
  const isLive = channel === "live";
  const label = channel === null ? "…" : isLive ? t({ bn: "লাইভ", en: "Live" }) : t({ bn: "প্রিভিউ", en: "Preview" });
  const title = `${label} · v${APP_VERSION} · ${t({ bn: "বিল্ড", en: "Build" })} ${stamp} (Dhaka)`;
  return (
    <div
      className="flex items-center gap-1.5 text-[10px] leading-tight text-muted-foreground"
      title={title}
      aria-label={title}
      data-testid="build-badge"
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${isLive ? "bg-success" : "bg-warning"}`}
      />
      {!compact && (
        <span className="truncate">
          <span className="font-semibold text-foreground">{label}</span> · v{APP_VERSION} · {stamp}
        </span>
      )}
    </div>
  );
}
