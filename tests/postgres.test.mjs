import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createApi } from '../server/api.mjs';
import { createSupabaseStore } from '../server/supabase-store.mjs';
import { SCORE_KEYS, LEGACY_SCORE_KEYS } from '../config/stats.js';

for (const [version, keys, otherKeys] of [['friends-v2', SCORE_KEYS, LEGACY_SCORE_KEYS], ['campus-v1', LEGACY_SCORE_KEYS, SCORE_KEYS]]) {
test(`production PostgreSQL ${version} enforces private access, unlock, duplicates and rating cap`, async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for (const migration of ['001_tiger_backend.sql', '002_retention.sql', '003_friend_stats.sql']) await db.exec(await readFile(new URL(`../database/${migration}`, import.meta.url), 'utf8'));
    const privileges = await db.query(`SELECT
      has_schema_privilege('anon', 'tiger_private', 'USAGE') AS schema_access,
      has_table_privilege('anon', 'tiger_private.cards', 'SELECT') AS read_cards,
      has_function_privilege('anon', 'public.tiger_get_owner_card(jsonb)', 'EXECUTE') AS owner_rpc,
      has_function_privilege('authenticated', 'public.tiger_submit_rating(jsonb)', 'EXECUTE') AS rate_rpc,
      has_function_privilege('service_role', 'public.tiger_get_owner_card(jsonb)', 'EXECUTE') AS server_rpc`);
    assert.deepEqual(privileges.rows[0], { schema_access: false, read_cards: false, owner_rpc: false, rate_rpc: false, server_rpc: true });
    let rpcError;
    const fetchImpl = async (url, options) => {
      const name = new URL(url).pathname.split('/').at(-1);
      assert.match(name, /^tiger_[a-z_]+$/);
      assert.equal(options.headers.apikey, 'server-only-test-key');
      await db.exec('SET ROLE service_role');
      try {
        const result = await db.query(`SELECT public.${name}($1::jsonb) AS payload`, [JSON.stringify(JSON.parse(options.body).p_input)]);
        return Response.json(result.rows[0].payload);
      } catch (error) { rpcError = error.message; throw error; }
      finally { await db.exec('RESET ROLE'); }
    };
    const store = createSupabaseStore({ url: 'https://project.supabase.co', serviceRoleKey: 'server-only-test-key', fetchImpl });
    const handle = createApi({ store, hashSecret: randomBytes(32).toString('hex'), clock: () => Date.parse('2026-11-04T00:00:00Z'), rateLimits: { create: 100, rating: 200 } });
    const scores = Object.fromEntries(keys.map(key => [key, 3]));
    async function request(path, method = 'GET', body, key) {
      const res = await handle(new Request(`https://test.local/api${path}`, {
        method, headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }), { clientIp: '192.0.2.1' });
      return { status: res.status, body: res.status === 204 ? null : await res.json() };
    }
    const ownerDevice = randomUUID();
    const created = await request('/cards', 'POST', { nickname: '안암호랑이', deviceId: ownerDevice, selfScores: scores });
    assert.equal(created.status, 201, rpcError || JSON.stringify(created.body));
    const card = created.body;
    const path = `/public/${card.shareId}`;
    const initial = await request(path);
    assert.equal(initial.body.statVersion, version);
    assert.equal(initial.body.averages, null);
    const wrongVersion = await request(`${path}/ratings`, 'POST', { deviceId: randomUUID(), scores: Object.fromEntries(otherKeys.map(key => [key, 3])) });
    assert.equal(wrongVersion.status, 400);
    const own = await request(`${path}/ratings`, 'POST', { deviceId: ownerDevice, scores });
    assert.equal(own.status, 403);
    assert.equal((await request(`/cards/${card.id}`)).status, 401);
    const device = randomUUID();
    assert.equal((await request(`${path}/ratings`, 'POST', { deviceId: device, scores })).status, 201);
    assert.equal((await request(`${path}/ratings`, 'POST', { deviceId: device, scores })).status, 409);
    for (let n = 2; n <= 30; n++) {
      const rating = await request(`${path}/ratings`, 'POST', { deviceId: randomUUID(), scores });
      assert.equal(rating.status, 201, JSON.stringify(rating.body));
      assert.equal(rating.body.count, n);
      assert.deepEqual(rating.body.averages, n < 3 ? null : scores);
      assert.equal(rating.body.selfScores, undefined);
    }
    assert.equal((await request(`${path}/ratings`, 'POST', { deviceId: randomUUID(), scores })).status, 409);
    const result = await request(`/cards/${card.id}`, 'GET', undefined, card.ownerKey);
    assert.equal(result.status, 200); assert.deepEqual(result.body.selfScores, scores);
    await store.purgeExpired();
    assert.equal((await request(path)).status, 200);
    assert.equal((await request(`/cards/${card.id}`, 'DELETE', undefined, card.ownerKey)).status, 204);
    assert.equal((await request(path)).status, 404);
    assert.equal((await db.query('SELECT count(*)::integer AS n FROM tiger_private.ratings')).rows[0].n, 0);
  } finally { await db.close(); }
});
}

test('stat migration preserves existing cards and ratings without relabeling their scores', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    for (const file of ['001_tiger_backend.sql', '002_retention.sql']) await db.exec(await readFile(new URL(`../database/${file}`, import.meta.url), 'utf8'));
    const input = { id: randomUUID(), shareId: 'legacycard01', ownerHash: 'a'.repeat(64), deviceHash: 'b'.repeat(64), nickname: '기존카드', selfScores: Object.fromEntries(LEGACY_SCORE_KEYS.map(k => [k, 2])) };
    const rpc = async (name, args) => (await db.query(`SELECT public.${name}($1::jsonb) AS value`, [JSON.stringify(args)])).rows[0].value;
    await rpc('tiger_create_card', input);
    const scores = Object.fromEntries(LEGACY_SCORE_KEYS.map(k => [k, 4]));
    for (const ch of ['c', 'd', 'e']) await rpc('tiger_submit_rating', { shareId: input.shareId, deviceHash: ch.repeat(64), scores });
    const before = await rpc('tiger_get_owner_card', { id: input.id, ownerHash: input.ownerHash });
    await db.exec(await readFile(new URL('../database/003_friend_stats.sql', import.meta.url), 'utf8'));
    const after = await rpc('tiger_get_owner_card', { id: input.id, ownerHash: input.ownerHash });
    assert.deepEqual(after.data, { ...before.data, statVersion: 'campus-v1' });
    const rejected = await rpc('tiger_submit_rating', { shareId: input.shareId, deviceHash: 'f'.repeat(64), scores: Object.fromEntries(SCORE_KEYS.map(k => [k, 4])) });
    assert.equal(rejected.error, 'VALIDATION_ERROR');
    const next = await rpc('tiger_submit_rating', { shareId: input.shareId, deviceHash: 'f'.repeat(64), scores });
    assert.equal(next.data.count, 4);
    assert.deepEqual(next.data.averages, scores);
    for (const bad of [{ ...scores, grade: '4' }, { ...scores, grade: 6 }, { ...scores, intelligence: 4 }]) {
      const check = await db.query('SELECT tiger_private.valid_scores($1::jsonb) AS valid', [JSON.stringify(bad)]);
      assert.equal(check.rows[0].valid, false);
    }
  } finally { await db.close(); }
});
