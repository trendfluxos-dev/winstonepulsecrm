import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, RefreshCw, Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT, useLang } from "@/lib/i18n";
import { formatTaka } from "@/lib/bd-format";
import { inventorySheetStatus, refreshInventorySheet, saveInventorySheetSource } from "@/lib/inventory-sheet.functions";
import { useAdminToken } from "@/lib/local-session";
import { useMyAccount } from "@/lib/session";

export function InventorySheetPanel({ showListings = false }: { showListings?: boolean }) {
  const t = useT();
  const lang = useLang();
  const token = useAdminToken();
  const { scope } = useMyAccount();
  const status = useServerFn(inventorySheetStatus);
  const save = useServerFn(saveInventorySheetSource);
  const refresh = useServerFn(refreshInventorySheet);
  const [link, setLink] = useState("");
  const [tab, setTab] = useState("");
  const [filter, setFilter] = useState("");
  const q = useQuery({ queryKey: ["inventory-sheet", token ?? "session", scope], queryFn: () => status({ data: { adminToken: token } }),
    enabled: scope === "authority" || scope === "agent", staleTime: 60_000, retry: false, refetchOnWindowFocus: false });
  const m = useMutation({ mutationFn: (configure: boolean) => configure ? save({ data: { adminToken: token, link, tab } }) : refresh({ data: { adminToken: token } }),
    onSuccess: async () => { setLink(""); await q.refetch(); } });
  const state = q.data?.state;
  const rows = (state?.rows ?? []).filter((r) => `${r.project} ${r.unit} ${r.location ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  const when = (date: string) => new Date(date).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" });
  return <section aria-labelledby="inventory-sheet-heading" className="space-y-3 border-y border-border py-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1"><h2 id="inventory-sheet-heading" className="text-lg font-semibold">Google Sheets — Inventory & pricing</h2>
        <p className="text-sm text-muted-foreground">{t(state ? { bn: "শিটের তথ্য · CRM-এর মূল ইউনিট ও বুকিং অপরিবর্তিত", en: "Sheet listings · CRM units and bookings unchanged" } : { bn: "শিটের লিংক অপেক্ষমাণ · স্বয়ংক্রিয় সিঙ্ক চালু নয়", en: "Awaiting sheet link · automatic sync inactive" })}</p></div>
      <div className="flex flex-wrap gap-2">
        {!showListings ? <Button asChild size="sm" variant="outline"><Link to="/projects">{t({ bn: "Listings দেখুন", en: "View listings" })}</Link></Button> : null}
        {state ? <Button asChild size="sm" variant="outline"><a href={`https://docs.google.com/spreadsheets/d/${state.sheetId}/edit`} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />{t({ bn: "শিট খুলুন", en: "Open sheet" })}</a></Button> : null}
        {state && q.data?.canManage ? <Button size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate(false)}><RefreshCw className={`size-4 ${m.isPending ? "animate-spin" : ""}`} />{t({ bn: "সিঙ্ক করুন", en: "Sync now" })}</Button> : null}
      </div>
    </header>
    {scope === "none" ? <p className="text-sm text-muted-foreground">{t({ bn: "সংরক্ষিত শিটের তথ্য দেখতে অনুমোদিত স্টাফ অ্যাকাউন্টে সাইন ইন করুন।", en: "Sign in as approved staff to view saved sheet data." })}</p> : null}
    {q.isFetching ? <p className="text-sm text-muted-foreground">{t({ bn: "লোড হচ্ছে…", en: "Loading…" })}</p> : null}
    {q.error ? <p role="alert" className="text-sm text-destructive">{t({ bn: "শিটের অবস্থা পড়া যায়নি; প্রবেশাধিকার যাচাই করে আবার চেষ্টা করুন।", en: "Sheet status unavailable; check access and try again." })}</p> : null}
    {state?.syncedAt ? <p className="text-xs text-muted-foreground">{t({ bn: "সর্বশেষ সফল সিঙ্ক (ঢাকা): ", en: "Last successful sync (Dhaka): " })}{when(state.syncedAt)} · {state.rows.length} {t({ bn: "ইউনিট", en: "units" })}</p> : null}
    {state?.failure || m.error ? <p role="alert" className="text-sm text-warning">{t({ bn: "সিঙ্ক হয়নি—আগের সফল তথ্য রাখা আছে। শিটের অনুমতি, কলাম ও সংখ্যার মান যাচাই করুন।", en: "Sync failed—last successful data retained. Check sheet access, columns and numeric values." })}{state?.attemptedAt ? ` · ${when(state.attemptedAt)}` : ""}</p> : null}
    {q.data?.canManage ? <form className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]" onSubmit={(e) => { e.preventDefault(); m.mutate(true); }}>
      <label className="text-xs text-muted-foreground">{t({ bn: "Inventory শিটের লিংক", en: "Inventory sheet link" })}<Input type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" /></label>
      <label className="text-xs text-muted-foreground">{t({ bn: "ট্যাবের নাম", en: "Tab name" })}<Input required value={tab} onChange={(e) => setTab(e.target.value)} maxLength={100} /></label>
      <Button type="submit" className="self-end" disabled={m.isPending || !link || !tab}><Save className="size-4" />{t({ bn: "যাচাই করে যুক্ত করুন", en: "Verify & link" })}</Button>
    </form> : null}
    {showListings && state ? <>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} aria-label={t({ bn: "শিটের listings খুঁজুন", en: "Search sheet listings" })} placeholder={t({ bn: "প্রজেক্ট / ইউনিট খুঁজুন", en: "Search project / unit" })} />
      <div className="grid gap-2 md:hidden">{rows.map((r) => <article key={`${r.project}/${r.unit}`} className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm"><h3 className="font-semibold break-words">{r.project} · {r.unit}</h3><p className="text-muted-foreground">{r.location ?? "—"}</p><p>{r.sizeSqft ?? "—"} sq ft · {r.priceBdt === null ? "—" : formatTaka(r.priceBdt, lang)}</p><p>{t({ bn: ({ available: "উপলব্ধ", booked: "বুকড", sold: "বিক্রিত", blocked: "ব্লকড" })[r.status], en: r.status })}</p></article>)}</div>
      <div className="table-scroll hidden md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border">{[{ bn: "প্রজেক্ট / ইউনিট", en: "Project / unit" }, { bn: "লোকেশন", en: "Location" }, { bn: "বর্গফুট", en: "Sq ft" }, { bn: "মূল্য (৳)", en: "Price (BDT)" }, { bn: "অবস্থা", en: "Status" }].map((label) => <th key={label.en} className="px-2 py-2 font-medium">{t(label)}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={`${r.project}/${r.unit}`} className="border-b border-border"><td className="px-2 py-2">{r.project} · {r.unit}</td><td className="px-2 py-2">{r.location ?? "—"}</td><td className="px-2 py-2">{r.sizeSqft ?? "—"}</td><td className="px-2 py-2">{r.priceBdt === null ? "—" : formatTaka(r.priceBdt, lang)}</td><td className="px-2 py-2">{t({ bn: ({ available: "উপলব্ধ", booked: "বুকড", sold: "বিক্রিত", blocked: "ব্লকড" })[r.status], en: r.status })}</td></tr>)}</tbody></table></div>
      {!rows.length ? <p className="text-sm text-muted-foreground">{t({ bn: "কোনো listing পাওয়া যায়নি।", en: "No listings found." })}</p> : null}
    </> : null}
  </section>;
}