import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  BarChart3,
  ChevronRight,
  Globe,
  Headphones,
  LifeBuoy,
  Lock,
  Mic,
  Monitor,
  Server,
  Smartphone,
  Database,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

import logoAsset from "@/assets/winstone-mark.png.asset.json";
import androidAsset from "@/assets/device-android.webp.asset.json";
import webAsset from "@/assets/device-web.webp.asset.json";
import desktopAsset from "@/assets/device-desktop.webp.asset.json";
import teamHeroAsset from "@/assets/home-team-hero-v2.webp.asset.json";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        name: "description",
        content:
          "লিড, কল, ফলো-আপ ও টিমের ফলাফল — Winstone Pulse-এ সেলস টিমের সব কাজ এক জায়গায়। মোবাইল ও কম্পিউটারে একই CRM।",
      },
      { property: "og:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        property: "og:description",
        content: "লিড থেকে ফলো-আপ, কল থেকে টিমের ফলাফল — সেলস টিমের সব কাজ এক জায়গায়।",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://crm.winstonebd.com/social/winstone-pulse.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Winstone Pulse — The Premium Real Estate CRM; leads, calls, follow-ups and team performance." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      { name: "twitter:description", content: "লিড, কল, ফলো-আপ ও টিমের ফলাফল — আপনার সেলস টিমের সব কাজ এক জায়গায়।" },
      { name: "twitter:image", content: "https://crm.winstonebd.com/social/winstone-pulse.jpg" },
      { name: "twitter:image:alt", content: "Winstone Pulse — The Premium Real Estate CRM; leads, calls, follow-ups and team performance." },
    ],
  }),
  component: EntryHall,
});

type RoleKey = "hq" | "agent" | "leadhub" | "it";
const ROLES: { key: RoleKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "hq", label: "Executive HQ", icon: BarChart3 },
  { key: "agent", label: "Sales Agent", icon: Headphones },
  { key: "leadhub", label: "LeadHub Nexus", icon: Database },
  { key: "it", label: "IT Console", icon: Server },
];

