import { useT } from "@/lib/i18n";

type Stage = "live" | "partial" | "planned";
type Item = { name: string; stage: Stage; status: { bn: string; en: string }; next: { bn: string; en: string } };

const L = (bn: string, en: string) => ({ bn, en });

/** Guide-এর ১৫টি workspace সংযোগ — শুধু সংরক্ষিত অগ্রগতি, কোনো live probe নয়। */
export const WORKSPACE_ROADMAP: Item[] = [
  { name: "Google Sheets — Daily Lead Report", stage: "live", status: L("সংযুক্ত; IT Console থেকে সিঙ্ক যাচাই হয়েছে", "Linked; sync tested from IT Console"), next: L("প্রতিদিন স্বয়ংক্রিয় সিঙ্কের সময় ঠিক করা", "Choose a daily auto-sync time") },
  { name: "Google Calendar — Site visits", stage: "partial", status: L("সংযুক্ত; ভিজিট বোতাম আছে, প্রথম event যাচাই বাকি", "Linked; visit button exists, first event not yet confirmed"), next: L("একটি কনফার্ম ভিজিট ক্যালেন্ডারে যোগ করে দেখা", "Add one confirmed visit and check the calendar") },
  { name: "Google Drive — Knowledge folder", stage: "partial", status: L("অনুমোদিত ফোল্ডার থেকে উত্তর দেওয়ার কোড আছে", "Approved-folder answer code exists"), next: L("ফোল্ডার সংযোগ লিংক করে সূচি যাচাই", "Link the folder connection and verify indexing") },
  { name: "Google Drive — Call recordings", stage: "partial", status: L("রেকর্ডিং আপলোড পথ আছে; Drive প্রমাণ প্রতি কলে আলাদা", "Upload path exists; Drive proof is per call"), next: L("একটি নতুন কলের ফাইল Drive-এ মিলিয়ে দেখা", "Match one new call file in Drive") },
  { name: "Google Drive — Brochures", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("ব্রোশিওর ফোল্ডার নির্বাচন", "Pick the brochure folder") },
  { name: "Google Drive — Backups", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("ব্যাকআপ ফোল্ডার ও সময়সূচি ঠিক করা", "Choose backup folder and schedule") },
  { name: "Google Sheets — Inventory & pricing", stage: "partial", status: L("কাজ চলছে; Drive-এ inventory শিট ছিল না", "In progress; no inventory sheet existed in Drive"), next: L("নতুন শিটে দাম/ইউনিট বসিয়ে listings-এ দেখা", "Fill the new sheet and check listings") },
  { name: "Google Sheets — Shift summaries", stage: "planned", status: L("শিট প্যানেল আছে; আলাদা শিট সংযোগ নয়", "Sheet panel exists; no separate sheet link"), next: L("১২:৫০ ও ৫:৩০ সারাংশ শিটে পাঠানো", "Send 12:50 and 5:30 summaries to a sheet") },
  { name: "Google Docs", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("কোন রিপোর্ট Docs-এ যাবে ঠিক করা", "Decide which reports go to Docs") },
  { name: "Gmail", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("পাঠানোর ঠিকানা ও অনুমোদন নির্ধারণ", "Pick sender address and approval") },
  { name: "Google Maps", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("প্রকল্পের ঠিকানা ম্যাপে দেখানো", "Show project locations on a map") },
  { name: "Firecrawl", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("কোন ওয়েবসাইট পড়া হবে ঠিক করা", "Choose which websites to read") },
  { name: "Google Search Console", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("winstonebd.com মালিকানা যাচাই", "Verify winstonebd.com ownership") },
  { name: "Slack", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("নোটিশ যাওয়ার চ্যানেল বেছে নেওয়া", "Choose the alert channel") },
  { name: "GitHub", stage: "planned", status: L("পরিকল্পিত", "Planned"), next: L("কোড ব্যাকআপ রিপোজিটরি সংযোগ", "Connect a code backup repository") },
];

const STAGE = {
  live: { label: L("চালু", "Live"), cls: "border-success/40 bg-success/10 text-foreground" },
  partial: { label: L("আংশিক", "Partial"), cls: "border-warning/40 bg-warning/10 text-foreground" },
  planned: { label: L("পরিকল্পিত", "Planned"), cls: "border-border bg-muted text-muted-foreground" },
} as const;

export function WorkspaceRoadmap() {
  const t = useT();
  const count = (s: Stage) => WORKSPACE_ROADMAP.filter(i => i.stage === s).length;
  return <section aria-labelledby="ws-roadmap" className="space-y-4 border-t border-border pt-6">
    <header className="space-y-1">
      <h2 id="ws-roadmap" className="text-lg font-semibold">{t({ bn: "Workspace সংযোগ roadmap (১৫টি)", en: "Workspace connection roadmap (15)" })}</h2>
      <p className="text-sm text-muted-foreground">{t({ bn: `চালু ${count("live")} · আংশিক ${count("partial")} · পরিকল্পিত ${count("planned")} — সংরক্ষিত অগ্রগতি, live পরীক্ষা নয়`, en: `Live ${count("live")} · Partial ${count("partial")} · Planned ${count("planned")} — saved progress, not a live check` })}</p>
    </header>
    <ol className="divide-y divide-border">{WORKSPACE_ROADMAP.map((item, i) => <li key={item.name} className="grid gap-2 py-3 md:grid-cols-[2rem_minmax(0,2fr)_6rem_minmax(0,3fr)] md:items-start">
      <span className="text-xs text-muted-foreground">{i + 1}</span>
      <div className="min-w-0"><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{t(item.status)}</p></div>
      <span className={`w-fit rounded-full border px-2 py-0.5 text-xs ${STAGE[item.stage].cls}`}>{t(STAGE[item.stage].label)}</span>
      <p className="text-sm"><span className="font-medium">{t({ bn: "পরবর্তী: ", en: "Next: " })}</span>{t(item.next)}</p>
    </li>)}</ol>
  </section>;
}
