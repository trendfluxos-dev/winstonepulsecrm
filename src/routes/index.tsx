import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  BarChart3,
  ChevronRight,
  Globe,
  Headphones,
  LifeBuoy,
  Mic,
  Monitor,
  Smartphone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

import emblemAsset from "@/assets/winstone-emblem.png.asset.json";
import androidAsset from "@/assets/device-android.webp.asset.json";
import webAsset from "@/assets/device-web.webp.asset.json";
import desktopAsset from "@/assets/device-desktop.webp.asset.json";
import teamHeroAsset from "@/assets/home-team-hero-v7.webp.asset.json";
import brandArchitectAsset from "@/assets/brand-architect.jpeg.asset.json";
import { scrollToTopAdaptive } from "@/lib/motion";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMyAccount } from "@/lib/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        name: "description",
        content:
          "Leads, calls, follow-ups and team performance in one premium real estate CRM.",
      },
      { property: "og:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        property: "og:description",
        content: "One connected workspace for your real estate sales floor.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://crm.winstonebd.com/social/winstone-pulse.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Winstone Pulse — The Premium Real Estate CRM; leads, calls, follow-ups and team performance." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      { name: "twitter:description", content: "Leads, calls, follow-ups and team performance — one connected sales workspace." },
      { name: "twitter:image", content: "https://crm.winstonebd.com/social/winstone-pulse.jpg" },
      { name: "twitter:image:alt", content: "Winstone Pulse — The Premium Real Estate CRM; leads, calls, follow-ups and team performance." },
      { property: "og:url", content: "https://crm.winstonebd.com/" },
      { property: "og:site_name", content: "Winstone Pulse" },
    ],
    links: [{ rel: "canonical", href: "https://crm.winstonebd.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://crm.winstonebd.com/#org",
              name: "Winstone Properties Ltd.",
              url: "https://winstonebd.com",
              email: "info@winstonebd.com",
              telephone: "+8801805049666",
            },
            {
              "@type": "WebSite",
              "@id": "https://crm.winstonebd.com/#website",
              name: "Winstone Pulse",
              url: "https://crm.winstonebd.com/",
              inLanguage: "en",
              publisher: { "@id": "https://crm.winstonebd.com/#org" },
            },
            {
              "@type": "SoftwareApplication",
              name: "Winstone Pulse",
              description: "The Premium Real Estate CRM — leads, calls, follow-ups and team performance in one workspace.",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web, Android",
              url: "https://crm.winstonebd.com/",
              image: "https://crm.winstonebd.com/social/winstone-pulse.jpg",
              publisher: { "@id": "https://crm.winstonebd.com/#org" },
            },
          ],
        }),
      },
    ],
  }),
  component: EntryHall,
});


