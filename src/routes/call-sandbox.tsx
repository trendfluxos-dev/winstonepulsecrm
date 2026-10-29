import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, FlaskConical, Upload, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sandboxResultSchema, simulateSandbox, type SandboxResult } from "@/lib/call-sandbox";

export const Route = createFileRoute("/call-sandbox")({
  head: () => ({ meta: [
    { title: "Offline call sandbox — Winstone Pulse" },
    { name: "description", content: "Local synthetic call-test results, recording evidence and simulated summary states without live CRM writes." },
    { property: "og:title", content: "Offline call sandbox — Winstone Pulse" },
    { property: "og:description", content: "Browser-local Android sandbox results and synthetic summary simulation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: CallSandbox,
});
function CallSandbox() {
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-4 py-8 text-foreground">
    <Button asChild variant="ghost"><Link to="/"><ArrowLeft className="size-4" />Winstone Pulse</Link></Button>
    <header className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-semibold"><FlaskConical className="size-6 text-gold" />Call sandbox</h1>
      <p className="text-sm text-muted-foreground">Synthetic tests · Local only · No live CRM writes</p></header>
    <section className="space-y-4 border-y border-border py-5">
      <h2 className="font-semibold">Android test results</h2>
      <p className="text-sm text-muted-foreground">Import the offline sandbox APK’s exported JSON. Audio and contact numbers stay on the phone. Imported results are user-supplied evidence, not independently verified.</p>
      <label className="flex flex-col items-start gap-2 text-sm font-medium"><span className="flex items-center gap-2"><Upload className="size-4" />Import sandbox JSON</span>
        <input aria-label="Import sandbox JSON" type="file" accept="application/json,.json" className="min-w-0 max-w-full text-sm" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          setError("");
          try { if (file.size > 32_768) throw new Error(); const parsed = sandboxResultSchema.parse(JSON.parse(await file.text())); setResult(parsed); }
          catch { setError("Invalid sandbox result. Only bounded synthetic sandbox JSON is accepted."); }
          event.target.value = "";
        }} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
    <section className="space-y-3">
      <h2 className="font-semibold">Synthetic lead · Sandbox customer 001</h2>
      <textarea aria-label="Synthetic transcript" className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm" maxLength={240} placeholder="Synthetic transcript for a local summary simulation" value={text} onChange={e => setText(e.target.value)} />
      <Button onClick={() => { setError(""); setResult(simulateSandbox(text, Date.now())); }}><Play className="size-4" />Simulate summary processing</Button>
      <p className="text-sm text-muted-foreground">Simulation copies the supplied text; it does not transcribe audio or run AI. Real summary-service verification requires an isolated processing service, which is not configured.</p>
    </section>
    {result && <section aria-label="Sandbox results" className="space-y-4 border-t border-border pt-5">
      <h2 className="font-semibold">Sandbox results</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{[
        ["Checked", new Date(result.checkedAt).toLocaleString()], ["Call-log access", result.callLogAccess],
        ["Matching call-log rows", String(result.calls.length)], ["Recording", result.recording],
        ["Local audio duration", `${result.audioDurationMs} ms`], ["Summary simulation", result.summary],
      ].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl>
      {result.calls.map((call, i) => <div key={i} className="border-b border-border py-2 text-sm">Synthetic lead · type {call.type} · {call.durationSeconds}s · {new Date(call.at).toLocaleString()}</div>)}
      {result.summaryText && <p className="whitespace-pre-wrap break-words text-sm">{result.summaryText}</p>}
      <p className="text-xs text-muted-foreground">A readable recording is not proof of two-sided audio or call matching. Call-log rows do not verify background recovery. Browser results disappear when this page closes.</p>
    </section>}
  </main>;
}