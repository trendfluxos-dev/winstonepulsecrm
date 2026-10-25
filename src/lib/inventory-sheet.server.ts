import { inventorySheetId, parseInventorySheet, type SheetListing } from "@/lib/inventory-sheet";

const KEY = "inventory_pricing_sheet";
export type InventorySheetState = { sheetId: string; tab: string; rows: SheetListing[]; syncedAt: string | null; attemptedAt: string | null; failure: string | null };
export async function readInventorySheetState(): Promise<InventorySheetState | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("system_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) throw new Error("SHEET_STATE_UNAVAILABLE");
  return data ? data.value as unknown as InventorySheetState : null;
}
async function store(state: InventorySheetState) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const previous = await readInventorySheetState();
  if (previous && previous.syncedAt !== state.syncedAt) {
    const backupKey = `${KEY}_history_${crypto.randomUUID()}`;
    const { error: backupError } = await supabaseAdmin.from("system_settings").insert({ key: backupKey, value: previous as never });
    if (backupError) throw new Error("SHEET_BACKUP_FAILED");
    const { data: backup, error: readError } = await supabaseAdmin.from("system_settings").select("value").eq("key", backupKey).single();
    if (readError || JSON.stringify(backup?.value) !== JSON.stringify(JSON.parse(JSON.stringify(previous)))) {
      // jsonb key ordering differs; compare semantic values, not object-key order.
      const saved = backup?.value as unknown as InventorySheetState | undefined;
      if (readError || !saved || saved.sheetId !== previous.sheetId || saved.syncedAt !== previous.syncedAt || saved.rows.length !== previous.rows.length ||
        saved.rows.some((row, i) => Object.keys(row).some((key) => row[key as keyof SheetListing] !== previous.rows[i]?.[key as keyof SheetListing]))) throw new Error("SHEET_BACKUP_VERIFY_FAILED");
    }
  }
  const { error } = await supabaseAdmin.from("system_settings").upsert({ key: KEY, value: state as never }, { onConflict: "key" });
  if (error) throw new Error("SHEET_STATE_SAVE_FAILED");
}
const inflight = new Map<string, Promise<InventorySheetState>>();
async function fetchRows(sheetId: string, tab: string) {
  const key = process.env["GOOGLE_SHEETS_API_KEY"];
  const lovable = process.env["LOVABLE_API_KEY"];
  if (!key || !lovable) throw new Error("SHEETS_NOT_CONFIGURED");
  const range = `'${tab.replaceAll("'", "''")}'!A1:Z5002`;
  const response = await fetch(`https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`, {
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const body = await response.text();
    // Provider status is retained; response text is not logged because sheet names may be private.
    console.error(`Inventory Sheets [${response.status}]`, { responseReceived: body.length > 0 });
    throw new Error(`SHEETS_HTTP_${response.status}`);
  }
  const body = await response.json() as { values?: unknown };
  return parseInventorySheet(body.values);
}
export async function configureInventorySheet(link: string, tab: string) {
  const sheetId = inventorySheetId(link);
  const rows = await fetchRows(sheetId, tab);
  const now = new Date().toISOString();
  const state: InventorySheetState = { sheetId, tab, rows, syncedAt: now, attemptedAt: now, failure: null };
  await store(state);
  return state;
}
export async function syncInventorySheet(): Promise<InventorySheetState> {
  const state = await readInventorySheetState();
  if (!state) throw new Error("SOURCE_REQUIRED");
  const running = inflight.get(state.sheetId);
  if (running) return running;
  const promise = (async () => {
    const attemptedAt = new Date().toISOString();
    try {
      const rows = await fetchRows(state.sheetId, state.tab);
      const next = { ...state, rows, syncedAt: attemptedAt, attemptedAt, failure: null };
      await store(next);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "SYNC_FAILED";
      const failure = /^(SHEETS_HTTP_\d{3}|SOURCE_REQUIRED|SHEETS_NOT_CONFIGURED|INVALID_HEADERS|TOO_MANY_ROWS|DUPLICATE_UNIT)$/.test(message) ? message : "INVALID_DATA_OR_SYNC_FAILED";
      await store({ ...state, attemptedAt, failure });
      throw new Error(failure);
    }
  })();
  inflight.set(state.sheetId, promise);
  try { return await promise; } finally { inflight.delete(state.sheetId); }
}