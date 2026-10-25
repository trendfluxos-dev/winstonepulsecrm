import { useRef, useState } from "react";
import { Download, FileLock2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { redactCredentialText } from "@/lib/credential-redaction";
import { downloadBlob } from "@/lib/download";
import { useT } from "@/lib/i18n";

export function CredentialRedactor() {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const [safe, setSafe] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  function clear() {
    sequence.current += 1;
    setSafe(null); setError(false); setBusy(false);
    if (input.current) input.current.value = "";
  }
  async function select(file?: File) {
    clear();
    if (!file) return;
    if (!/\.txt$/i.test(file.name) || file.size > 1_000_000) { setError(true); return; }
    const current = sequence.current;
    setBusy(true);
    try {
      const result = redactCredentialText(await file.text());
      if (current === sequence.current) setSafe(result);
    } catch { if (current === sequence.current) setError(true); }
    finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="mt-6 border-t border-border pt-4">
    <h2 className="flex items-center gap-2 text-base font-semibold"><FileLock2 className="size-5 text-primary" />{t({ bn: "ফাইলের গোপন তথ্য ঢাকুন", en: "Redact sensitive file details" })}</h2>
    <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "শুধু এই ডিভাইসে প্রক্রিয়াকরণ; কোনো ফাইল পাঠানো বা সংরক্ষণ করা হয় না। স্বয়ংক্রিয় শনাক্তকরণ সব গোপন তথ্য ধরতে নাও পারে; শেয়ারের আগে কপি যাচাই করুন।", en: "Processed only on this device; files are not uploaded or stored. Automatic detection may miss sensitive details; review the copy before sharing." })}</p>
    <input ref={input} type="file" accept=".txt,text/plain" className="hidden" aria-label={t({ bn: "গোপন তথ্য ঢাকার টেক্সট ফাইল", en: "Text file to redact" })} onChange={(event) => { void select(event.target.files?.[0]); }} />
    <div className="mt-3 flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}><FileLock2 className="size-4" />{t({ bn: "TXT ফাইল বাছুন", en: "Choose TXT file" })}</Button>
      <Button disabled={safe === null || busy} onClick={() => { if (safe !== null) downloadBlob(new Blob([safe], { type: "text/plain;charset=utf-8" }), "redacted-meta.txt"); }}><Download className="size-4" />{t({ bn: "ঢাকা কপি নামান", en: "Download redacted copy" })}</Button>
      <Button size="icon" variant="ghost" aria-label={t({ bn: "মুছুন", en: "Clear" })} onClick={clear}><RotateCcw className="size-4" /></Button>
    </div>
    {busy && <p role="status" className="mt-2 text-sm">{t({ bn: "প্রক্রিয়াকরণ হচ্ছে…", en: "Processing…" })}</p>}
    {safe !== null && <p role="status" className="mt-2 text-sm">{t({ bn: "ঢাকা কপি প্রস্তুত।", en: "Redacted copy ready." })}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{t({ bn: "সর্বোচ্চ ১ MB-এর TXT ফাইল বাছুন; পড়া না গেলে আবার চেষ্টা করুন।", en: "Choose a TXT file up to 1 MB; retry if it could not be read." })}</p>}
  </section>;
}