function EntryHall() {
  const t = useT();
  const navigate = useNavigate();
  const { scope } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system" | "/leadhub">("/hq");

  const openPin = (target: "/hq" | "/system" | "/leadhub") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // One CRM, three layouts: the choice is only a remembered preference.
  // Every mode leads to the same existing access screen below.
  const chooseMode = (mode: "android" | "web" | "desktop") => {
    try {
      localStorage.setItem("winstone.view-mode", mode);
    } catch {
      // storage blocked: layout still adapts to the screen
    }
    document.getElementById("workspace-signin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const [role, setRole] = useState<RoleKey>("agent");
  const startRole = () => {
    if (role === "agent") void navigate({ to: "/auth", search: { role: "agent", mode: "signin" } as never });
    else openPin(role === "hq" ? "/hq" : role === "leadhub" ? "/leadhub" : "/system");
  };

  return (
    <div className="theme-exec min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <span className="flex min-w-0 items-center gap-2.5">
            <img src={logoAsset.url} alt="" className="size-8 shrink-0 rounded-full object-cover sm:size-9" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold tracking-[0.12em]">
                WINSTONE <span className="text-gold">PULSE</span>
              </span>
              <span className="block truncate text-[9px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                The Premium Real Estate CRM
              </span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden className="size-1.5 rounded-full bg-live" /> {t({ bn: "সার্ভার চালু আছে", en: "Server online" })}
          </span>
        </div>
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl animate-rise flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="border-b border-border pb-8 sm:pb-10">
          <div className="text-left">
            <p className="text-[11px] font-semibold uppercase text-gold">
              Winstone Properties Ltd. · Find. Build. Invest.
            </p>
            <h1 className="font-hand mt-5 text-5xl font-semibold leading-[1.15] text-foreground sm:mt-6 sm:text-7xl lg:text-8xl">
              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-3 text-xl font-medium text-foreground sm:text-2xl">
              The Premium Real Estate CRM.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t({ bn: "লিড, কল, ফলো-আপ আর টিমের ফলাফল — আপনার সেলস টিমের সব কাজ এক জায়গায়।", en: "Leads, calls, follow-ups and team performance. One connected workspace for your sales floor." })}
            </p>
            <Button asChild variant="outline" className="mt-5"><Link to="/walkthrough"><BookOpen />{t({ bn: "CRM walkthrough দেখুন", en: "Explore the CRM walkthrough" })}</Link></Button>
            <figure className="-mx-4 mt-8 overflow-hidden border-y border-border bg-card sm:mx-0 sm:mt-10 sm:rounded-xl sm:border">
              <img
                src={teamHeroAsset.url}
                alt={t({ bn: "Winstone Pulse CRM নিয়ে আলোচনা করছেন দুইজন", en: "Two professionals discussing the Winstone Pulse CRM" })}
                width={1376}
                height={768}
                fetchPriority="high"
                className="block h-auto w-full"
              />
            </figure>
            <div className="mt-8 grid overflow-hidden rounded-xl border border-border bg-card sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Headphones, label: t({ bn: "টিম সামলান", en: "Manage your team" }), sub: t({ bn: "এজেন্ট, ভূমিকা ও ফলাফল", en: "Agents, roles & performance" }) },
                { icon: BarChart3, label: t({ bn: "কাজের ধাপ দেখুন", en: "Track your pipeline" }), sub: t({ bn: "লিড, ফলো-আপ ও বুকিং", en: "Leads, follow-ups & bookings" }) },
                { icon: Smartphone, label: t({ bn: "কলের কাজ দেখুন", en: "Review call activity" }), sub: t({ bn: "কল রিপোর্ট ও কাস্টমারের ইতিহাস", en: "Call reports & customer history" }) },
              ].map(({ icon: Icon, label, sub }) => (
                <span key={label} className="flex items-center gap-3 border-border p-4 text-left text-sm font-semibold text-foreground [&:not(:first-child)]:border-t sm:p-5 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(3)]:col-span-2 lg:[&:nth-child(3)]:col-span-1 lg:[&:nth-child(3)]:border-l lg:[&:nth-child(3)]:border-t-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-gold ring-1 ring-gold/40">
                    <Icon className="size-4" />
                  </span>
                  <span className="leading-tight">
                    {label}
                    <span className="block text-xs font-normal text-muted-foreground">{sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>

        </header>

        <h2 className="mt-10 text-center text-xl font-bold tracking-tight sm:text-3xl">
          {t({ bn: "আপনার কর্মঘর বেছে নিন", en: "Choose Your Workspace" })}
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t({ bn: "যে ডিভাইসে কাজ করেন সেটা বেছে নিন — প্রতিটি ডিভাইসে একই CRM খোলে।", en: "Select the mode you are using — the Winstone Pulse Gateway opens the same CRM on every device." })}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          <ModeCard
            icon={<Smartphone />}
            illustration={<SmartphoneIllustration />}
            title="Android"
            subtitle={t({ bn: "মোবাইলে কাজের জন্য", en: "Mobile-first CRM" })}
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            icon={<Globe />}
            illustration={<WebIllustration />}
            title="Web / iOS"
            subtitle={t({ bn: "যেকোনো ব্রাউজারে", en: "Responsive CRM" })}
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            icon={<Monitor />}
            illustration={<DesktopIllustration />}
            title="Desktop"
            subtitle={t({ bn: "পুরো ডেস্কটপ ভিউ", en: "Full CRM Workspace" })}
            onClick={() => chooseMode("desktop")}
          />
          <ModeCard
            icon={<ShieldCheck />}
            illustration={<span className="grid h-16 w-full shrink-0 place-items-center rounded-md bg-secondary text-gold sm:h-24 sm:w-24 lg:w-28"><ShieldCheck className="size-10" /></span>}
            title="IT Console"
            subtitle={t({ bn: "নিরাপদ প্রশাসন", en: "Secure administration" })}
            onClick={() => openPin("/system")}
          />
        </div>

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:mt-8 sm:text-xs tracking-[0.2em] text-muted-foreground">
          {t({ bn: "এক CRM · এক ডেটা · প্রতিটি ডিভাইস", en: "One CRM. One data layer. Every device." })}
        </p>

        <div className="mx-auto mt-8 w-full max-w-md rounded-xl border border-border bg-card p-4 sm:p-6">
          <p className="text-sm font-semibold">{t({ bn: "আপনার ভূমিকা ও কর্মঘর", en: "Your role & workspace" })}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ROLES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={role === key}
                onClick={() => setRole(key)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${role === key ? "border-gold bg-secondary font-semibold" : "border-border bg-card hover:border-gold"}`}
              >
                <Icon className="size-4 shrink-0" /> <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
          <Button size="lg" className="btn-enter mt-4 w-full rounded-md text-base font-bold" onClick={startRole}>
            {t({ bn: "শুরু করুন", en: "Get started" })} <ChevronRight className="size-5" />
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t({ bn: "ঐচ্ছিক — উপরে ডিভাইস বেছে নিলে আপনার পছন্দ মনে রাখা হবে।", en: "Optional — pick a device above so we remember your preferred view." })}
          </p>
        </div>

        <div aria-hidden className="mt-12 border-t border-border" />

        <h2
          id="workspace-signin"
          className="font-hand mt-12 scroll-mt-6 text-center text-3xl font-semibold tracking-normal sm:text-4xl"
        >
          {t({ bn: "আপনার কর্মঘরে প্রবেশ করুন", en: "Sign in to your workspace" })}
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          <EntryCard
            icon={<Headphones className="size-6" />}
            title={t({ bn: "সেলস এজেন্ট", en: "Sales Agent" })}
            description={t({ bn: "আপনার নিজের লিড, কল, ফলো-আপ আর এআই কোচিং — সব এক জায়গায়।", en: "Your own leads, calls, follow-ups and AI coaching — all in one place." })}
            primary={
              <Button asChild className="btn-enter flex-1">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  {t({ bn: "প্রবেশ করুন", en: "Sign in" })}
                </Link>
              </Button>
            }
            secondary={
              <Button asChild variant="secondary" className="flex-1">
                <Link to="/auth" search={{ role: "agent", mode: "signup" }}>
                  {t({ bn: "নতুন অ্যাকাউন্ট", en: "Create account" })}
                </Link>
              </Button>
            }
          />

          <EntryCard
            icon={<Database className="size-6" />}
            title={t({ bn: "লিডহাব নেক্সাস", en: "LeadHub Nexus" })}
            description={t({ bn: "নতুন লিড যোগ ও এজেন্টদের মাঝে ভাগ করার মূল ঘর।", en: "The main home for adding new leads and sharing them with agents." })}
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/leadhub")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />

          <EntryCard
            icon={<BarChart3 className="size-6" />}
            title={t({ bn: "এক্সিকিউটিভ এইচকিউ", en: "Executive Headquarters (HQ)" })}
            description={t({ bn: "পুরো টিমের ফলাফল, রিপোর্ট আর ব্যবসার সংখ্যা — সব এক নজরে।", en: "Team performance, reports and business numbers — all at a glance." })}
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/hq")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />

          <EntryCard
            icon={<Server className="size-6" />}
            title={t({ bn: "আইটি কনসোল", en: "IT Console" })}
            description={t({ bn: "অ্যাকাউন্ট, সেটিংস আর সংযোগ — টেকনিক্যাল কাজ এখানে হয়।", en: "Accounts, settings and connections — the technical home." })}
            primary={
              <Button className="btn-enter flex-1" onClick={() => openPin("/system")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />
        </div>

        <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold tracking-tight">{t({ bn: "আপনি কি Winstone-এর সেলস এজেন্ট?", en: "Are you a Winstone sales agent?" })}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({ bn: "কাজ শুরুর আগে IT Console থেকে আপনার অ্যাকাউন্ট ও কোম্পানির ডিভাইস তৈরি করে দেওয়া হয়।", en: "The IT Console sets up your account and company device before you can start working." })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({ bn: "অ্যাকাউন্ট থাকলে অনুমোদিত ডিভাইসে নিজের তথ্য দিয়ে প্রবেশ করুন।", en: "Already have an account? Sign in with your assigned credentials on the authorized device." })}
          </p>
          <p className="mt-4 border-t border-border pt-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold">
            {t({ bn: "নতুন এজেন্ট অ্যাকাউন্ট IT Console-ই তৈরি করে।", en: "New agent accounts are created and managed by the IT Console." })}
          </p>
        </section>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t({ bn: "আগেই প্রবেশ করেছেন — ", en: "Already signed in — " })}
            <Link to="/desk" className="font-semibold text-gold hover:underline">
              {t({ bn: "আমার ডেস্কে যান", en: "go to my desk" })}
            </Link>
          </p>
        )}

        <footer className="mt-auto pt-14 text-center text-xs text-muted-foreground">
          <p className="inline-flex items-center gap-1.5">
            <LifeBuoy className="size-3.5" /> {t({ bn: "সাহায্য দরকার?", en: "Need help?" })}{" "}
            <Link to="/support" className="font-semibold text-gold hover:underline">
              {t({ bn: "IT Console-এর সাথে যোগাযোগ করুন", en: "Contact IT Console" })}
            </Link>
          </p>
          <p className="mt-3">© 2026 TrendFlux Digital. All Rights Reserved.</p>
          <p className="mt-1">Developed &amp; Powered by Zahid Hasan Emon.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link to="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              to="/voice-transcription"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Mic className="size-3" /> Voice Transcription
            </Link>
          </div>
        </footer>
      </main>

      <AdminPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        surface={pinTarget === "/hq" ? "hq" : pinTarget === "/leadhub" ? "leadhub" : "system"}
        onUnlocked={() => void navigate({ to: pinTarget })}
      />
    </div>
  );
}

function EntryCard({
  icon,
  title,
  description,
  primary,
  secondary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  return (
    <section className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold">
      <span className="grid size-12 place-items-center rounded-full bg-gold/10 text-gold ring-1 ring-gold/40">
        {icon}
      </span>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        {primary}
        {secondary}
      </div>
    </section>
  );
}

function ModeCard({
  icon,
  illustration,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  illustration: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col gap-3 rounded-md border border-border bg-card p-2.5 text-left transition-colors sm:gap-5 sm:p-4 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <span className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between">
        <span className="min-w-0">
          <span className="hidden size-8 place-items-center rounded-md border border-gold/40 text-gold sm:grid [&_svg]:size-4">
            {icon}
          </span>
          <span className="block text-sm font-bold tracking-tight sm:mt-4 sm:text-lg">{title}</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:text-xs">{subtitle}</span>
        </span>
        {illustration}
      </span>
      <span className="mt-auto flex items-center justify-between rounded-md border border-border bg-secondary px-2 py-2 text-[11px] font-semibold sm:px-3 sm:text-sm">
        <span className="truncate">{t({ bn: "এই কর্মঘর খুলুন", en: "Select workspace" })}</span>
        <ArrowUpRight className="size-4 shrink-0" />
      </span>
    </button>
  );
}

function DevicePhoto({ src, alt }: { src: string; alt: string }) {
  return (
    <span className="block h-16 w-full shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-24 lg:w-28">
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
    </span>
  );
}

function SmartphoneIllustration() {
  return <DevicePhoto src={androidAsset.url} alt="Android phone" />;
}

function WebIllustration() {
  return <DevicePhoto src={webAsset.url} alt="Phone browser showing the web CRM" />;
}

function DesktopIllustration() {
  return <DevicePhoto src={desktopAsset.url} alt="Desktop computer" />;
}


