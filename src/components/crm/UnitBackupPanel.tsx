import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useT } from "@/lib/i18n";
import { applyUnitRestore, exportUnitBackup, previewUnitRestore } from "@/lib/unit-inventory.functions";

type Preview = Awaited<ReturnType<typeof previewUnitRestore>>;

function download(text: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function UnitBackupPanel({ adminToken, canRestore }: { adminToken: string | null; canRestore: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const exportFn = useServerFn(exportUnitBackup);
  const previewFn = useServerFn(previewUnitRestore);
  const applyFn = useServerFn(applyUnitRestore);
  const [busy, setBusy] = useState<string | null>(null);
  const [file, setFile] = useState<{ name: string; json: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overwrite, setOverwrite] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<null | "merge" | "full" | "full2">(null);
  const [result, setResult] = useState<string | null>(null);

  const doExport = async () => {
    setBusy("export");
    try { const r = await exportFn({ data: { adminToken } }); download(r.json, r.filename); toast.success(t({ bn: "ব্যাকআপ ডাউনলোড হয়েছে", en: "Backup downloaded" })); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const pick = async (f: File | undefined) => {
    setPreview(null); setResult(null); setOverwrite([]);
    if (!f) return;
    if (f.size > 5_000_000) { toast.error(t({ bn: "ফাইল খুব বড় (সর্বোচ্চ ৫ MB)", en: "File too large (max 5 MB)" })); return; }
    const json = await f.text(); setFile({ name: f.name, json });
    setBusy("preview");
    try { setPreview(await previewFn({ data: { adminToken, json } })); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const run = async (mode: "merge" | "full") => {
    if (!file || !preview?.ok) return;
    setBusy(mode); setConfirm(null);
    try {
      const r = await applyFn({ data: { adminToken, json: file.json, filename: file.name, mode, overwriteIds: mode === "merge" ? overwrite : [], expectedLiveChecksum: preview.liveChecksum, confirmFull: mode === "full" } });
      if (!r.ok) { setResult(`✗ ${r.error}`); toast.error(r.error); return; }
      const msg = t({ bn: `সফল: যোগ ${r.added}, আপডেট ${r.updated}, অপরিবর্তিত ${r.unchanged}, লাইভ রাখা ${r.keptLive}, বাদ ${r.skipped}`, en: `Done: added ${r.added}, updated ${r.updated}, unchanged ${r.unchanged}, live kept ${r.keptLive}, skipped ${r.skipped}` });
      setResult(`✓ ${msg}`); toast.success(msg); setPreview(null); setFile(null);
      void qc.invalidateQueries({ queryKey: ["unit-board"] });
    } catch (e) { setResult(`✗ ${(e as Error).message}`); toast.error((e as Error).message); } finally { setBusy(null); }
  };
  const report = () => preview && download(JSON.stringify({ file: file?.name, ...preview }, null, 2), `unit-backup-validation-${Date.now()}.json`);
  const s = preview?.ok ? preview.summary : null;

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t({ bn: "ব্যাকআপ ও পুনরুদ্ধার (JSON)", en: "Backup & restore (JSON)" })}</h2>
          <p className="text-xs text-muted-foreground">{t({ bn: "কোনো ইউনিট কখনো মোছা হয় না; ডেটা বদলানোর আগে কপি রাখুন।", en: "Units are never deleted; keep a copy before changing data." })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={doExport} disabled={!!busy}>{busy === "export" ? "…" : t({ bn: "JSON ব্যাকআপ এক্সপোর্ট", en: "Export JSON backup" })}</Button>
          {canRestore ? (
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm">
              {t({ bn: "JSON ব্যাকআপ ইমপোর্ট", en: "Import JSON backup" })}
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          ) : null}
        </div>
      </div>
      {busy === "preview" ? <p className="text-xs text-muted-foreground">{t({ bn: "যাচাই হচ্ছে…", en: "Validating…" })}</p> : null}
      {preview && !preview.ok ? (
        <div className="space-y-2 rounded-md border border-destructive/40 p-3 text-xs">
          <p className="font-medium text-destructive">{t({ bn: "ফাইলটি গ্রহণযোগ্য নয় — কিছুই বদলানো হয়নি", en: "File rejected — nothing was changed" })}</p>
          <ul className="list-disc pl-4">{preview.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          <Button size="sm" variant="outline" onClick={report}>{t({ bn: "যাচাই রিপোর্ট ডাউনলোড", en: "Download validation report" })}</Button>
        </div>
      ) : null}
      {preview?.ok && s ? (
        <div className="space-y-2 rounded-md border p-3 text-xs">
          <p className="font-medium">{file?.name} · {preview.recordCount} {t({ bn: "ইউনিট", en: "units" })} · {new Date(preview.exportedAt).toLocaleString()}</p>
          <p>{Object.entries(preview.statusCounts).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
          <p>{t({ bn: `নতুন যোগ হবে ${s.add} · অপরিবর্তিত ${s.unchanged} · বিরোধ ${s.conflicts} · বাদ ${s.skipped} · শুধু লাইভে ${s.liveOnly} (অক্ষত থাকবে)`, en: `Will add ${s.add} · unchanged ${s.unchanged} · conflicts ${s.conflicts} · skipped ${s.skipped} · live-only ${s.liveOnly} (kept)` })}</p>
          {preview.conflicts.length ? (
            <div className="table-scroll max-h-48 overflow-auto">
              <p className="mb-1 text-muted-foreground">{t({ bn: "বিরোধ: ডিফল্টভাবে লাইভ ডেটা থাকবে। ব্যাকআপের মান চাইলে টিক দিন।", en: "Conflicts: live data is kept by default. Tick to use the backup value." })}</p>
              {preview.conflicts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-0.5">
                  <input type="checkbox" checked={overwrite.includes(c.id)} onChange={(e) => setOverwrite((o) => (e.target.checked ? [...o, c.id] : o.filter((x) => x !== c.id)))} />
                  {c.code}: {t({ bn: "লাইভ", en: "live" })} {c.liveStatus} → {t({ bn: "ব্যাকআপ", en: "backup" })} {c.backupStatus}
                </label>
              ))}
            </div>
          ) : null}
          {preview.skipped.length ? <ul className="list-disc pl-4 text-muted-foreground">{preview.skipped.slice(0, 5).map((k) => <li key={k.id}>{k.code}: {k.reason}</li>)}</ul> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => setConfirm("merge")} disabled={!!busy || (s.add === 0 && overwrite.length === 0)}>{t({ bn: "নিরাপদ মার্জ", en: "Safe merge" })}</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirm("full")} disabled={!!busy || (s.add === 0 && s.conflicts === 0)}>{t({ bn: "পূর্ণ পুনরুদ্ধার", en: "Full restore" })}</Button>
            <Button size="sm" variant="ghost" onClick={report}>{t({ bn: "যাচাই রিপোর্ট", en: "Validation report" })}</Button>
          </div>
        </div>
      ) : null}
      {busy === "merge" || busy === "full" ? <p className="text-xs text-muted-foreground">{t({ bn: "পুনরুদ্ধার চলছে…", en: "Restoring…" })}</p> : null}
      {result ? <p className="text-xs">{result}</p> : null}

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "merge" ? t({ bn: "নিরাপদ মার্জ নিশ্চিত করুন", en: "Confirm safe merge" }) : confirm === "full" ? t({ bn: "পূর্ণ পুনরুদ্ধার?", en: "Full restore?" }) : t({ bn: "চূড়ান্ত নিশ্চিতকরণ", en: "Final confirmation" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "merge" && s ? t({ bn: `${s.add}টি নতুন যোগ হবে, ${overwrite.length}টি বিরোধে ব্যাকআপের মান বসবে। অন্য কোনো ইউনিট বদলাবে না বা মুছবে না।`, en: `${s.add} new units added, ${overwrite.length} conflicts take the backup value. No other unit changes or is deleted.` }) : null}
              {confirm === "full" && s ? t({ bn: `${s.add}টি যোগ হবে এবং ${s.conflicts}টি বিরোধী ইউনিট ব্যাকআপের অবস্থায় ফিরবে। আগে পুরো লাইভ ইনভেন্টরির যাচাই করা ব্যাকআপ রাখা হবে। শুধু লাইভে থাকা ${s.liveOnly}টি অক্ষত থাকবে।`, en: `${s.add} added and ${s.conflicts} conflicting units return to the backup state. A verified backup of the full live inventory is saved first. ${s.liveOnly} live-only units are kept.` }) : null}
              {confirm === "full2" ? t({ bn: "আপনি কি নিশ্চিত? লাইভ মানগুলো ব্যাকআপের মান দিয়ে বদলাবে (আগের অবস্থা সংরক্ষিত থাকবে)।", en: "Are you sure? Live values will be replaced by backup values (previous state is kept in a backup)." }) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t({ bn: "বাতিল", en: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { if (confirm === "full") { e.preventDefault(); setConfirm("full2"); } else void run(confirm === "merge" ? "merge" : "full"); }}>
              {confirm === "full" ? t({ bn: "চালিয়ে যান", en: "Continue" }) : t({ bn: "নিশ্চিত করুন", en: "Confirm" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
