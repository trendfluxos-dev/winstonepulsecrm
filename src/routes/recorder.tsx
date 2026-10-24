import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Phone, PhoneIncoming, Play, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildCallInsight, getRecorderPlayback, listRecorderHistory, retryVoiceNoteFn, saveVoiceNote } from "@/lib/recorder.functions";

export const Route = createFileRoute("/recorder")({
  head: () => ({
    meta: [
      { title: "Recorder — Winstone Pulse" },
      { name: "description", content: "Call and voice recordings with automatic transcript, AI summary, key takeaways and action items." },
      { property: "og:title", content: "Recorder — Winstone Pulse" },
      { property: "og:description", content: "Call history with transcripts, AI summaries, takeaways and action items." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecorderPage,
});

type Item = Awaited<ReturnType<typeof listRecorderHistory>>["items"][number];

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  if (typeof MediaRecorder === "undefined") return "";
  return options.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the recording"));
    r.readAsDataURL(blob);
  });
}

const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function RecorderPage() {
  const qc = useQueryClient();
  const list = useServerFn(listRecorderHistory);
  const save = useServerFn(saveVoiceNote);
  const history = useQuery({ queryKey: ["recorder-history"], queryFn: () => list({ data: {} }) });
  const [filter, setFilter] = useState<"all" | "call" | "voice">("all");

  const items = (history.data?.items ?? []).filter((i) => filter === "all" || i.kind === filter);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-3 py-5 sm:px-5">
        <header className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Mic className="size-5" /></span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold sm:text-2xl">রেকর্ডার</h1>
            <p className="text-xs text-muted-foreground">কল ও ভয়েস নোট — লেখা, AI সারাংশ, মূল বিষয় ও করণীয়</p>
          </div>
        </header>

        {!history.data?.readOnly && (
          <VoiceNoteRecorder
            onSave={async (blob, seconds) => {
              const audioBase64 = await toBase64(blob);
              const res = await save({ data: { audioBase64, mimeType: blob.type || "audio/webm", durationSeconds: seconds } });
              if (res.ok) toast.success("ভয়েস নোট সেভ ও সারাংশ তৈরি হয়েছে");
              else toast.error(res.error ?? "সারাংশ তৈরি হয়নি");
              await qc.invalidateQueries({ queryKey: ["recorder-history"] });
            }}
          />
        )}

        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium">অটো কল রেকর্ডিং</p>
            <p className="text-muted-foreground">
              Android: Winstone অ্যাপ প্রতিটি কল নিজে রেকর্ড করে বা ফোনের নিজস্ব কল রেকর্ডারের ফাইল তুলে নেয়, তারপর এখানে দেখায়।
              iPhone: Apple কোনো অ্যাপকে ফোন কল রেকর্ড করতে দেয় না — কলের পরে উপরের বোতামে ভয়েস নোট রাখুন।
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          {(["all", "call", "voice"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "সব" : f === "call" ? "কল" : "ভয়েস নোট"}
            </Button>
          ))}
        </div>

        {history.isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p>}
        {history.error && <p className="text-sm text-destructive">{(history.error as Error).message}</p>}
        {!history.isLoading && !history.error && items.length === 0 && (
          <p className="text-sm text-muted-foreground">এখনও কোনো রেকর্ডিং নেই।</p>
        )}
        <div className="space-y-3">
          {items.map((item) => <HistoryCard key={`${item.kind}-${item.id}`} item={item} readOnly={Boolean(history.data?.readOnly)} />)}
        </div>
      </div>
    </AppShell>
  );
}

