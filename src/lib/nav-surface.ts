// Context-aware navigation surfaces.
//
// Business rule (owner 2026-10-30): each workspace surface shows only its own
// navigation. The IT Console must not list Executive HQ items, Executive HQ
// must not list IT Console items, and agent daily-work pages never show
// IT/HQ-only options. Shared core routes (home, PIN & Access, help) stay on
// every surface so staff can always return to a neutral page.

export const IT_SURFACE_ROUTES = [
  "/system",
  "/runtime-errors",
  "/load-diagnostics",
  "/ingest",
  "/migration",
  "/migration-export",
] as const;

export const HQ_SURFACE_ROUTES = [
  "/hq",
  "/contributions",
  "/audit-log",
  "/staff-portal",
  "/booking-review",
  "/facebook-ads",
  "/meta-control-center",
] as const;

/** Routes that appear on every surface, for every allowed scope. */
export const SHARED_NAV_ROUTES = [
  "/",
  "/security",
  "/integrations",
  "/docs",
  "/docs-admin",
  "/help",
  "/walkthrough",
] as const;

export type NavSurface = "it" | "hq" | "work";

export function navSurfaceForPath(pathname: string): NavSurface {
  const p = (pathname.split("?")[0] ?? pathname).replace(/\/+$/, "") || "/";
  if ((IT_SURFACE_ROUTES as readonly string[]).includes(p)) return "it";
  if ((HQ_SURFACE_ROUTES as readonly string[]).includes(p)) return "hq";
  return "work";
}

/** Keeps only the current surface's routes plus the shared core. */
export function filterNavForSurface<T extends { to: string }>(
  items: readonly T[],
  pathname: string,
): T[] {
  const surface = navSurfaceForPath(pathname);
  if (surface === "work") return [...items];
  const allowed = new Set<string>([
    ...SHARED_NAV_ROUTES,
    ...(surface === "it" ? IT_SURFACE_ROUTES : HQ_SURFACE_ROUTES),
  ]);
  return items.filter((item) => allowed.has(item.to));
}
