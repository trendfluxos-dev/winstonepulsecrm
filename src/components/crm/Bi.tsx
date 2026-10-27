import { useLang } from "@/lib/i18n";

/**
 * Bilingual label: the active language leads, the other language sits under it as a
 * small support line. English is Winstone Pulse's primary language; Bengali stays a
 * full alternative that staff can switch to (a saved choice always wins).
 *
 * Use for headings, section titles and card labels. For one-line places (options,
 * placeholders, toasts) use `useT()` from @/lib/i18n instead.
 */
export function Bi({
  en,
  bn,
  className = "",
  subClassName = "",
}: {
  en: string;
  bn: string;
  className?: string;
  subClassName?: string;
}) {
  const lang = useLang();
  const primary = lang === "bn" ? bn : en;
  const support = lang === "bn" ? en : bn;
  return (
    <span className={className}>
      <span className="block">{primary}</span>
      <span
        aria-hidden
        className={`block text-[0.72em] font-normal leading-tight text-muted-foreground ${subClassName}`}
      >
        {support}
      </span>
    </span>
  );
}
