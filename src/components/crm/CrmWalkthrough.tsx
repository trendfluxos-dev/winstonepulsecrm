import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Home, Network, PhoneCall, RotateCcw, Server, ShieldCheck, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CRM_TOURS, INITIAL_TOUR_PROGRESS, advanceTour, previousTour, restoreTourProgress, type TourProgress } from "@/lib/crm-walkthrough";
import { setLang, useLang, useT } from "@/lib/i18n";

const KEY = "winstone.walkthrough.v1";
const ICONS = { agent: PhoneCall, leadhub: Network, hq: Users, it: Server };
const TOTAL = CRM_TOURS.reduce((count, tour) => count + tour.steps.length, 0);

export function CrmWalkthrough() {
  const t = useT();
  const lang = useLang();
  const [progress, setProgress] = useState<TourProgress>(INITIAL_TOUR_PROGRESS);
  const [ready, setReady] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setProgress(restoreTourProgress(JSON.parse(stored)));
    } catch { setStorageUnavailable(true); }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(progress)); }
    catch { setStorageUnavailable(true); }
  }, [progress, ready]);
  const tour = CRM_TOURS.find(item => item.id === progress.workspace) ?? CRM_TOURS[0];
  const step = tour?.steps[progress.step];
  if (!tour || !step) return null;
  const Icon = ICONS[tour.id];
  const complete = progress.completed.length === TOTAL;
  const first = tour.id === "agent" && progress.step === 0;
  const last = tour.id === "it" && progress.step === tour.steps.length - 1;
  function change(next: TourProgress) {
    setProgress(next);
    requestAnimationFrame(() => heading.current?.focus());
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Button asChild variant="ghost"><Link to="/"><Home />Winstone Pulse</Link></Button>
          <div className="flex items-center gap-2">
            <div role="group" aria-label={t({ bn: "ভাষা", en: "Language" })} className="flex gap-1">
              <Button size="sm" variant={lang === "bn" ? "default" : "ghost"} aria-pressed={lang === "bn"} onClick={() => setLang("bn")}>বাংলা</Button>
              <Button size="sm" variant={lang === "en" ? "default" : "ghost"} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</Button>
            </div>
            <Button asChild variant="outline" size="sm"><Link to="/manual"><BookOpen />{t({ bn: "পূর্ণ ম্যানুয়াল", en: "Full manual" })}</Link></Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gold-ink">Winstone Pulse</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t({ bn: "CRM walkthrough", en: "CRM walkthrough" })}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t({ bn: "চারটি কাজের জায়গা • লিড থেকে কল, review ও audit", en: "Four workspaces • from leads to calls, reviews and audit" })}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => change({ ...INITIAL_TOUR_PROGRESS, completed: [] })}><RotateCcw />{t({ bn: "শুরু থেকে", en: "Start over" })}</Button>
        </div>
        <div className="mt-6 max-w-xl">
          <p className="mb-2 flex justify-between gap-3 text-xs text-muted-foreground" aria-live="polite"><span>{t({ bn: "পড়া শেষ", en: "Reviewed" })}</span><span>{progress.completed.length} / {TOTAL}</span></p>
          <Progress value={progress.completed.length / TOTAL * 100} aria-label={t({ bn: "Walkthrough অগ্রগতি", en: "Walkthrough progress" })} />
          {storageUnavailable && <p className="mt-2 text-xs text-muted-foreground">{t({ bn: "এই ব্রাউজারে অগ্রগতি সংরক্ষণ করা যাচ্ছে না।", en: "Progress cannot be saved in this browser." })}</p>}
        </div>
        <Tabs value={tour.id} onValueChange={workspace => change(restoreTourProgress({ ...progress, workspace, step: 0 }))} className="mt-7">
          <TabsList aria-label={t({ bn: "কাজের জায়গা", en: "Workspace" })} className="grid h-auto w-full grid-cols-2 md:grid-cols-4">
            {CRM_TOURS.map(item => {
              const WorkspaceIcon = ICONS[item.id];
              return <TabsTrigger key={item.id} value={item.id} className="gap-2 whitespace-normal py-3"><WorkspaceIcon className="size-4 shrink-0" /><span>{item.name}</span>{item.steps.every(s => progress.completed.includes(s.id)) && <Check className="size-4 shrink-0" />}</TabsTrigger>;
            })}
          </TabsList>
        </Tabs>
        <div className="mt-7 grid items-start gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-5 text-gold-ink" />{tour.name}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(tour.purpose)}</p>
            <nav aria-label={t({ bn: "Walkthrough ধাপ", en: "Walkthrough steps" })} className="mt-4 grid gap-1">
              {tour.steps.map((item, index) => <Button key={item.id} variant={progress.step === index ? "secondary" : "ghost"} onClick={() => change({ ...progress, step: index })} aria-current={progress.step === index ? "step" : undefined} className="h-auto min-h-11 justify-start whitespace-normal px-3 py-3 text-left text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs">{progress.completed.includes(item.id) ? <Check className="size-3" /> : index + 1}</span><span className="min-w-0">{t(item.title)}</span>
              </Button>)}
            </nav>
          </aside>
          <section className="min-w-0 border-t border-border pt-6 md:border-t-0 md:border-l md:pl-8 md:pt-0" aria-labelledby="tour-step">
            <p className="text-xs font-medium text-gold-ink">{tour.name} · {progress.step + 1} / {tour.steps.length}</p>
            <h2 id="tour-step" ref={heading} tabIndex={-1} className="mt-2 text-xl font-semibold outline-none">{t(step.title)}</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{t(step.summary)}</p>
            <ol className="my-6 flex flex-wrap items-center gap-2 border-y border-border py-4" aria-label={t({ bn: "কাজের প্রবাহ", en: "Workflow" })}>
              {step.flow.map((item, index) => <li key={item.en} className="flex items-center gap-2 text-xs font-medium">{index > 0 && <ArrowRight className="size-4 text-gold-ink" aria-hidden="true" />}<span>{t(item)}</span></li>)}
            </ol>
            <ol className="space-y-5">
              {step.tasks.map((task, index) => <li key={task.en} className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">{index + 1}</span><p className="text-sm leading-7">{t(task)}</p></li>)}
            </ol>
            <div className="mt-6 flex items-start gap-3 border-l-2 border-gold bg-secondary p-4"><ShieldCheck className="mt-1 size-5 shrink-0 text-gold-ink" /><div><h3 className="text-sm font-semibold">{t({ bn: "অনুমতি ও প্রমাণের সীমা", en: "Access and evidence boundaries" })}</h3><p className="mt-1 text-sm leading-7 text-muted-foreground">{t(step.boundary)}</p></div></div>
            <div className="mt-5"><Button asChild variant="outline" className="h-auto min-h-10 whitespace-normal py-2"><Link to={step.destination}>{t(step.destinationLabel)}<ArrowRight /></Link></Button><p className="mt-2 text-xs leading-5 text-muted-foreground">{t({ bn: "প্রযোজ্য সাইন-ইন ও PIN লাগবে। গাইড পড়া কোনো কাজ সম্পন্ন বা অনুমতি প্রদান নয়।", en: "Applicable sign-in and PIN gates still apply. Reading a guide does not complete business work or grant access." })}</p></div>
            <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <Button variant="ghost" disabled={first} onClick={() => change(previousTour(progress))}><ArrowLeft />{t({ bn: "আগের ধাপ", en: "Previous" })}</Button>
              <Button disabled={complete && last} onClick={() => change(advanceTour(progress))}>{last ? t({ bn: "পড়া শেষ করুন", en: "Finish reviewing" }) : t({ bn: "পড়েছি, পরের ধাপ", en: "Reviewed, next" })}<ArrowRight /></Button>
            </div>
            {complete && <div role="status" className="mt-6 flex items-start gap-3 border-t border-border pt-5"><CheckCircle2 className="size-5 shrink-0 text-gold-ink" /><div><p className="font-medium">{t({ bn: "সব কাজের জায়গার গাইড পড়া শেষ।", en: "You have reviewed all workspace guides." })}</p><Button asChild variant="link" className="px-0"><Link to="/">{t({ bn: "নিজের কাজের জায়গায় ফিরুন", en: "Return to your workspace" })}<ArrowRight /></Link></Button></div></div>}
          </section>
        </div>
      </main>
    </div>
  );
}