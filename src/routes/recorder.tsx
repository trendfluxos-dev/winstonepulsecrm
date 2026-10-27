import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic, Phone, PhoneIncoming, Play, RotateCw, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Badge } from "@/components/ui/badge";
import { Bi } from "@/components/crm/Bi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLang, useT } from "@/lib/i18n";
import { classifyMicError, type MicProblem } from "@/lib/recorder-shared";
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
  const t = useT();
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
            <h1 className="truncate text-xl font-semibold sm:text-2xl">
              <Bi en="Recorder" bn="রেকর্ডার" />
            </h1>
            <p className="text-xs text-muted-foreground">
              {t({ bn: "কল ও ভয়েস নোট — লেখা, AI সারাংশ, মূল বিষয় ও করণীয়", en: "Calls and voice notes — transcript, AI summary, takeaways and action items" })}
            </p>
          </div>
        </header>

        {!history.data?.readOnly && (
          <VoiceNoteRecorder
            onSave={async (blob, seconds) => {
              const audioBase64 = await toBase64(blob);
              const res = await save({ data: { audioBase64, mimeType: blob.type || "audio/webm", durationSeconds: seconds } });
              if (res.ok) toast.success(t({ bn: "ভয়েস নোট সেভ ও সারাংশ তৈরি হয়েছে", en: "Voice note saved and summarised" }));
              else toast.error(res.error ?? t({ bn: "সারাংশ তৈরি হয়নি", en: "Summary could not be created" }));
              await qc.invalidateQueries({ queryKey: ["recorder-history"] });
            }}
          />
        )}

        <Card>
          <CardContent className="space-y-1 p-4 text-sm">
            <p className="font-medium">{t({ bn: "অটো কল রেকর্ডিং", en: "Automatic call recording" })}</p>
            <p className="text-muted-foreground">
              {t({
                bn: "Android: Winstone অ্যাপ প্রতিটি কল নিজে রেকর্ড করে বা ফোনের নিজস্ব কল রেকর্ডারের ফাইল তুলে নেয়, তারপর এখানে দেখায়। iPhone: Apple কোনো অ্যাপকে ফোন কল রেকর্ড করতে দেয় না — কলের পরে উপরের বোতামে ভয়েস নোট রাখুন।",
                en: "Android: the Winstone app records each call itself, or picks up your phone's own call-recorder file, and shows it here. iPhone: Apple does not let apps record phone calls — tap the button above to keep a voice note after the call.",
              })}
            </p>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          {(["all", "call", "voice"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? t({ bn: "সব", en: "All" }) : f === "call" ? t({ bn: "কল", en: "Calls" }) : t({ bn: "ভয়েস নোট", en: "Voice notes" })}
            </Button>
          ))}
        </div>

        {history.isLoading && <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p>}
        {history.error && <p className="text-sm text-destructive">{(history.error as Error).message}</p>}
        {!history.isLoading && !history.error && items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t({ bn: "এখনও কোনো রেকর্ডিং নেই।", en: "No recordings yet." })}</p>
        )}
        <div className="space-y-3">
          {items.map((item) => <HistoryCard key={`${item.kind}-${item.id}`} item={item} readOnly={Boolean(history.data?.readOnly)} />)}
        </div>
      </div>
    </AppShell>
  );
}

