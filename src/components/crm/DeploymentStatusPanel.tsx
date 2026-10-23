import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Rocket, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { getReleaseStatus, runLiveReleaseCheck } from "@/lib/release-check.functions";

function when(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) + " Dhaka";
}

/** Shows what the live site actually serves; "deployed" only after every /manual marker passes. */
export function DeploymentStatusPanel() {
  const qc = useQueryClient();
  const load = useServerFn(getReleaseStatus);
  const run = useServerFn(runLiveReleaseCheck);
  const q = useQuery({ queryKey: ["release-status"], queryFn: () => load({ data: { adminToken: getAdminToken() } }) });
  const m = useMutation({
    mutationFn: () => run({ data: { adminToken: getAdminToken() } }),
    onSuccess: (r) => {
      if (r.lastDeployed) toast.success("Live site verified");
      else toast.error(r.error ?? "Live site does not show this release yet");
      void qc.invalidateQueries({ queryKey: ["release-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = q.data?.stored ?? null;

  return (
    <section className="card-elevated space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-primary" />
          <h2 className="font-semibold">Deployment status</h2>
        </div>
        <Button size="sm" onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Check live site
        </Button>
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <p><span className="text-muted-foreground">This build: </span>v{q.data?.expectedVersion ?? "…"}</p>
        <p><span className="text-muted-foreground">Live site shows: </span>{s?.liveVersion ? `v${s.liveVersion}` : "not checked"}</p>
        <p><span className="text-muted-foreground">Last verified deploy: </span>{s?.lastSuccessVersion ? `v${s.lastSuccessVersion} · ${when(s.lastSuccessAt)}` : "none yet"}</p>
        <p><span className="text-muted-foreground">Last check: </span>{when(s?.lastCheckAt)}</p>
      </div>
      {s?.error ? <p className="text-sm text-destructive">{s.error}</p> : null}
      {s?.results?.length ? (
        <ul className="space-y-1 text-sm">
          {s.results.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              {r.ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />}
              {r.label}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Status: {s ? (s.lastDeployed ? "Deployed — verified on crm.winstonebd.com/manual" : "Not deployed — live site differs") : "Unknown"}. Publish time is recorded as the first check that saw this version live.
      </p>
    </section>
  );
}
