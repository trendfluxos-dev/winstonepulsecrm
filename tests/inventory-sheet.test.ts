import { describe, expect, it } from "vitest";
import { INVENTORY_SHEET_HEADERS, inventorySheetId, parseInventorySheet } from "../src/lib/inventory-sheet";

describe("inventory sheet validation", () => {
  it("accepts only real Sheets origins", () => {
    expect(inventorySheetId("https://docs.google.com/spreadsheets/d/abc_123/edit#gid=0")).toBe("abc_123");
    expect(() => inventorySheetId("https://docs.google.com.evil.test/spreadsheets/d/abc/edit")).toThrow();
    expect(() => inventorySheetId("https://drive.google.com/file/d/abc/view")).toThrow();
  });
  it("keeps exact numeric BDT prices and does not infer blank values", () => {
    const rows = parseInventorySheet([INVENTORY_SHEET_HEADERS, ["Test project", "A1", "Dhaka", 1200, 8000000, "available"], ["Test project", "A2", "", "", "", "blocked"]]);
    expect(rows[0]).toEqual({ project: "Test project", unit: "A1", location: "Dhaka", sizeSqft: 1200, priceBdt: 8000000, status: "available" });
    expect(rows[1]?.priceBdt).toBeNull();
    expect(rows[1]?.sizeSqft).toBeNull();
  });
  it("rejects unknown status rather than inventing availability", () => {
    expect(() => parseInventorySheet([INVENTORY_SHEET_HEADERS, ["P", "A", "", 100, 1000, ""]])).toThrow();
  });
  it("rejects duplicate project-unit identities", () => {
    expect(() => parseInventorySheet([INVENTORY_SHEET_HEADERS, ["P", "A", "", 100, 1000, "sold"], ["p", "a", "", 100, 2000, "available"]])).toThrow("DUPLICATE_UNIT");
  });
  it("rejects formula text, negative prices and lakh strings", () => {
    for (const price of ["=1+1", -1, "80 lakh"]) expect(() => parseInventorySheet([INVENTORY_SHEET_HEADERS, ["P", "A", "", 100, price, "available"]])).toThrow();
  });
  it("rejects missing column headers and excessive rows", () => {
    expect(() => parseInventorySheet([["Project", "Price"]])).toThrow("INVALID_HEADERS");
    expect(() => parseInventorySheet([INVENTORY_SHEET_HEADERS, ...Array(5001).fill([])])).toThrow("TOO_MANY_ROWS");
  });
});