function VoiceNoteRecorder({ onSave }: { onSave: (blob: Blob, seconds: number) => Promise<void> }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [failed, setFailed] = useState<{ blob: Blob; seconds: number; reason: string } | null>(null);

  async function trySave(blob: Blob, secs: number) {
    setState("saving");
    try {
      await onSave(blob, secs);
      setFailed(null);
    } catch (e) {
      const reason = e instanceof Error ? e.message : t({ bn: "সেভ হয়নি", en: "Could not save" });
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

  const [micProblem, setMicProblem] = useState<MicProblem | null>(null);
  const [permState, setPermState] = useState<"granted" | "prompt" | "denied" | null>(null);

  useEffect(() => {
    if (!window.isSecureContext) return setMicProblem("insecure");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setMicProblem("unsupported");
    let status: PermissionStatus | null = null;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((s) => {
        status = s;
        setPermState(s.state as "granted" | "prompt" | "denied");
        if (s.state === "denied") setMicProblem("denied");
        s.onchange = () => {
          setPermState(s.state as "granted" | "prompt" | "denied");
          if (s.state !== "denied") setMicProblem((p) => (p === "denied" ? null : p));
        };
      })
      .catch(() => undefined); // Safari/iPhone may not support this query; the prompt still appears on tap.
    return () => { if (status) status.onchange = null; };
  }, []);

  async function start() {
    setMicProblem(null);
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
    } catch (e) {
      const problem = classifyMicError(e);
      setMicProblem(problem);
      if (problem === "denied") setPermState("denied");
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 p-5">
        {state === "recording" ? (
          <Button size="lg" variant="destructive" className="h-16 w-full max-w-xs text-base" onClick={() => rec.current?.stop()}>
            <Square className="mr-2 size-5" /> {t({ bn: "থামান ও সেভ করুন", en: "Stop and save" })} · {fmtDur(seconds)}
          </Button>
        ) : (
          <Button size="lg" className="h-16 w-full max-w-xs text-base" disabled={state === "saving" || micProblem === "insecure" || micProblem === "unsupported"} onClick={start}>
            <Mic className="mr-2 size-5" /> {state === "saving" ? t({ bn: "লোড হচ্ছে…", en: "Working…" }) : t({ bn: "ভয়েস নোট শুরু করুন", en: "Start a voice note" })}
          </Button>
        )}
        {state === "idle" && !micProblem && permState !== "granted" && (
          <p className="text-center text-xs text-muted-foreground">
            {t({ bn: "রেকর্ড শুরু করলে ব্রাউজার মাইক্রোফোনের অনুমতি চাইবে — \"Allow\" / \"অনুমতি দিন\" চাপুন।", en: "Starting a recording asks the browser for microphone access — tap \"Allow\"." })}
          </p>
        )}
        {micProblem && state === "idle" && <MicHelp problem={micProblem} onRetry={start} />}
        {state === "saving" && <StatusLine tone="info" text={t({ bn: "অডিও সেভ → লেখা → সারাংশ…", en: "Saving audio → transcript → summary…" })} />}
        {failed && state === "idle" && (
          <div className="w-full max-w-xs space-y-2">
            <StatusLine tone="error" text={`${t({ bn: "অডিও সেভ হয়নি", en: "Audio not saved" })}: ${failed.reason}`} />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => trySave(failed.blob, failed.seconds)}>
                <RotateCw className="mr-1 size-4" /> {t({ bn: "আবার চেষ্টা করুন", en: "Try again" })}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setFailed(null)}>{t({ bn: "বাদ দিন", en: "Discard" })}</Button>
            </div>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          {t({ bn: "মিটিং, সাইট ভিজিট বা কলের পরের নোট — Android ও iPhone দুটোতেই চলে", en: "Notes after meetings, site visits or calls — works on Android and iPhone" })}
        </p>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ item, readOnly }: { item: Item; readOnly: boolean }) {
  const t = useT();
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
      if (r.ok) toast.success(t({ bn: "লোড ও সারাংশ তৈরি হয়েছে", en: "Transcript and summary created" }));
      else toast.error(r.error ?? t({ bn: "আবার ব্যর্থ হয়েছে", en: "Failed again" }));
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
          <Badge variant="outline">{item.kind === "voice" ? t({ bn: "ভয়েস", en: "Voice" }) : t({ bn: "কল", en: "Call" })}</Badge>
        </button>

        {stage === "ready" && <StatusLine tone="ok" text={t({ bn: "অডিও সেভ ✓ · লেখা ✓ · সারাংশ ✓", en: "Audio saved ✓ · transcript ✓ · summary ✓" })} />}
        {stage === "transcript_failed" && <StatusLine tone="error" text={t({ bn: "অডিও সেভ ✓ · লেখা তৈরি হয়নি", en: "Audio saved ✓ · transcript failed" })} />}
        {stage === "summary_failed" && <StatusLine tone="error" text={t({ bn: "অডিও সেভ ✓ · লেখা ✓ · সারাংশ তৈরি হয়নি", en: "Audio saved ✓ · transcript ✓ · summary failed" })} />}
        {stage && stage !== "ready" && !readOnly && (
          <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCw className="mr-1 size-4" /> {retry.isPending
              ? t({ bn: "আবার চেষ্টা হচ্ছে…", en: "Retrying…" })
              : stage === "transcript_failed"
                ? t({ bn: "লেখা ও সারাংশ আবার চেষ্টা করুন", en: "Retry transcript and summary" })
                : t({ bn: "সারাংশ আবার চেষ্টা করুন", en: "Retry summary" })}
          </Button>
        )}
        {item.summary && <p className="text-sm">{item.summary}</p>}

        {open && (
          <div className="space-y-3 text-sm">
            {item.takeaways.length > 0 && (
              <div>
                <p className="font-medium">{t({ bn: "মূল বিষয়", en: "Key takeaways" })}</p>
                <ul className="list-disc pl-5">{item.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            {item.actionItems.length > 0 && (
              <div>
                <p className="font-medium">{t({ bn: "করণীয়", en: "Action items" })}</p>
                <ul className="list-disc pl-5">{item.actionItems.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
            <div>
              <p className="font-medium">{t({ bn: "লোখা (ট্রান্সক্রিপ্ট)", en: "Transcript" })}</p>
              <p className="whitespace-pre-wrap text-muted-foreground">{item.transcript || t({ bn: "এখনও লোখা তৈরি হয়নি।", en: "No transcript yet." })}</p>
            </div>
            {"error" in item && item.error && <p className="text-destructive">{item.error}</p>}
            <div className="flex flex-wrap gap-2">
              {item.hasAudio && (
                <Button size="sm" variant="outline" onClick={async () => {
                  try { setAudio((await play({ data: { id: item.id, kind: item.kind } })).url); }
                  catch (e) { toast.error((e as Error).message); }
                }}>
                  <Play className="mr-1 size-4" /> {t({ bn: "শুনুন", en: "Listen" })}
                </Button>
              )}
              {item.kind === "call" && !readOnly && item.transcript && (
                <Button size="sm" variant="outline" disabled={insight.isPending} onClick={() => insight.mutate()}>
                  <Sparkles className="mr-1 size-4" /> {insight.isPending
                    ? t({ bn: "তৈরি হচ্ছে…", en: "Creating…" })
                    : item.insightReady
                      ? t({ bn: "আবার সারাংশ করুন", en: "Summarise again" })
                      : t({ bn: "মূল বিষয় ও করণীয় তৈরি করুন", en: "Create takeaways and actions" })}
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

const MIC_HELP: Record<MicProblem, { title: { bn: string; en: string }; steps: { bn: string[]; en: string[] }; retry: boolean }> = {
  denied: {
    title: { bn: "মাইক্রোফোনের অনুমতি বন্ধ আছে", en: "Microphone access is blocked" },
    steps: {
      bn: [
        "Android Chrome: ঠিকানার পাশের 🔒 চিহ্নে চাপুন → Permissions → Microphone → Allow।",
        "iPhone Safari: Settings → Safari → Microphone → Allow, অথবা ঠিকানার পাশের \"aA\" → Website Settings → Microphone → Allow।",
        "কম্পিউটার: ঠিকানার পাশের 🔒 চিহ্ন → Microphone → Allow।",
        "তারপর পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।",
      ],
      en: [
        "Android Chrome: tap the 🔒 next to the address → Permissions → Microphone → Allow.",
        "iPhone Safari: Settings → Safari → Microphone → Allow, or tap \"aA\" in the address bar → Website Settings → Microphone → Allow.",
        "Computer: tap the 🔒 next to the address → Microphone → Allow.",
        "Then refresh the page and try again.",
      ],
    },
    retry: true,
  },
  no_device: {
    title: { bn: "কোনো মাইক্রোফোন পাওয়া যায়নি", en: "No microphone found" },
    steps: {
      bn: ["হেডফোন/মাইক ঠিকমতো লাগানো আছো কী না দেখুন।", "অন্য ফোন বা ব্রাউজারে চেষ্টা করুন।"],
      en: ["Check that your headset or microphone is plugged in properly.", "Try another phone or browser."],
    },
    retry: true,
  },
  busy: {
    title: { bn: "মাইক্রোফোন অনয় কোথাও ব্যবহোর হচ্ছো", en: "The microphone is in use elsewhere" },
    steps: {
      bn: ["চলমান ফোন কল, WhatsApp/ভিডিও কল বা অন্য রেকর্ডিং অ্যাপ বন্ধ করুন।", "তারপর আবার চেষ্টা করুন।"],
      en: ["Close any live phone call, WhatsApp/video call or other recording app.", "Then try again."],
    },
    retry: true,
  },
  insecure: {
    title: { bn: "এই ঠিকানায় রেকর্ডিং চলবো না", en: "Recording cannot run from this address" },
    steps: {
      bn: ["CRM-টি https:// ঠিকানা থেকে খুলুন (crm.winstonebd.com)।"],
      en: ["Open the CRM from an https:// address (crm.winstonebd.com)."],
    },
    retry: false,
  },
  unsupported: {
    title: { bn: "এই ব্রাউজারে রেকর্ডিং সমর্থিত নয়", en: "This browser does not support recording" },
    steps: {
      bn: ["Android-এ Chrome, iPhone-এ Safari (iOS 14.3 বা নতুন) ব্যবহার করুন।", "অথবা Winstone অ্যাপের রেকর্ডার ব্যবহার করুন।"],
      en: ["Use Chrome on Android, or Safari on iPhone (iOS 14.3 or newer).", "Or use the recorder inside the Winstone app."],
    },
    retry: false,
  },
  unknown: {
    title: { bn: "রেকর্ডিং শুরু করা যায়নি", en: "Recording could not be started" },
    steps: {
      bn: ["পাতাটি রিফ্রেশ করে আবার চেষ্টা করুন।", "সমস্যা থাকলে ফোন রিস্টার্ট করুন বা IT-কে জানান।"],
      en: ["Refresh the page and try again.", "If it keeps happening, restart the phone or tell IT."],
    },
    retry: true,
  },
};

function MicHelp({ problem, onRetry }: { problem: MicProblem; onRetry: () => void }) {
  const lang = useLang();
  const help = MIC_HELP[problem];
  return (
    <div role="alert" className="w-full max-w-md space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">{help.title[lang]}</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        {help.steps[lang].map((s) => <li key={s}>{s}</li>)}
      </ol>
      {help.retry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="mr-1 size-4" /> {lang === "bn" ? "আবার চেষ্টা করুন" : "Try again"}
        </Button>
      )}
    </div>
  );
}
