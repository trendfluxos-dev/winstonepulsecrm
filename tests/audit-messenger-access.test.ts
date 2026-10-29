import { beforeEach, expect, it, vi } from 'vitest';

const s = vi.hoisted(() => ({ caller: {} as Record<string, unknown>, tokenScope: null as string | null, profileIn: [] as string[][], inserted: 0 }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => { const c: Record<string, unknown> = {}; Object.assign(c, { inputValidator: () => c, handler: (fn: unknown) => fn }); return c; },
}));
vi.mock('@/lib/access.server', () => ({ resolveCaller: async () => s.caller }));
vi.mock('@/lib/admin-gate.server', () => ({ adminTokenScope: () => s.tokenScope }));
vi.mock('@/lib/messenger-shared', () => ({ messengerView: (c: { scope: string; readOnly: boolean }) => ({ canOpen: c.scope !== 'none', readOnly: c.readOnly }) }));
vi.mock('@/integrations/supabase/client.server', () => {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: () => chain, gte: () => chain, lte: () => chain, order: () => chain, range: () => chain, eq: () => chain, limit: () => chain,
      in: (_c: string, ids: string[]) => { if (table === 'profiles') s.profileIn.push(ids); return chain; },
      insert: async () => { s.inserted += 1; return { error: null }; },
      then: (r: (v: unknown) => void) => r(table === 'record_audit_log'
        ? { data: [{ id: '1', actor_id: 'u-a' }], error: null }
        : { data: [{ user_id: 'u-a', name: 'A' }], error: null }),
    });
    return chain;
  };
  return { supabaseAdmin: { from } };
});

beforeEach(() => { s.profileIn = []; s.inserted = 0; s.tokenScope = null; });
const call = (fn: unknown, data: unknown) => (fn as (i: unknown) => Promise<Record<string, unknown>>)({ data });

it('record audit names only the actors on returned rows, even for HQ', async () => {
  const { listRecordAudit } = await import('@/lib/crm-backup.functions');
  s.caller = { scope: 'authority', readOnly: true, userId: 'hq' };
  const out = await call(listRecordAudit, { from: '2026-10-01', to: '2026-10-29', page: 0 });
  expect(s.profileIn).toEqual([['u-a']]);
  expect(Object.keys(out.names as object)).toEqual(['u-a']);
});

it('blocks a signed-in agent without the full IT PIN from changing Messenger sync decisions', async () => {
  const { recordMessengerSyncDecision } = await import('@/lib/messenger-sync-decisions.functions');
  s.caller = { scope: 'agent', readOnly: false, profile: { id: 'p' } };
  const out = await call(recordMessengerSyncDecision, { action: 'disable', reason: 'test reason here' });
  expect(out.code).toBe('FORBIDDEN');
  expect(s.inserted).toBe(0);
});

it('blocks the HQ PIN from changing Messenger sync decisions', async () => {
  const { recordMessengerSyncDecision } = await import('@/lib/messenger-sync-decisions.functions');
  s.tokenScope = 'hq';
  s.caller = { scope: 'authority', readOnly: true, profile: { id: 'p' } };
  const out = await call(recordMessengerSyncDecision, { action: 'disable', reason: 'test reason here', adminToken: 'x' });
  expect(out.code).toBe('FORBIDDEN');
  expect(s.inserted).toBe(0);
});
