import { z } from "zod";

export const INVENTORY_SHEET_HEADERS = ["Project", "Unit", "Location", "Size sqft", "Price BDT", "Status"] as const;
export const INVENTORY_SYNC_CRON = "15 * * * *";
export type SheetListing = { project: string; unit: string; location: string | null; sizeSqft: number | null; priceBdt: number | null; status: "available" | "booked" | "sold" | "blocked" };

export function inventorySheetId(link: string): string {
  const url = new URL(link);
  const id = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname)?.[1];
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !id) throw new Error("INVALID_SHEET_LINK");
  return id;
}

const Row = z.object({
  project: z.string().trim().min(1).max(120), unit: z.string().trim().min(1).max(40),
  location: z.string().trim().max(160).nullable(), sizeSqft: z.number().nonnegative().max(1_000_000).nullable(),
  priceBdt: z.number().nonnegative().max(100_000_000_000).nullable(), status: z.enum(["available", "booked", "sold", "blocked"]),
});

export function parseInventorySheet(values: unknown): SheetListing[] {
  if (!Array.isArray(values) || !Array.isArray(values[0])) throw new Error("INVALID_HEADERS");
  const header = values[0].map((v: unknown) => String(v).trim().toLowerCase());
  const indices = INVENTORY_SHEET_HEADERS.map((name) => header.indexOf(name.toLowerCase()));
  if (indices.some((index) => index < 0)) throw new Error("INVALID_HEADERS");
  if (values.length > 5001) throw new Error("TOO_MANY_ROWS");
  const seen = new Set<string>();
  const num = (value: string) => value === "" ? null : /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : Number.NaN;
  return values.slice(1).filter((line) => Array.isArray(line) && line.some((v: unknown) => String(v).trim() !== "")).map((line) => {
    const cells = indices.map((index) => String(line[index] ?? "").trim());
    const listing = Row.parse({ project: cells[0], unit: cells[1], location: cells[2] || null,
      sizeSqft: num(cells[3] ?? ""), priceBdt: num(cells[4] ?? ""), status: cells[5]?.toLowerCase() });
    const key = `${listing.project.toLowerCase()}\u0000${listing.unit.toLowerCase()}`;
    if (seen.has(key)) throw new Error("DUPLICATE_UNIT");
    seen.add(key);
    return listing;
  });
}