import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ granted: true, role: 'agent', active: true, signedIn: true, approval: 'approved', locked: false, pinScope: null as 'hq' | 'full' | null }));
vi.mock('@tanstack/react-start/server', () => ({ getRequest: () => new Request('http://localhost', { headers: mocks.signedIn ? { authorization: 'Bearer x.y.z' } : {} }) }));
vi.mock('@/lib/admin-gate.server', () => ({ adminTokenScope: (token: string | null) => token ? mocks.pinScope : null }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({
  auth: { getClaims: async () => ({ data: { claims: { sub: 'user-1' } } }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: mocks.granted ? { role: 'executive_hq' } : null }) }; return q; },
}) }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: 'profile-1', user_id: 'user-1', role: mocks.role, approval_status: mocks.approval, is_active: mocks.active } }) }; return q;
} } }));
vi.mock('@/lib/maintenance.server', () => ({ isLockedForOrdinaryUsers: async () => mocks.locked, LOCKED_MESSAGE: 'maintenance locked' }));
vi.mock('@/lib/agent-feedback.server', () => ({ feedbackRequired: async () => false }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const chain = { inputValidator: () => chain, handler: (fn: unknown) => fn }; return chain;
} }));
vi.mock('@/lib/agent-briefing.server', () => ({ requireAgentBriefing: async (agentId: string) => ({ blocked: true, reason: 'briefing required', agentId }) }));
import { resolveCaller, resolveWorkCaller, requireBookingReviewer, requireWrite, canDispatch } from '@/lib/access.server';
import { startMyCall } from '@/lib/call-reports.functions';
beforeEach(() => { mocks.granted = true; mocks.role = 'agent'; mocks.active = true; mocks.signedIn = true; mocks.approval = 'approved'; mocks.locked = false; mocks.pinScope = null; vi.stubEnv('SUPABASE_URL', 'https://example.invalid'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test'); });
it('granted Sales Agent receives HQ oversight but no write or dispatch authority', async () => {
  const c = await resolveCaller(null, { skipMaintenance: true });
  expect(c.scope).toBe('authority'); expect(c.readOnly).toBe(true);
  expect(() => requireWrite(c)).toThrow('view-only'); expect(canDispatch(c)).toBe(false);
  expect(c.profile?.role).toBe('agent');
});
it('HQ grant does not activate an inactive account', async () => {
  mocks.active = false; expect((await resolveCaller(null, { skipMaintenance: true })).scope).toBe('none');
});
it('ungranted agents retain assigned-lead scope', async () => {
  mocks.granted = false; expect((await resolveCaller(null, { skipMaintenance: true })).scope).toBe('agent');
});
it('existing IT admin authority is unchanged', async () => {
  mocks.role = 'admin'; const c = await resolveCaller(null, { skipMaintenance: true }); expect(c.readOnly).toBe(false);
});
it('HQ-granted agents retain their own writable agent scope without dispatch powers', async () => {
  const c = await resolveWorkCaller(null);
  expect(c.scope).toBe('agent'); expect(c.readOnly).toBe(false);
  expect(c.profile?.id).toBe('profile-1'); expect(canDispatch(c)).toBe(false);
  expect(() => requireWrite(c)).not.toThrow();
  expect((await resolveCaller(null, { skipMaintenance: true })).readOnly).toBe(true);
});
it('PIN HQ viewing sessions never impersonate an agent', async () => {
  mocks.signedIn = false; mocks.pinScope = 'hq'; const c = await resolveWorkCaller('token');
  expect(c.scope).toBe('authority'); expect(c.readOnly).toBe(true); expect(c.profile).toBeNull();
});
for (const pin of ['hq', 'full'] as const) {
  it(`call start with cached ${pin} PIN reaches own briefing gate instead of sign-in rejection`, async () => {
    mocks.pinScope = pin;
    const invoke = startMyCall as unknown as (args: { data: { adminToken: string } }) => Promise<unknown>;
    await expect(invoke({ data: { adminToken: 'token' } })).resolves.toEqual({ blocked: true, reason: 'briefing required', agentId: 'profile-1' });
  });
  it(`own work keeps authenticated agent identity with cached ${pin} PIN`, async () => {
    mocks.pinScope = pin;
    const c = await resolveWorkCaller('token');
    expect(c).toMatchObject({ scope: 'agent', userId: 'user-1', profile: { id: 'profile-1' }, readOnly: false });
    expect(canDispatch(c)).toBe(false);
    const hq = await resolveCaller('token');
    expect(hq).toMatchObject({ scope: 'authority', profile: null, readOnly: pin === 'hq' });
  });
  it(`inactive session cannot use ${pin} PIN to regain own work`, async () => {
    mocks.pinScope = pin; mocks.active = false;
    expect(await resolveWorkCaller('token')).toMatchObject({ scope: 'none', readOnly: true, userId: 'user-1' });
  });
  it(`rejected session cannot use ${pin} PIN to regain own work`, async () => {
    mocks.pinScope = pin; mocks.approval = 'rejected';
    expect(await resolveWorkCaller('token')).toMatchObject({ scope: 'none', readOnly: true });
  });
}
it('cached IT PIN cannot exempt agent work from maintenance lock', async () => {
  mocks.pinScope = 'full'; mocks.locked = true;
  await expect(resolveWorkCaller('token')).rejects.toThrow('maintenance locked');
});
it('inactive HQ-granted agents cannot regain work permissions', async () => {
  mocks.active = false; const c = await resolveWorkCaller(null);
  expect(c.scope).toBe('none'); expect(c.readOnly).toBe(true);
});
it('supplemental HQ oversight cannot approve bookings', async () => {
  await expect(requireBookingReviewer(await resolveCaller(null, { skipMaintenance: true }), null)).rejects.toThrow('view-only');
});
it('genuine HQ PIN booking approval remains authorized', async () => {
  mocks.pinScope = 'hq'; await expect(requireBookingReviewer(await resolveCaller('token', { skipMaintenance: true }), 'token')).resolves.toBeUndefined();
});
