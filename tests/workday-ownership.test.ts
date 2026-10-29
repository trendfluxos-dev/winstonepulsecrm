import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ caller: {} as Record<string, unknown>, owner: 'agent-a', updated: 0 }));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => { const c: Record<string, unknown> = {}; Object.assign(c, { inputValidator: () => c, handler: (fn: unknown) => fn }); return c; },
}));
vi.mock('@/lib/access.server', () => ({
  resolveCaller: async () => state.caller,
  resolveWorkCaller: async () => state.caller,
  canDispatch: (c: { scope: string; readOnly: boolean }) => c.scope === 'authority' && !c.readOnly,
  requireWrite: (c: { readOnly: boolean }) => { if (c.readOnly) throw new Error('view-only'); },
}));
vi.mock('@/lib/lead-access.server', () => ({ leadHeldByOther: () => false, LEAD_NOT_YOURS: 'lead is not yours' }));
vi.mock('@/lib/lead-events.server', () => ({ logLeadEvent: async () => undefined }));
vi.mock('@/integrations/supabase/client.server', () => {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain, eq: () => chain,
    update: () => { state.updated += 1; return chain; },
    maybeSingle: async () => ({ data: { id: 'l1', name: 'L', work_date: null, assigned_to: state.owner, assigned_agent_id: state.owner }, error: null }),
    then: (r: (v: unknown) => void) => r({ error: null }),
  });
  return { supabaseAdmin: { from: () => chain } };
});

const agent = (id: string) => ({ scope: 'agent', readOnly: false, userId: id, profile: { id, name: id, role: 'agent' } });
const input = { data: { leadId: '2f1a2b3c-0000-4000-8000-000000000001', workDate: '2026-10-29' } };

beforeEach(() => { state.updated = 0; state.owner = 'agent-a'; });

it('blocks an agent from changing the work date on another agent\'s lead', async () => {
  const { setLeadWorkDate } = await import('@/lib/workday.functions');
  state.caller = agent('agent-b');
  await expect((setLeadWorkDate as unknown as (i: unknown) => Promise<unknown>)(input)).rejects.toThrow('lead is not yours');
  expect(state.updated).toBe(0);
});

it('lets the owning agent change their own lead\'s work date', async () => {
  const { setLeadWorkDate } = await import('@/lib/workday.functions');
  state.caller = agent('agent-a');
  await expect((setLeadWorkDate as unknown as (i: unknown) => Promise<unknown>)(input)).resolves.toMatchObject({ ok: true });
});

it('blocks a non-dispatch coordinator scope from moving another agent\'s lead', async () => {
  const { setLeadWorkDate } = await import('@/lib/workday.functions');
  state.caller = { ...agent('coord'), scope: 'coordinator' };
  await expect((setLeadWorkDate as unknown as (i: unknown) => Promise<unknown>)(input)).rejects.toThrow('lead is not yours');
});

it('lets writable IT move any lead', async () => {
  const { setLeadWorkDate } = await import('@/lib/workday.functions');
  state.caller = { scope: 'authority', readOnly: false, userId: 'it', profile: { id: 'it', name: 'IT', role: 'admin' } };
  await expect((setLeadWorkDate as unknown as (i: unknown) => Promise<unknown>)(input)).resolves.toMatchObject({ ok: true });
});
