import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from '../server/supabase-store.mjs';

for (const key of ['sb_secret_test-only', 'legacy-test-token']) {
  test(`Supabase RPC authenticates ${key.startsWith('sb_secret_') ? 'opaque secret' : 'legacy bearer'} keys`, async () => {
    let captured;
    const store = createSupabaseStore({
      url: 'https://example.supabase.co', serviceRoleKey: key,
      fetchImpl: async (url, options) => { captured = { url, ...options }; return Response.json({ data: null }); },
    });
    assert.equal(await store.getPublicCard({ shareId: 'demo' }), null);
    assert.equal(captured.headers.apikey, key);
    assert.equal(captured.headers.Authorization, key.startsWith('sb_secret_') ? undefined : `Bearer ${key}`);
    assert.equal(captured.redirect, 'error');
    assert.equal(captured.url.pathname, '/rest/v1/rpc/tiger_get_public_card');
  });
}
