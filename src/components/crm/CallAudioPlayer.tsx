import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileAudio, Loader2, Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getAudioUrl } from "@/lib/crm.functions";
import { formatDuration } from "@/lib/crm-format";
import { PLAYBACK_LIMIT_MB, recordingSizeMb } from "@/lib/recording-playback-limit";
import { useAdminToken } from "@/lib/local-session";
import { cn } from "@/lib/utils";

const SPEEDS = [1, 1.25, 1.5, 2] as const;
const BAR_COUNT = 72;
const FLAT_BARS = Array.from({ length: BAR_COUNT }, () => 0.14);

/** Real loudness peaks read from the downloaded recording itself. */
async function realWaveform(url: string): Promise<number[]> {
  const response = await fetch(url);
  const bytes = await response.arrayBuffer();
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error("no audio context");
  const ctx = new AudioCtx();
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    const channel = buffer.getChannelData(0);
    const block = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i += 1) {
      let sum = 0;
      const start = i * block;
      for (let j = 0; j < block; j += 1) sum += Math.abs(channel[start + j] ?? 0);
      peaks.push(sum / block);
    }
    const loudest = Math.max(...peaks, 0.0001);
    return peaks.map((peak) => Math.min(1, Math.max(0.08, peak / loudest)));
  } finally {
    void ctx.close();
  }
}

