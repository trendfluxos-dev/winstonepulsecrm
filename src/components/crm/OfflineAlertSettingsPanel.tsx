import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOfflineAlertConfig, saveOfflineAlertConfig } from "@/lib/offline-alert.functions";
import { offlineAlertSchema } from "@/lib/offline-alert-config";
import { useAdminToken } from "@/lib/local-session";

/** IT Console: when agents are warned about offline call reports that have not reached the server. */
export function OfflineAlertSettingsPanel() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const read = useServerFn(getOfflineAlertConfig);
  const save = useServerFn(saveOfflineAlertConfig);
  const config = useQuery({ queryKey: ["offline-alert-config"], queryFn: () => read({ data: { adminToken } }) });
  const [syncing, setSyncing] = useState("");
  const [notSent, setNotSent] = useState("");
  useEffect(() => {
    if (config.data) {
      setSyncing(String(config.data.syncingMinutes));
      setNotSent(String(config.data.notSentMinutes));
    }
  }, [config.data]);

  const parsed = offlineAlertSchema.safeParse({ syncingMinutes: Number(syncing), notSentMinutes: Number(notSent) });
  const error = parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid value";

  const mutation = useMutation({
    mutationFn: () => save({ data: { adminToken, syncingMinutes: Number(syncing), notSentMinutes: Number(notSent) } }),
    onSuccess: () => {
      toast.success("অ্যালার্টের সময় সেভ হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["offline-alert-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-elevated space-y-3 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BellRing className="size-4 text-primary" /> অফলাইন রিপোর্ট অ্যালার্ট
        <span className="text-xs font-normal text-muted-foreground">Offline report alerts</span>
      </h3>
      <p className="text-xs text-muted-foreground">
        এজেন্টের ফোনে কল রিপোর্ট কতক্ষণ আটকে থাকলে সতর্কতা দেখাবে। Applies to every agent's phone.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="alert-syncing">"Syncing"-এ আটকে থাকলে (মিনিট, ১–৩০)</Label>
          <Input id="alert-syncing" type="number" inputMode="numeric" min={1} max={30} value={syncing} onChange={(e) => setSyncing(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="alert-not-sent">"Sent" না হলে (মিনিট, ৫–২৪০)</Label>
          <Input id="alert-not-sent" type="number" inputMode="numeric" min={5} max={240} value={notSent} onChange={(e) => setNotSent(e.target.value)} />
        </div>
      </div>
      {error && config.data ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <Button type="button" size="sm" disabled={!config.data || !!error || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null} সেভ করুন
      </Button>
    </section>
  );
}