function VoiceNoteRecorder({ onSave }: { onSave: (blob: Blob, seconds: number) => Promise<void> }) {
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [failed, setFailed] = useState<{ blob: Blob; seconds: number; reason: string } | null>(null);

  async function trySave(blob: Blob, secs: number) {
    setState("saving");
    try {
      await onSave(blob, secs);
      setFailed(null);
    } catch (e) {
      const reason = e instanceof Error ? e.message : "সেভ হয়নি";
      setFailed({ blob, seconds: secs, reason });
      toast.error(reason);
    } finally {
      setState("idle");
      setSeconds(0);
    }
  }
  const [seconds, setSeconds] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setSeconds(Math.round((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [state]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickMime();
      const r = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || mime || "audio/webm" });
        const secs = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        await trySave(blob, secs);
      };
      started.current = Date.now();
      r.start(1000);
      rec.current = r;
      setState("recording");
    } catch {
      toast.error("মাইক্রোফোন অনুমতি দিন");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-5">
        {state === "recording" ? (
          <Button size="lg" variant="destructive" className="h-16 w-full max-w-xs text-base" onClick={() => rec.current?.stop()}>
            <Square className="mr-2 size-5" /> থামান ও সেভ করুন · {fmtDur(seconds)}
          </Button>
        ) : (
          <Button size="lg" className="h-16 w-full max-w-xs text-base" disabled={state === "saving"} onClick={start}>
            <Mic className="mr-2 size-5" /> {state === "saving" ? "লেখা ও সারাংশ তৈরি হচ্ছে…" : "ভয়েস রেকর্ড শুরু করুন"}
          </Button>
        )}
        {state === "saving" && <StatusLine tone="info" text="অডিও সেভ হচ্ছে → লেখা তৈরি → সারাংশ তৈরি…" />}
        {failed && state === "idle" && (
          <div className="w-full max-w-xs space-y-2">
            <StatusLine tone="error" text={`অডিও সেভ হয়নি: ${failed.reason}`} />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => trySave(failed.blob, failed.seconds)}>
                <RotateCw className="mr-1 size-4" /> আবার চেষ্টা করুন
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFailed(null)}>বাদ দিন</Button>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">মিটিং, সাইট ভিজিট বা কলের পরের নোট — Android ও iPhone দুটোতেই চলে</p>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ item, readOnly }: { item: Item; readOnly: boolean }) {
  const qc = useQueryClient();
  const build = useServerFn(buildCallInsight);
  const play = useServerFn(getRecorderPlayback);
  const [open, setOpen] = useState(false);
  const [audio, setAudio] = useState<string | null>(null);
  const insight = useMutation({
    mutationFn: () => build({ data: { recordingId: item.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recorder-history"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const retryFn = useServerFn(retryVoiceNoteFn);
  const retry = useMutation({
    mutationFn: () => retryFn({ data: { id: item.id } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("লেখা ও সারাংশ তৈরি হয়েছে");
      else toast.error(r.error ?? "আবার ব্যর্থ হয়েছে");
      return qc.invalidateQueries({ queryKey: ["recorder-history"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const stage = "stage" in item ? item.stage : null;
  const Icon = item.kind === "voice" ? Mic : item.direction === "incoming_callback" ? PhoneIncoming : Phone;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <button type="button" className="flex w-full min-w-0 items-start gap-3 text-left" onClick={() => setOpen((v) => !v)}>
          <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" })} · {fmtDur(item.durationSeconds)}
            </p>
          </div>
          <Badge variant="outline">{item.kind === "voice" ? "ভয়েস" : "কল"}</Badge>
        </button>

        {stage === "ready" && <StatusLine tone="ok" text="অডিও সেভ ✓ · লেখা ✓ · সারাংশ ✓" />}
        {stage === "transcript_failed" && <StatusLine tone="error" text="অডিও সেভ ✓ · লেখা তৈরি হয়নি" />}
        {stage === "summary_failed" && <StatusLine tone="error" text="অডিও সেভ ✓ · লেখা ✓ · সারাংশ তৈরি হয়নি" />}
        {stage && stage !== "ready" && !readOnly && (
          <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCw className="mr-1 size-4" /> {retry.isPending ? "আবার চেষ্টা হচ্ছে…" : stage === "transcript_failed" ? "লেখা ও সারাংশ আবার চেষ্টা করুন" : "সারাংশ আবার চেষ্টা করুন"}
          </Button>
        )}
        {item.summary && <p className="text-sm">{item.summary}</p>}

        {open && (
          <div className="space-y-3 text-sm">
            {item.takeaways.length > 0 && (
              <div>
                <p className="font-medium">মূল বিষয়</p>
                <ul className="list-disc pl-5">{item.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {item.actionItems.length > 0 && (
              <div>
                <p className="font-medium">করণীয়</p>
                <ul className="list-disc pl-5">{item.actionItems.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            <div>
              <p className="font-medium">লেখা (ট্রান্সক্রিপ্ট)</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{item.transcript || "এখনও লেখা তৈরি হয়নি।"}</p>
            </div>
            {"error" in item && item.error && <p className="text-destructive">{item.error}</p>}
            <div className="flex flex-wrap gap-2">
              {item.hasAudio && (
                <Button size="sm" variant="outline" onClick={async () => {
                  try { setAudio((await play({ data: { id: item.id, kind: item.kind } })).url); }
                  catch (e) { toast.error((e as Error).message); }
                }}>
                  <Play className="mr-1 size-4" /> শুনুন
                </Button>
              )}
              {item.kind === "call" && !readOnly && item.transcript && (
                <Button size="sm" variant="outline" disabled={insight.isPending} onClick={() => insight.mutate()}>
                  <Sparkles className="mr-1 size-4" /> {insight.isPending ? "তৈরি হচ্ছে…" : item.insightReady ? "আবার সারাংশ করুন" : "মূল বিষয় ও করণীয় তৈরি করুন"}
                </Button>
              )}
            </div>
            {audio && <audio controls autoPlay src={audio} className="w-full" />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusLine({ tone, text }: { tone: "ok" | "error" | "info"; text: string }) {
  const cls = tone === "error" ? "text-destructive" : tone === "ok" ? "text-primary" : "text-muted-foreground";
  return <p className={`text-xs font-medium ${cls}`} role={tone === "error" ? "alert" : "status"}>{text}</p>;
}
