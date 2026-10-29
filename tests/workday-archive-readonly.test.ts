import { beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  readOnly: true,
  scope: 'authority',
  touched: [] as string[],
}));

vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => {
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      inputValidator: (_validator: unknown) => chain,
      handler: (fn: (input: unknown) => unknown) => fn,
    });
    return chain;
  },
}));

vi.mock('@/lib/access.server', () => {
  const caller = async () => ({
    scope: state.scope,
    readOnly: state.readOnly,
    userId: 'user-a',
    approval: null,
    profile: { id: 'profile-a', name: 'Executive HQ', role: 'admin' },
  });
  return {
    resolveCaller: caller,
    resolveWorkCaller: caller,
    canDispatch: (c: { scope: string; readOnly: boolean }) => c.scope === 'authority' && !c.readOnly,
    requireWrite: (c: { readOnly: boolean }) => {
      if (c.readOnly) throw new Error('view-only');
    },
  };
});

vi.mock('@/lib/lead-access.server', () => ({
  leadHeldByOther: () => false,
  LEAD_NOT_YOURS: 'lead is not yours',
}));

vi.mock('@/lib/lead-events.server', () => ({ logLeadEvent: async () => undefined }));
vi.mock('@/lib/audit.server', () => ({ logAudit: async () => undefined }));

vi.mock('@/integrations/supabase/client.server', () => {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    eq: () => chain,
    update: () => chain,
    upsert: () => chain,
    maybeSingle: async () => ({
      data: {
        id: '2f1a2b3c-0000-4000-8000-000000000001',
        name: 'Lead',
        work_date: null,
        assigned_to: 'profile-a',
        assigned_agent_id: null,
      },
      error: null,
    }),
    then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null }),
  });
  return {
    supabaseAdmin: {
      from: (table: string) => {
        state.touched.push(table);
        return chain;
      },
    },
  };
});

import { recordYearArchive, setLeadWorkDate } from '@/lib/workday.functions';

const LEAD_ID = '2f1a2b3c-0000-4000-8000-000000000001';

async function invoke(fn: unknown, data: unknown) {
  return (fn as (input: { data: unknown }) => Promise<unknown>)({ data });
}

beforeEach(() => {
  state.readOnly = true;
  state.scope = 'authority';
  state.touched.length = 0;
});

it('read-only HQ cannot overwrite a year archive record', async () => {
  await expect(
    invoke(recordYearArchive, {
      year: 2025,
      storageLocation: 'Drive folder',
      leadCount: 10,
      reportCount: 4,
    }),
  ).rejects.toThrow('view-only');
  expect(state.touched).not.toContain('lead_year_archives');
});

it('read-only HQ cannot move a lead into another working day', async () => {
  await expect(invoke(setLeadWorkDate, { leadId: LEAD_ID, workDate: '2026-10-27' })).rejects.toThrow(
    'view-only',
  );
  expect(state.touched).not.toContain('leads');
});

it('IT console session still records the archive after the guard', async () => {
  state.readOnly = false;
  await expect(
    invoke(recordYearArchive, {
      year: 2025,
      storageLocation: 'Drive folder',
      leadCount: 10,
      reportCount: 4,
    }),
  ).resolves.toEqual({ ok: true });
  expect(state.touched).toContain('lead_year_archives');
});