function EntryHall() {
  const navigate = useNavigate();
  const { scope } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system" | "/leadhub">("/hq");
  const openPin = (target: "/hq" | "/system" | "/leadhub") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // One CRM, three layouts: the choice is only a remembered preference.
  // Every mode leads to the same access page.
  const chooseMode = (mode: "android" | "web" | "desktop") => {
    try {
      localStorage.setItem("winstone.view-mode", mode);
    } catch {
      // storage blocked: layout still adapts to the screen
    }
  };

  // Returning to the homepage honors the same reduced-motion scroll behavior.
  useEffect(() => {
    scrollToTopAdaptive();
  }, []);

  return (
    <div className="theme-exec min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-6">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:justify-between sm:gap-6">
          <span className="inline-flex min-w-0 items-center gap-2 sm:gap-4">
            <img
              src={emblemAsset.url}
              alt="Winstone Pulse circular house emblem"
              width={64}
              height={64}
              className="size-9 shrink-0 rounded-full object-cover sm:size-16"
            />
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-base font-bold leading-tight text-foreground sm:text-3xl">WINSTONE <span className="text-gold">PULSE</span></span>
              <span className="mt-1 block text-[8px] leading-tight text-muted-foreground min-[400px]:text-[9px] sm:text-base">THE PREMIUM REAL ESTATE CRM</span>
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground min-[400px]:text-xs sm:gap-3 sm:text-xl">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-live sm:size-3" />
            <span className="leading-tight"><span lang="en" className="block">Server online</span></span>
          </span>
        </div>
      </div>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl animate-rise flex-col px-4 py-10 sm:px-6 sm:py-14">
        <header className="border-b border-border pb-8 sm:pb-10">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase text-gold sm:text-base">
              Winstone Properties Ltd. · Find. Build. Invest.
            </p>
            <h1 className="font-hand mt-6 text-6xl font-semibold leading-[1.15] text-foreground sm:mt-8 sm:text-8xl">
              Winstone <span className="text-gold">Pulse</span>
            </h1>
            <p className="mt-4 text-[1.65rem] font-medium leading-tight text-balance text-foreground sm:mt-6 sm:text-4xl">
              <span lang="en" className="block">The Premium Real Estate CRM.</span>
            </p>
            <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground text-pretty sm:mt-6 sm:text-xl">
              <span lang="en" className="block">Leads, calls, follow-ups and team performance. One connected workspace for your sales floor.</span>
            </p>
            <Button asChild variant="outline" className="mt-5 h-auto max-w-full gap-3 whitespace-normal border-gold/50 bg-background px-4 py-3 text-left text-base font-medium active:border-gold-hover active:bg-accent focus-visible:ring-charcoal sm:mt-8 sm:px-6 sm:py-4 sm:text-lg md:h-auto">
              <Link to="/walkthrough">
                <BookOpen aria-hidden className="size-5 sm:size-6" />
                <span>
                  <span lang="en" className="block">Explore the CRM walkthrough</span>
                </span>
              </Link>
            </Button>
            <figure className="mt-8 overflow-hidden rounded-xl border border-border/70 bg-card shadow-soft sm:mt-10">
              <img
                src={teamHeroAsset.url}
                alt="Two professionals discussing the Winstone Pulse CRM"
                width={1376}
                height={768}
                fetchPriority="high"
                className="block h-auto w-full opacity-80"
              />
            </figure>
            <div className="mt-8 grid overflow-hidden rounded-xl border border-border bg-card sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Headphones, label: "Manage your team", sub: "Agents, roles & performance" },
                { icon: BarChart3, label: "Track your pipeline", sub: "Leads, follow-ups & bookings" },
                { icon: Smartphone, label: "Review call activity", sub: "Call reports & customer history" },
              ].map(({ icon: Icon, label, sub }) => (
                <span key={label} className="flex items-center gap-3 border-border p-4 text-left text-sm font-semibold text-foreground [&:not(:first-child)]:border-t sm:p-5 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(3)]:col-span-2 lg:[&:nth-child(3)]:col-span-1 lg:[&:nth-child(3)]:border-l lg:[&:nth-child(3)]:border-t-0">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full text-gold ring-1 ring-gold/40">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span lang="en" className="block">{label}</span>
                    <span lang="en" className="mt-1.5 block text-xs font-normal text-muted-foreground">{sub}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>

        </header>

        <h2 className="mt-10 text-center text-xl font-bold tracking-tight sm:text-3xl">
          <span lang="en" className="block">Choose Your Workspace</span>
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground text-pretty">
          <span lang="en" className="block">Select the mode you are using — the Winstone Pulse Gateway opens the same CRM on every device.</span>
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          <ModeCard
            icon={<Smartphone />}
            illustration={<SmartphoneIllustration />}
            title="Android"
            subtitle="Mobile-first CRM"
            onClick={() => chooseMode("android")}
          />
          <ModeCard
            icon={<Globe />}
            illustration={<WebIllustration />}
            title="Web / iOS"
            subtitle="Responsive CRM"
            onClick={() => chooseMode("web")}
          />
          <ModeCard
            icon={<Monitor />}
            illustration={<DesktopIllustration />}
            title="Desktop"
            subtitle="Full CRM Workspace"
            onClick={() => chooseMode("desktop")}
          />
          <ModeCard
            icon={<ShieldCheck />}
            illustration={<span className="grid h-16 w-full shrink-0 place-items-center rounded-md bg-secondary text-gold sm:h-24 sm:w-24 lg:w-28"><ShieldCheck className="size-10" /></span>}
            title="IT Console"
            subtitle="Secure administration"
            onClick={() => openPin("/system")}
          />
        </div>

        <p className="mt-5 text-center text-[10px] font-medium uppercase sm:mt-8 sm:text-xs tracking-[0.2em] text-muted-foreground">
          <span lang="en" className="block">One CRM. One data layer. Every device.</span>
        </p>

        <div className="mx-auto mt-8 w-full max-w-md rounded-xl border border-border bg-card p-4 sm:p-6">
          <Button asChild variant="plate" size="lg" className="h-auto w-full rounded-md py-2.5 text-base font-bold md:h-auto">
            <Link to="/signin"><span className="leading-tight"><span lang="en" className="block">Get started</span></span> <ChevronRight className="size-5" /></Link>
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            <span lang="en" className="block">Optional — pick a device above so we remember your preferred view.</span>
          </p>
        </div>


        <section className="mt-10 rounded-xl border border-border bg-card p-5 sm:p-6">
          <Button asChild variant="ghost" className="mb-4"><Link to="/call-sandbox">Offline call sandbox</Link></Button>
          <h2 className="text-lg font-bold tracking-tight">
            <span lang="en" className="block">Are you a Winstone sales agent?</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <span lang="en" className="block">The IT Console sets up your account and company device before you can start working.</span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <span lang="en" className="block">Already have an account? Sign in with your assigned credentials on the authorized device.</span>
          </p>
          <p className="mt-4 border-t border-border pt-4 text-xs font-semibold text-gold">
            <span lang="en" className="block">New agent accounts are created and managed by the IT Console.</span>
          </p>
        </section>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            <span lang="en" className="block">Already signed in</span>
            <Link to="/desk" className="font-semibold text-gold hover:underline">
              <span lang="en" className="mt-2 block">Go to my desk</span>
            </Link>
          </p>
        )}

        <section className="glass-hairline mt-8 overflow-hidden rounded-xl bg-card text-foreground shadow-soft sm:mt-10">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 p-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-stretch sm:gap-x-5 sm:gap-y-1 sm:p-5">
            <img
              src={brandArchitectAsset.url}
              alt="Zahid Hasan Emon, wearing glasses, a black tuxedo and bow tie, speaking into a microphone at a dark lectern"
              loading="lazy"
              className="aspect-square w-14 shrink-0 rounded-xl border border-gold/40 object-cover object-top sm:row-span-3 sm:aspect-auto sm:size-full sm:rounded-lg"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold-ink">
                Brand Architect
              </p>
              <p className="mt-1 truncate text-xl font-bold leading-tight tracking-tight sm:mt-2 sm:text-4xl">
                Zahid Hasan Emon
              </p>
            </div>
            <p className="col-span-2 text-xs leading-snug text-muted-foreground sm:col-start-2 sm:row-start-2 sm:mt-1 sm:text-base">
              <span lang="en" className="block">AI Systems Architect · Product Builder · Brand Architect</span>
            </p>
            <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
              <h2 className="border-t border-border pt-2.5 text-base font-semibold leading-snug tracking-tight sm:border-0 sm:pt-0 sm:text-xl sm:font-bold">
                <span lang="en" className="block">Building the Intelligence Behind Winstone.</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                <span lang="en" className="block">A unified operating ecosystem connecting property sales, customer relationships, communication intelligence, and business operations.</span>
              </p>
              <Button
                asChild
                className="mt-3 h-auto w-full whitespace-normal py-2 md:h-auto border border-gold/70 bg-charcoal text-[15px] font-bold text-card transition-[background-color,border-color,transform] duration-100 ease-out hover:border-gold hover:bg-plate-ink active:translate-y-[1px] active:scale-[0.99] active:border-gold-hover active:bg-plate-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-charcoal focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:mt-3 sm:w-auto"
              >
                <a href="https://trendflux.digital/founder" target="_blank" rel="noopener noreferrer">
                  <span className="leading-tight"><span lang="en" className="block">Meet the Brand Architect</span></span> <ArrowUpRight className="size-4" />
                  <span className="sr-only">— opens the founder page on trendflux.digital in a new tab</span>
                </a>
              </Button>
            </div>
          </div>
        </section>

        <footer className="mt-auto pt-14 text-center text-xs text-muted-foreground">
          <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-2">
            <LifeBuoy aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <p><span lang="en" className="block">Need help?</span></p>
            <Link to="/support" className="font-semibold text-gold hover:underline">
              <span lang="en" className="block">Contact IT Console</span>
            </Link>
          </div>
          <p className="mt-3"><span lang="en" className="block">© 2026 TrendFlux Digital. All Rights Reserved.</span></p>
          <p className="mt-3"><span lang="en" className="block">Developed &amp; Powered by <span className="font-bold">Zahid Hasan Emon</span>.</span></p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:text-foreground">
              <span lang="en" className="block">Privacy Policy</span>
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link to="/terms" className="hover:text-foreground">
              <span lang="en" className="block">Terms of Service</span>
            </Link>
            <span className="hidden sm:inline">·</span>
            <Link
              to="/voice-transcription"
              className="inline-flex items-start gap-1 hover:text-foreground"
            >
              <Mic aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span><span lang="en" className="block">Voice Transcription</span></span>
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
          <span lang="en" className="mt-0.5 block text-[11px] leading-tight text-muted-foreground sm:text-xs">{subtitle}</span>
        </span>
        {illustration}
      </span>
      <span className="mt-auto flex items-center justify-between rounded-md border border-border bg-secondary px-2 py-2 text-[11px] font-semibold sm:px-3 sm:text-sm">
        <span className="min-w-0 leading-tight"><span lang="en" className="block truncate">Select workspace</span></span>
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


