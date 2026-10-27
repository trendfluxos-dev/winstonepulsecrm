// Honors prefers-reduced-motion for JS-driven scrolling: CSS rules cannot
// change an explicit behavior:"smooth", so callers check here instead.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Scroll to the top of the page, instantly when the user prefers reduced motion.
export function scrollToTopAdaptive(): void {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
