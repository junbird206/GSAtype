import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createLocalApi } from '../server/local.mjs';
import { SCORE_KEYS } from '../server/validation.mjs';

const scores = (n) => Object.fromEntries(SCORE_KEYS.map((key) => [key, n]));
const ownerDevice = 'owner-device-123456789';
const createBody = (extra = {}) => ({ nickname: '\ud638\ub791\uc774', selfScores: scores(1), deviceId: ownerDevice, channel: 'kakao', ...extra });

async function fixture(t, options = {}) {
  options = { clock: () => Date.parse('2026-11-04T00:00:00Z'), ...options };
  const directory = await mkdtemp(join(tmpdir(), 'tiger-api-'));
  const dataPath = join(directory, 'cards.sqlite');
  const clients = [];
  const connect = async () => {
    const client = await createLocalApi({ dataPath, ...options });
    clients.push(client);
    return client.handleApi;
  };
  t.after(async () => {
    for (const client of clients) client.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { handleApi: await connect(), connect, dataPath };
}

async function call(handleApi, path, { method = 'GET', body, key, ip = '192.0.2.1', headers = {} } = {}) {
  const response = await handleApi(new Request(`https://tiger.test${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(key ? { Authorization: `Bearer ${key}` } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }), { clientIp: ip });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}

async function create(handleApi, extra, ip) {
  const result = await call(handleApi, '/api/cards', { method: 'POST', body: createBody(extra), ip });
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.deepEqual(Object.keys(result.body).sort(), ['id', 'ownerKey', 'shareId']);
  return result.body;
}

function assertPublic(body, count) {
  assert.deepEqual(Object.keys(body).sort(), ['averages', 'count', 'createdAt', 'nickname', 'shareId', 'unlocked']);
  assert.equal(body.count, count);
  assert.equal(body.unlocked, count >= 3);
  assert.ok(!Number.isNaN(Date.parse(body.createdAt)));
  if (count < 3) assert.equal(body.averages, null);
}

test('multiple clients share persisted data; three raters unlock averages without self scores', async (t) => {
  const { handleApi, connect } = await fixture(t);
  const card = await create(handleApi);
  const other = await connect();
  const url = `/api/public/${card.shareId}`;
  const before = await call(other, url);
  assert.equal(before.status, 200);
  assertPublic(before.body, 0);
  assert.equal(before.headers.get('cache-control'), 'no-store');
  for (let n = 1; n <= 3; n++) {
    const rating = await call(other, `${url}/ratings`, { method: 'POST', body: { scores: scores(n + 2), deviceId: randomUUID() } });
    assert.equal(rating.status, 201);
    assertPublic(rating.body, n);
    const owner = await call(handleApi, `/api/cards/${card.id}`, { key: card.ownerKey });
    assert.equal(owner.status, 200);
    assert.deepEqual(owner.body.selfScores, scores(1));
    assert.equal(owner.body.count, n);
    assert.equal(owner.body.id, card.id);
    assert.deepEqual(owner.body.averages, n < 3 ? null : scores(4));
  }
  const reopened = await connect();
  assert.deepEqual((await call(reopened, url)).body.averages, scores(4));
  assert.equal((await call(reopened, `/api/cards/${card.id}`, { key: card.ownerKey })).status, 200);
});

test('closing and reopening SQLite preserves owner authentication and duplicate prevention', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'tiger-restart-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const dataPath = join(directory, 'cards.sqlite');
  let client = await createLocalApi({ dataPath });
  const card = await create(client.handleApi);
  const path = `/api/public/${card.shareId}/ratings`;
  const body = { scores: scores(4), deviceId: 'persistent-rater-123456789' };
  assert.equal((await call(client.handleApi, path, { method: 'POST', body })).status, 201);
  client.close();
  client = await createLocalApi({ dataPath });
  t.after(client.close);
  assert.equal((await call(client.handleApi, `/api/cards/${card.id}`, { key: card.ownerKey })).status, 200);
  assert.equal((await call(client.handleApi, path, { method: 'POST', body })).status, 409);
  assert.equal((await call(client.handleApi, path, { method: 'POST', body: { ...body, deviceId: ownerDevice } })).status, 403);
});

test('owner, duplicate and cap rules are atomic under parallel multi-client requests', async (t) => {
  const { handleApi, connect } = await fixture(t, { rateLimits: { rating: 300 } });
  const second = await connect();
  const card = await create(handleApi);
  const path = `/api/public/${card.shareId}/ratings`;
  const rate = (handler, deviceId) => call(handler, path, { method: 'POST', body: { deviceId, scores: scores(5) } });
  const own = await rate(second, ownerDevice);
  assert.equal(own.status, 403);
  assert.equal(own.body.error.code, 'OWNER_CANNOT_RATE');
  const duplicate = await Promise.all(Array.from({ length: 12 }, (_, i) => rate(i % 2 ? second : handleApi, 'same-device-123456789')));
  assert.equal(duplicate.filter((r) => r.status === 201).length, 1);
  assert.equal(duplicate.filter((r) => r.status === 409 && r.body.error.code === 'ALREADY_RATED').length, 11);
  const submissions = await Promise.all(Array.from({ length: 50 }, (_, i) => rate(i % 2 ? second : handleApi, randomUUID())));
  assert.equal(submissions.filter((r) => r.status === 201).length, 29);
  assert.equal(submissions.filter((r) => r.status === 409 && r.body.error.code === 'RATING_LIMIT').length, 21);
  const result = await call(second, `/api/public/${card.shareId}`);
  assertPublic(result.body, 30);
  assert.deepEqual(result.body.averages, scores(5));
  assert.equal((await rate(second, 'same-device-123456789')).body.error.code, 'ALREADY_RATED');
});

test('owner bearer auth never accepts share IDs, query keys or another card key; deletion cascades', async (t) => {
  const { handleApi, dataPath } = await fixture(t);
  const card = await create(handleApi);
  const other = await create(handleApi, { deviceId: randomUUID() });
  const ownerUrl = `/api/cards/${card.id}`;
  for (const options of [{}, { key: card.shareId }, { key: other.ownerKey }, { key: 'a'.repeat(43) }]) {
    assert.equal((await call(handleApi, ownerUrl, options)).status, 401);
    assert.equal((await call(handleApi, ownerUrl, { ...options, method: 'DELETE' })).status, 401);
  }
  assert.equal((await call(handleApi, `${ownerUrl}?k=${card.ownerKey}`)).status, 401);
  assert.equal((await call(handleApi, `/api/cards/${card.shareId}`, { key: card.ownerKey })).status, 404);
  assert.equal((await call(handleApi, `/api/public/${card.id}`)).status, 404);
  await call(handleApi, `/api/public/${card.shareId}/ratings`, { method: 'POST', body: { scores: scores(5), deviceId: randomUUID() } });
  const deleted = await call(handleApi, ownerUrl, { method: 'DELETE', key: card.ownerKey });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, null);
  assert.equal((await call(handleApi, `/api/public/${card.shareId}`)).status, 404);
  assert.equal((await call(handleApi, ownerUrl, { key: card.ownerKey })).status, 404);
  const db = new DatabaseSync(dataPath);
  assert.equal(db.prepare('SELECT count(*) AS n FROM ratings').get().n, 0);
  db.close();
});

test('nickname, exact score keys, integer ranges, device and channel validation', async (t) => {
  const { handleApi } = await fixture(t, { rateLimits: { create: 300 } });
  const invalidBodies = [
    null, [], {}, createBody({ nickname: 'a' }), createBody({ nickname: 'abcdefghijk' }),
    createBody({ nickname: 's.h.i.t' }), createBody({ nickname: '\uc2dc\ubc1c' }),
    createBody({ nickname: 'ab\u200bcd' }), createBody({ nickname: 'ab\ncd' }),
    createBody({ deviceId: 'short' }), createBody({ deviceId: 'a'.repeat(257) }),
    createBody({ deviceId: 'a '.repeat(16) }), createBody({ deviceId: 1234567890123456 }),
    createBody({ selfScores: scores(0) }), createBody({ selfScores: scores(6) }),
    createBody({ selfScores: scores(1.5) }), createBody({ selfScores: scores('3') }),
    createBody({ selfScores: scores(true) }), createBody({ selfScores: null }),
    createBody({ selfScores: { ...scores(3), extra: 2 } }), createBody({ selfScores: { grade: 3 } }),
    createBody({ channel: 'bad channel' }), createBody({ channel: {} }), createBody({ unexpected: true }),
  ];
  for (const body of invalidBodies) {
    const result = await call(handleApi, '/api/cards', { method: 'POST', body });
    assert.equal(result.status, 400, JSON.stringify(body));
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
  }
  const card = await create(handleApi, { nickname: '\ud83d\udc2f\ud83d\udc2f', deviceId: randomUUID() });
  assert.equal((await call(handleApi, `/api/public/${card.shareId}`)).body.nickname, '\ud83d\udc2f\ud83d\udc2f');
  await create(handleApi, { nickname: '\u1100\u1161\ub098', deviceId: 'a'.repeat(16) });
  const ratingUrl = `/api/public/${card.shareId}/ratings`;
  for (const bad of [scores(0), scores(5.1), scores('3'), { ...scores(3), x: 1 }, { grade: 3 }, null]) {
    assert.equal((await call(handleApi, ratingUrl, { method: 'POST', body: { scores: bad, deviceId: randomUUID() } })).status, 400);
  }
  assert.equal((await call(handleApi, ratingUrl, { method: 'POST', body: { scores: scores(3), deviceId: randomUUID() } })).status, 201);
});

test('strict JSON/body size/method handling and errors do not expose internals', async (t) => {
  const { handleApi } = await fixture(t);
  assert.equal((await call(handleApi, '/api/cards')).status, 405);
  assert.equal((await call(handleApi, '/api/cards')).headers.get('allow'), 'POST');
  assert.equal((await call(handleApi, '/api/missing')).status, 404);
  const request = (body, headers = {}) => new Request('https://tiger.test/api/cards', { method: 'POST', body, headers });
  assert.equal((await handleApi(request('{}'))).status, 415);
  assert.equal((await handleApi(request('{broken', { 'content-type': 'application/json' }))).status, 400);
  assert.equal((await handleApi(request('x'.repeat(17_000), { 'content-type': 'application/json' }))).status, 413);
});

test('persistent IP limits are atomic, expire, and ignore forged forwarding headers', async (t) => {
  let now = Date.parse('2026-11-03T00:00:00Z');
  const { handleApi, connect, dataPath } = await fixture(t, { clock: () => now, rateLimits: { create: 2, rating: 3 } });
  const other = await connect();
  const card = await create(handleApi);
  await create(other);
  const blocked = await call(handleApi, '/api/cards', { method: 'POST', body: createBody(), headers: { 'x-forwarded-for': '198.51.100.9' } });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '60');
  const path = `/api/public/${card.shareId}/ratings`;
  const concurrent = await Promise.all(Array.from({ length: 10 }, (_, i) => call(i % 2 ? other : handleApi, path, {
    method: 'POST', body: { deviceId: randomUUID(), scores: scores(4) }, headers: { 'x-forwarded-for': `198.51.100.${i}` },
  })));
  assert.equal(concurrent.filter((r) => r.status === 201).length, 3);
  assert.equal(concurrent.filter((r) => r.status === 429).length, 7);
  assert.equal((await call(handleApi, path, { method: 'POST', body: { deviceId: randomUUID(), scores: scores(4) }, ip: '192.0.2.2' })).status, 201);
  now += 60_000;
  assert.equal((await call(other, path, { method: 'POST', body: { deviceId: randomUUID(), scores: scores(4) } })).status, 201);
  const db = new DatabaseSync(dataPath);
  const rows = db.prepare('SELECT * FROM rate_limits').all();
  assert.equal(rows.length, 1);
  assert.match(rows[0].key, /^[0-9a-f]{64}$/);
  assert.equal(rows[0].expires_at, now + 60_000);
  db.close();
});

test('stored data contains only hashed device IDs/owner keys and no raw IP addresses', async (t) => {
  const { handleApi, dataPath } = await fixture(t);
  const card = await create(handleApi);
  const deviceId = 'private-rater-device-123456789';
  await call(handleApi, `/api/public/${card.shareId}/ratings`, { method: 'POST', body: { scores: scores(3), deviceId }, ip: '198.51.100.123' });
  const db = new DatabaseSync(dataPath);
  const saved = JSON.stringify({
    cards: db.prepare('SELECT * FROM cards').all(), ratings: db.prepare('SELECT * FROM ratings').all(),
    rates: db.prepare('SELECT * FROM rate_limits').all(),
  });
  for (const secret of [ownerDevice, deviceId, card.ownerKey, '198.51.100.123', '192.0.2.1']) assert.equal(saved.includes(secret), false);
  const row = db.prepare('SELECT * FROM cards').get();
  assert.match(row.owner_key_hash, /^[0-9a-f]{64}$/);
  assert.match(row.owner_device_hash, /^[0-9a-f]{64}$/);
  db.close();
  const bytes = await readFile(dataPath);
  assert.equal(bytes.subarray(0, 15).toString(), 'SQLite format 3');
});

test('retention deadline deletes cards and ratings and closes the campaign', async (t) => {
  let now = Date.parse('2027-01-31T14:59:59Z');
  const { handleApi, dataPath } = await fixture(t, { clock: () => now });
  const card = await create(handleApi);
  await call(handleApi, `/api/public/${card.shareId}/ratings`, { method: 'POST', body: { scores: scores(3), deviceId: randomUUID() } });
  now += 1000;
  const response = await call(handleApi, `/api/public/${card.shareId}`);
  assert.equal(response.status, 410);
  assert.equal(response.body.error.code, 'CAMPAIGN_ENDED');
  const db = new DatabaseSync(dataPath);
  for (const table of ['cards', 'ratings', 'rate_limits']) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  db.close();
});
