import { useState } from "react";
import { zipSync } from "fflate";
import { Download, FileArchive, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { deliverFile } from "@/lib/download";
import { allBrochures } from "@/lib/project-brochures";

/**
 * All 15 project brochures as one ZIP.
 *
 * The PDFs live on the asset host, so they are fetched and zipped before the
 * click that saves the file — a download started after a long await is dropped
 * by mobile browsers.
 */
export function BrochureZipPanel() {
  const t = useT();
  const [phase, setPhase] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [zip, setZip] = useState<{ blob: Blob; filename: string } | null>(null);
  const list = allBrochures();

  async function build() {
    setPhase("building");
    setDone(0);
    setFailed([]);
    setZip(null);
    const files: Record<string, Uint8Array> = {};
    const bad: string[] = [];
    await Promise.all(
      list.map(async (b) => {
        try {
          const r = await fetch(b.url);
          if (!r.ok) throw new Error(String(r.status));
          files[b.entry] = new Uint8Array(await r.arrayBuffer());
        } catch {
          bad.push(b.entry);
        } finally {
          setDone((d) => d + 1);
        }
      }),
    );
    if (bad.length) {
      setFailed(bad);
      setPhase("error");
      toast.error(t({ bn: `${bad.length}টি ব্রোশিওর নিনত করা য়ায় নি`, en: `${bad.length} brochures could not be fetched` }));
      return;
    }
    // PDFs are already compressed, so the ZIP is stored rather than re-deflated.
    const out = zipSync(files, { level: 0 });
    setZip({
      blob: new Blob([out as BlobPart], { type: "application/zip" }),
      filename: `winstone-project-brochures-${new Date().toISOString().slice(0, 10)}.zip`,
    });
    setPhase("ready");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {phase === "ready" && zip ? (
        <Button size="sm" onClick={() => void deliverFile(zip.blob, zip.filename)}>
          <Download className="size-4" />
          {t({ bn: "ZIP ডাউনলোড করুন", en: "Download ZIP" })}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => void build()} disabled={phase === "building"}>
          {phase === "building" ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
          {phase === "building"
            ? t({ bn: `তৈরি হচ্ছ… ${done}/${list.length}`, en: `Building… ${done}/${list.length}` })
            : t({ bn: `সব ব্রোশিওর (ZIP, ${list.length}টি)`, en: `All brochures (ZIP, ${list.length})` })}
        </Button>
      )}
      {phase === "error" ? (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <TriangleAlert className="size-3.5" />
          {t({
            bn: `${failed.length}টি ব্রোশিওর নিনত করা য়ায় নি — আবার চেষ্টা করুন।`,
            en: `${failed.length} brochures could not be fetched — try again.`,
          })}
        </p>
      ) : null}
      {phase === "ready" && zip ? (
        <span className="text-xs text-muted-foreground">
          {t({ bn: `${list.length}টি পিডিএফ · ${Math.round(zip.blob.size / 1024 / 1024)} MB`, en: `${list.length} PDFs · ${Math.round(zip.blob.size / 1024 / 1024)} MB` })}
        </span>
      ) : null}
    </div>
  );
}
