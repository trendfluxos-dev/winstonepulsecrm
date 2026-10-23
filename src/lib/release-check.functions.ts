import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LIVE_URL = "https://crm.winstonebd.com/manual";
const KEY = "release_status";

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

type Stored = {
  expectedVersion: string;
  lastCheckAt: string | null;
  lastDeployed: boolean;
  liveVersion: string | null;
  results: { id: string; label: string; ok: boolean }[];
  lastSuccessAt: string | null;
  lastSuccessVersion: string | null;
  error: string | null;
};

async function guard(adminToken: string | null | undefined) {
  const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireDispatch(caller);
}

async function readStored(): Promise<Stored | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("system_settings").select("value").eq("key", KEY).maybeSingle();
  return (data?.value as Stored | undefined) ?? null;
}

/** Last stored live verification. The "published version" is only what the live site actually shows. */
export const getReleaseStatus = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => TokenInput.parse(i))
  .handler(async ({ data }) => {
    await guard(data.adminToken);
    const { MANUAL_VERSION } = await import("@/lib/system-manual");
    return { expectedVersion: MANUAL_VERSION, liveUrl: LIVE_URL, stored: await readStored() };
  });

/** Fetch live /manual, check markers, store result. Never marks deployed unless all markers pass. */
export const runLiveReleaseCheck = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenInput.parse(i))
  .handler(async ({ data }) => {
    await guard(data.adminToken);
    const { MANUAL_VERSION } = await import("@/lib/system-manual");
    const { evaluateManualHtml } = await import("@/lib/release-check");
    const prev = await readStored();
    const now = new Date().toISOString();
    let next: Stored;
    try {
      const res = await fetch(`${LIVE_URL}?check=${Date.now()}`, { headers: { "cache-control": "no-cache" } });
      if (!res.ok) throw new Error(`Live site returned HTTP ${res.status}`);
      const r = evaluateManualHtml(await res.text());
      next = {
        expectedVersion: MANUAL_VERSION,
        lastCheckAt: now,
        lastDeployed: r.deployed,
        liveVersion: r.liveVersion,
        results: r.results,
        lastSuccessAt: r.deployed ? (prev?.lastSuccessVersion === MANUAL_VERSION ? prev.lastSuccessAt : now) : (prev?.lastSuccessAt ?? null),
        lastSuccessVersion: r.deployed ? MANUAL_VERSION : (prev?.lastSuccessVersion ?? null),
        error: null,
      };
    } catch (e) {
      next = {
        expectedVersion: MANUAL_VERSION,
        lastCheckAt: now,
        lastDeployed: false,
        liveVersion: null,
        results: [],
        lastSuccessAt: prev?.lastSuccessAt ?? null,
        lastSuccessVersion: prev?.lastSuccessVersion ?? null,
        error: e instanceof Error ? e.message : "Live check failed",
      };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("system_settings").upsert({ key: KEY, value: next as never }, { onConflict: "key" });
    return next;
  });
