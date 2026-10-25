import { useState } from "react";
import { zipSync } from "fflate";
import { Download, FileArchive, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/lib/i18n";
import { deliverFile } from "@/lib/download";
import { allBrochures, pickBrochures } from "@/lib/project-brochures";

/**
 * Project brochures as one ZIP — all 15, or only the projects the user ticks.
 *
 * The PDFs are fetched and zipped before the click that saves the file — a
 * download started after a long await is dropped by mobile browsers.
 */
export function BrochureZipPanel() {
  const t = useT();
  const all = allBrochures();
  const [picked, setPicked] = useState<string[]>(() => all.map((b) => b.entry));
  const [phase, setPhase] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const [zip, setZip] = useState<{ blob: Blob; filename: string; count: number } | null>(null);
  const list = pickBrochures(picked);

  function change(next: string[]) {
    setPicked(next);
    setZip(null);
    setPhase("idle");
  }

  async function build() {
    if (!list.length) return;
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
      toast.error(t({ bn: `${bad.length}টি ব্রোশিওর আনা যায়নি`, en: `${bad.length} brochures could not be fetched` }));
      return;
    }
    // PDFs are already compressed, so the ZIP is stored rather than re-deflated.
    const out = zipSync(files, { level: 0 });
    const scope = list.length === all.length ? "all" : `${list.length}`;
    setZip({
      blob: new Blob([out as BlobPart], { type: "application/zip" }),
      filename: `winstone-project-brochures-${scope}-${new Date().toISOString().slice(0, 10)}.zip`,
      count: list.length,
    });
    setPhase("ready");
  }

  const label = (entry: string) => entry.replace(/^\d{2}-/, "").replace(/-Brochure\.pdf$/, "").replace(/-/g, " ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="ghost" disabled={phase === "building"}>
            {t({ bn: `প্রজেক্ট বাছুন (${picked.length}/${all.length})`, en: `Choose projects (${picked.length}/${all.length})` })}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <button type="button" className="text-primary hover:underline" onClick={() => change(all.map((b) => b.entry))}>
              {t({ bn: "সব বাছুন", en: "Select all" })}
            </button>
            <button type="button" className="text-muted-foreground hover:underline" onClick={() => change([])}>
              {t({ bn: "সব বাদ দিন", en: "Clear" })}
            </button>
          </div>
          <ul className="max-h-72 space-y-1 overflow-auto">
            {all.map((b) => (
              <li key={b.entry}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={picked.includes(b.entry)}
                    onChange={(e) => change(e.target.checked ? [...picked, b.entry] : picked.filter((x) => x !== b.entry))}
                  />
                  {label(b.entry)}
                </label>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {phase === "ready" && zip ? (
        <Button size="sm" onClick={() => void deliverFile(zip.blob, zip.filename)}>
          <Download className="size-4" />
          {t({ bn: "ZIP ডাউনলোড করুন", en: "Download ZIP" })}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => void build()} disabled={phase === "building" || !list.length}>
          {phase === "building" ? <Loader2 className="size-4 animate-spin" /> : <FileArchive className="size-4" />}
          {phase === "building"
            ? t({ bn: `তৈরি হচ্ছে… ${done}/${list.length}`, en: `Building… ${done}/${list.length}` })
            : list.length === all.length
              ? t({ bn: `সব ব্রোশিওর (ZIP, ${list.length}টি)`, en: `All brochures (ZIP, ${list.length})` })
              : t({ bn: `বাছাই করা ব্রোশিওর (ZIP, ${list.length}টি)`, en: `Selected brochures (ZIP, ${list.length})` })}
        </Button>
      )}
      {phase === "error" ? (
        <p className="flex items-center gap-1 text-xs text-destructive" role="alert">
          <TriangleAlert className="size-3.5" />
          {t({ bn: `${failed.length}টি ব্রোশিওর আনা যায়নি — আবার চেষ্টা করুন।`, en: `${failed.length} brochures could not be fetched — try again.` })}
        </p>
      ) : null}
      {phase === "ready" && zip ? (
        <span className="text-xs text-muted-foreground">
          {t({ bn: `${zip.count}টি পিডিএফ · ${Math.max(1, Math.round(zip.blob.size / 1024 / 1024))} MB`, en: `${zip.count} PDFs · ${Math.max(1, Math.round(zip.blob.size / 1024 / 1024))} MB` })}
        </span>
      ) : null}
    </div>
  );
}