export function CallAudioPlayer({
  recordingId,
  fallbackDuration,
  seekRequest,
  onTimeUpdate,
}: {
  recordingId: string;
  fallbackDuration: number;
  seekRequest?: { at: number; nonce: number } | null;
  onTimeUpdate?: (seconds: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration);
  const [speed, setSpeed] = useState<number>(1);
  const [bars, setBars] = useState<number[]>(FLAT_BARS);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const adminToken = useAdminToken();

  const resolveAudio = useServerFn(getAudioUrl);
  const {
    mutate: loadUrl,
    data: payload,
    isPending,
    isError,
    error: loadError,
  } = useMutation({
    mutationFn: () => resolveAudio({ data: { adminToken, recordingId } }),
  });
  const [source, setSource] = useState<{ url: string } | null>(null);
  const tooLargeMb =
    payload?.status === "too_large" ? recordingSizeMb(payload.sizeBytes) : null;

  useEffect(() => {
    setBars(FLAT_BARS);
    loadUrl();
  }, [loadUrl, recordingId, adminToken]);

  // Audio arrives as bytes from the server; keep it in a page-local blob URL.
  useEffect(() => {
    if (!payload || payload.status !== "ok") return;
    const raw = atob(payload.base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: payload.mimeType }));
    setSource({ url });
    return () => {
      setSource(null);
      URL.revokeObjectURL(url);
    };
  }, [payload]);

  // Draw the scrubber from the actual audio, not a decorative pattern.
  useEffect(() => {
    const url = source?.url;
    if (!url) return;
    let live = true;
    realWaveform(url)
      .then((peaks) => {
        if (live) setBars(peaks);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [source?.url]);

  useEffect(() => {
    if (!seekRequest || !audioRef.current) return;
    audioRef.current.currentTime = seekRequest.at;
    void audioRef.current.play().catch(() => undefined);
  }, [seekRequest]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, source]);

  const skip = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.min(Math.max(0, el.currentTime + delta), duration || el.duration || 0);
  };

  const scrub = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    el.currentTime = ratio * (duration || el.duration || 0);
  };

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className="rounded-2xl bg-ink p-3 text-ink-foreground shadow-inner">
      {source?.url && (
        <audio
          ref={audioRef}
          src={source.url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
            e.currentTarget.playbackRate = speed;
          }}
          onTimeUpdate={(e) => {
            setCurrent(e.currentTarget.currentTime);
            onTimeUpdate?.(e.currentTarget.currentTime);
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}

      <div className="flex items-center gap-3">
        <Button
          size="icon"
          className="size-10 shrink-0 rounded-full"
          disabled={!source?.url}
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (el.paused) void el.play().catch(() => undefined);
            else el.pause();
          }}
          aria-label={playing ? "Pause recording" : "Play recording"}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : playing ? (
            <Pause className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
        </Button>

        <div
          className="flex h-12 flex-1 cursor-pointer items-end gap-[2px]"
          onClick={scrub}
          role="presentation"
        >
          {bars.map((height, index) => {
            const played = index / bars.length <= progress;
            return (
              <span
                key={index}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  played ? "bg-live" : "bg-ink-muted/40",
                )}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            );
          })}
        </div>

        <span className="tabular w-24 shrink-0 text-right text-xs text-ink-muted">
          {formatDuration(current)} / {formatDuration(duration)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="rounded-full bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20"
          onClick={() => skip(-5)}
          disabled={!source?.url}
        >
          <RotateCcw className="size-3.5" /> 5s
        </Button>
        <Button
          size="sm"
          className="rounded-full bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20"
          onClick={() => skip(5)}
          disabled={!source?.url}
        >
          <RotateCw className="size-3.5" /> 5s
        </Button>
        <Button
          size="sm"
          className="rounded-full bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20"
          disabled={!source?.url || downloading}
          onClick={async () => {
            const url = source?.url;
            if (!url) return;
            setDownloading(true);
            try {
              const res = await fetch(url);
              if (!res.ok) throw new Error("download failed");
              const blob = await res.blob();
              const href = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = href;
              link.download = `call-${recordingId}.mp3`;
              link.click();
              URL.revokeObjectURL(href);
            } catch {
              setDownloadError(true);
            } finally {
              setDownloading(false);
            }
          }}
        >
          {downloading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}{" "}
          ডাউনলোড
        </Button>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-ink-foreground/10 p-1">
          {SPEEDS.map((option) => (
            <button
              key={option}
              onClick={() => setSpeed(option)}
              className={cn(
                "tabular rounded-full px-2 py-1 text-xs transition-colors",
                speed === option
                  ? "bg-live text-live-foreground"
                  : "text-ink-muted hover:text-ink-foreground",
              )}
            >
              {option}x
            </button>
          ))}
        </div>
      </div>

      {tooLargeMb !== null && (
        <div
          role="status"
          className="mt-3 rounded-xl bg-ink-foreground/10 p-3 text-xs leading-relaxed"
        >
          <p className="flex items-center gap-2 font-semibold text-ink-foreground">
            <FileAudio className="size-4 shrink-0 text-live" aria-hidden />
            রেকর্ডিংটি এখানে চালানো যাচ্ছে না — ফাইলটি {tooLargeMb} MB, এখানে সর্বোচ্চ{" "}
            {PLAYBACK_LIMIT_MB} MB চলে।
          </p>
          <p className="mt-1 text-ink-muted">
            This recording is {tooLargeMb} MB; the in-app player plays up to {PLAYBACK_LIMIT_MB}{" "}
            MB. The recording is saved safely — nothing is lost.
          </p>
          <p className="mt-2 font-medium text-ink-foreground">এখন যা করতে পারেন:</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-ink-muted">
            <li>
              এই লিডের কল রিপোর্ট ও নোট নিচেই আছে — কল-পরবর্তী কাজ সেগুলো দেখে চালিয়ে যান।
            </li>
            <li>
              পুরো অডিও শুনতে হলে IT টিমকে এই লিডের নাম ও কলের সময় জানান; তারা রেকর্ডিং
              ব্যাকআপ থেকে ফাইলটি দিতে পারবেন।
            </li>
          </ul>
        </div>
      )}

      {isError && /not assigned to you|belongs to another agent/i.test(String(loadError?.message)) && (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          এই লিডটি এখন আপনার নামে নেই, তাই রেকর্ডিংটি শোনা বা ডাউনলোড করা যাবে না। This lead is no
          longer assigned to you, so its recording is not available.
        </p>
      )}

      {isError && !/not assigned to you|belongs to another agent/i.test(String(loadError?.message)) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <p className="text-destructive">
            রেকর্ডিংটি লোড করা যায়নি। This recording could not be loaded for playback.
          </p>
          <Button
            size="sm"
            className="h-7 rounded-full bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/20"
            onClick={() => loadUrl()}
          >
            আবার চেষ্টা করুন
          </Button>
        </div>
      )}

      {downloadError && (
        <p className="mt-2 text-xs text-destructive">
          রেকর্ডিং ডাউনলোড করা যায়নি — আবার চেষ্টা করুন।
        </p>
      )}
    </div>
  );
}
