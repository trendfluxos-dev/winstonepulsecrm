import { validateMetaWebhookPayload } from "@/lib/meta-webhook-payload";

export const META_CALLBACK_URL = "https://crm.winstonebd.com/api/public/meta/messenger";
export const META_SIMULATOR_CASES = ["valid", "duplicate", "conflict", "invalid_signature", "invalid_payload"] as const;
export type MetaSimulatorCase = typeof META_SIMULATOR_CASES[number];
export type SimulationResult = {
  scenario: MetaSimulatorCase;
  code: "SIMULATED_NEW_EVENT" | "SIMULATED_DUPLICATE" | "SIMULATED_CONFLICT" | "SIMULATED_INVALID_SIGNATURE" | "SIMULATED_INVALID_PAYLOAD";
  stage: "signature" | "payload" | "idempotency";
  realRecordsCreated: 0;
  simulationOnly: true;
};
export type SimulationLedger = Readonly<Record<string, string>>;
const result = (scenario: MetaSimulatorCase, code: SimulationResult["code"], stage: SimulationResult["stage"]): SimulationResult => ({ scenario, code, stage, realRecordsCreated: 0, simulationOnly: true });
function fixture(changed = false) {
  return { object: "page", entry: [{ id: "0", time: 0, messaging: [{ sender: { id: "0" }, recipient: { id: "0" }, timestamp: changed ? 1 : 0, message: { mid: "SYNTHETIC_CONTROL_CENTER_EVENT" } }] }] };
}

/** Preset-only local simulator: no user payload, secrets, network, storage or lead intake. */
export async function simulateMetaEvent(scenario: MetaSimulatorCase, ledger: SimulationLedger): Promise<{ result: SimulationResult; ledger: SimulationLedger }> {
  if (scenario === "invalid_signature") return { result: result(scenario, "SIMULATED_INVALID_SIGNATURE", "signature"), ledger };
  if (scenario === "invalid_payload") {
    const checked = validateMetaWebhookPayload({ object: "not-a-page", entry: [] });
    if (!checked.valid) return { result: result(scenario, "SIMULATED_INVALID_PAYLOAD", "payload"), ledger };
  }
  const base = fixture();
  const body = fixture(scenario === "conflict");
  const validated = validateMetaWebhookPayload(body);
  if (!validated.valid) return { result: result(scenario, "SIMULATED_INVALID_PAYLOAD", "payload"), ledger };
  const fingerprint = async (value: unknown) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  };
  const key = "SYNTHETIC_ONLY:event";
  // Duplicate/conflict presets include their own synthetic first receipt.
  const existing = scenario === "duplicate" || scenario === "conflict" ? await fingerprint(base) : ledger[key];
  const current = await fingerprint(body);
  if (existing) return { result: result(scenario, existing === current ? "SIMULATED_DUPLICATE" : "SIMULATED_CONFLICT", "idempotency"), ledger: { ...ledger, [key]: existing } };
  return { result: result(scenario, "SIMULATED_NEW_EVENT", "idempotency"), ledger: { ...ledger, [key]: current } };
}