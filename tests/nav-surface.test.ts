import { describe, expect, it } from "vitest";
import {
  HQ_SURFACE_ROUTES,
  IT_SURFACE_ROUTES,
  SHARED_NAV_ROUTES,
  filterNavForSurface,
  navSurfaceForPath,
} from "@/lib/nav-surface";

const item = (to: string) => ({ to, label: to });
const tos = (items: { to: string }[]) => items.map((i) => i.to);

describe("nav surfaces", () => {
  it("maps each workspace path to its own surface", () => {
    expect(navSurfaceForPath("/system")).toBe("it");
    expect(navSurfaceForPath("/migration-export")).toBe("it");
    expect(navSurfaceForPath("/runtime-errors")).toBe("it");
    expect(navSurfaceForPath("/hq")).toBe("hq");
    expect(navSurfaceForPath("/booking-review")).toBe("hq");
    expect(navSurfaceForPath("/desk")).toBe("work");
    expect(navSurfaceForPath("/")).toBe("work");
  });

  it("IT Console navigation never lists Executive HQ items", () => {
    const all = [...SHARED_NAV_ROUTES, ...HQ_SURFACE_ROUTES, ...IT_SURFACE_ROUTES, "/desk", "/recorder"].map(item);
    const shown = tos(filterNavForSurface(all, "/system"));
    for (const route of HQ_SURFACE_ROUTES) expect(shown).not.toContain(route);
    expect(shown).not.toContain("/desk");
    for (const route of IT_SURFACE_ROUTES) expect(shown).toContain(route);
    expect(shown).toContain("/");
  });

  it("Executive HQ navigation never lists IT Console items", () => {
    const all = [...SHARED_NAV_ROUTES, ...HQ_SURFACE_ROUTES, ...IT_SURFACE_ROUTES, "/reports", "/customers"].map(item);
    const shown = tos(filterNavForSurface(all, "/hq"));
    for (const route of IT_SURFACE_ROUTES) expect(shown).not.toContain(route);
    for (const route of HQ_SURFACE_ROUTES) expect(shown).toContain(route);
    expect(shown).toContain("/");
    expect(shown).toContain("/security");
  });

  it("agent daily-work pages keep the full scope-filtered list untouched", () => {
    const items = ["/desk", "/recorder", "/reports", "/", "/security"].map(item);
    expect(filterNavForSurface(items, "/desk")).toEqual(items);
    expect(filterNavForSurface(items, "/reports")).toEqual(items);
  });
});
