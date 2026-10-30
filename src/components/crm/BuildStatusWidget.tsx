import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Smartphone } from "lucide-react";
import { getAdminToken, useAdminToken } from "@/lib/local-session";
import { getAndroidBuilds } from "@/lib/github-status.functions";
import { useT } from "@/lib/i18n";

const REPO = "Winstone-BD/winstone-pulse-crm";
const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }) : "—";

/** Compact, read-only APK build chip shown across IT Console pages. Hidden unless the full IT PIN read succeeds. */
export function BuildStatusWidget() {
  const t = useT();
  const adminToken = useAdminToken();
  const load = useServerFn(getAndroidBuilds);
  const q = useQuery({
    queryKey: ["android-builds", REPO],
    queryFn: () => load({ data: { adminToken: getAdminToken(), repository: REPO } }),
    enabled: !!adminToken,
    refetchInterval: (query) => { const r = query.state.data?.runs[0]; return r && r.status !== "completed" ? 30000 : 300000; },
    retry: false,
  });
  const r = q.data?.runs[0];
  if (!adminToken || q.isError || !r) return null;
  const running = r.status !== "completed";
  const ok = r.conclusion === "success";
  const elapsedMin = Math.max(0, Math.round((Date.now() - new Date(r.startedAt).getTime()) / 60000));
  const pct = Math.min(95, Math.round((elapsedMin / 15) * 100));
  const label = running
    ? t({ en: `Building… ${elapsedMin} min (usually ~15)`, bn: `তৈরি হচ্ছে… ${elapsedMin} মিনিট (সাধারণত ~১৫)` })
    : ok ? t({ en: `APK ready · finished ${time(r.updatedAt)}`, bn: `APK প্রস্তুত · শেষ ${time(r.updatedAt)}` })
      : t({ en: `Build failed · ${time(r.updatedAt)}`, bn: `build ব্যর্থ · ${time(r.updatedAt)}` });
  return (
    <Link to="/system" aria-label={t({ en: "Android build status", bn: "Android build অবস্থা" })}
      className="card-elevated fixed bottom-20 left-3 z-40 w-60 space-y-1.5 p-3 text-xs md:bottom-4">
      <span className="flex items-center gap-1.5 font-medium">
        <Smartphone className={running ? "size-3.5 animate-pulse text-primary" : ok ? "size-3.5 text-primary" : "size-3.5 text-destructive"} />
        {label}
      </span>
      {running && <span className="block h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></span>}
      <span className="block text-muted-foreground">{t({ en: `Started ${time(r.startedAt)} · ${r.sha}`, bn: `শুরু ${time(r.startedAt)} · ${r.sha}` })}</span>
    </Link>
  );
}
