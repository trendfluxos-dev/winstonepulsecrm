import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Database, Headphones, Lock, Server } from "lucide-react";
import logoAsset from "@/assets/winstone-pulse-logo-black-tight.webp.asset.json";
import { AdminPinDialog } from "@/components/crm/AdminPinDialog";
import { Button } from "@/components/ui/button";
import { useMyAccount } from "@/lib/session";
import { useT } from "@/lib/i18n";
import { scrollToTopAdaptive } from "@/lib/motion";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: "Sign in to your workspace — Winstone Pulse" },
      {
        name: "description",
        content:
          "আপনার Winstone Pulse কর্মঘরে প্রবেশ করুন — সেলস এজেন্ট, লিডহাব নেক্সাস, এক্সিকিউটিভ এইচকিউ ও আইটি কনসোল, এক জায়গা থেকে।",
      },
      { property: "og:title", content: "Sign in to your workspace — Winstone Pulse" },
      {
        property: "og:description",
        content: "সেলস এজেন্ট, লিডহাব নেক্সাস, এক্সিকিউটিভ এইচকিউ ও আইটি কনসোল — এক জায়গা থেকে প্রবেশ করুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Sign in to your workspace — Winstone Pulse" },
      {
        name: "twitter:description",
        content: "সেলস এজেন্ট, লিডহাব নেক্সাস, এক্সিকিউটিভ এইচকিউ ও আইটি কনসোল — এক জায়গা থেকে প্রবেশ করুন।",
      },
    ],
  }),
  component: WorkspaceSigninPage,
});

function WorkspaceSigninPage() {
  const t = useT();
  const navigate = useNavigate();
  const { scope } = useMyAccount();
  const [pinOpen, setPinOpen] = useState(false);
  const [pinTarget, setPinTarget] = useState<"/hq" | "/system" | "/leadhub">("/hq");

  const openPin = (target: "/hq" | "/system" | "/leadhub") => {
    setPinTarget(target);
    setPinOpen(true);
  };

  // Adapt scrolling speed to prefers-reduced-motion, then announce the page.
  useEffect(() => {
    scrollToTopAdaptive();
    document.getElementById("workspace-signin")?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="theme-exec signin-focus min-h-screen bg-background">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex shrink-0 items-center overflow-hidden rounded-md bg-plate-ink px-2.5 py-1.5 ring-1 ring-gold/25">
              <img
                src={logoAsset.url}
                alt="Winstone Pulse — The Premium Real Estate CRM"
                className="block h-9 w-auto sm:h-11"
              />
            </span>
          </Link>
          <Link
            to="/"
            resetScroll={false}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            ← {t({ bn: "হোমে ফিরুন", en: "Back to home" })}
          </Link>
        </div>
      </div>
      <main className="mx-auto w-full max-w-6xl animate-rise px-4 py-10 sm:px-6 sm:py-14">
        <h1
          id="workspace-signin"
          tabIndex={-1}
          className="font-hand text-center text-3xl font-semibold tracking-normal outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 sm:text-4xl"
        >
          {t({ bn: "আপনার কর্মঘরে প্রবেশ করুন", en: "Sign in to your workspace" })}
          <span aria-hidden className="mx-auto mt-2 block h-0.5 w-12 bg-gold" />
        </h1>
        <div className="mt-5 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4">
          <EntryCard
            icon={<Headphones className="size-6" />}
            title={t({ bn: "সেলস এজেন্ট", en: "Sales Agent" })}
            description={t({ bn: "আপনার নিজের লিড, কল, ফলো-আপ আর এআই কোচিং — সব এক জায়গায়।", en: "Your own leads, calls, follow-ups and AI coaching — all in one place." })}
            primary={
              <Button asChild variant="plate" className="btn-enter flex-1">
                <Link to="/auth" search={{ role: "agent", mode: "signin" }}>
                  {t({ bn: "প্রবেশ করুন", en: "Sign in" })}
                </Link>
              </Button>
            }
            secondary={
              <Button asChild variant="plate" className="flex-1">
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
              <Button variant="plate" className="btn-enter flex-1" onClick={() => openPin("/leadhub")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />

          <EntryCard
            icon={<BarChart3 className="size-6" />}
            title={t({ bn: "এক্সিকিউটিভ এইচকিউ", en: "Executive Headquarters (HQ)" })}
            description={t({ bn: "পুরো টিমের ফলাফল, রিপোর্ট আর ব্যবসার সংখ্যা — সব এক নজরে।", en: "Team performance, reports and business numbers — all at a glance." })}
            primary={
              <Button variant="plate" className="btn-enter flex-1" onClick={() => openPin("/hq")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />

          <EntryCard
            icon={<Server className="size-6" />}
            title={t({ bn: "আইটি কনসোল", en: "IT Console" })}
            description={t({ bn: "অ্যাকাউন্ট, সেটিংস আর সংযোগ — টেকনিক্যাল কাজ এখানে হয়।", en: "Accounts, settings and connections — the technical home." })}
            primary={
              <Button variant="plate" className="btn-enter flex-1" onClick={() => openPin("/system")}>
                <Lock className="size-4" /> {t({ bn: "পিন দিয়ে খুলুন", en: "Unlock PIN" })}
              </Button>
            }
          />
        </div>

        {scope !== "none" && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {t({ bn: "আগেই প্রবেশ করেছেন — ", en: "Already signed in — " })}
            <Link to="/desk" className="font-semibold text-gold hover:underline">
              {t({ bn: "আমার ডেস্কে যান", en: "go to my desk" })}
            </Link>
          </p>
        )}
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
  icon: ReactNode;
  title: string;
  description: string;
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <section className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-gold focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
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
