import test from 'node:test';
import assert from 'node:assert/strict';
import { HOSTS, HOUR, slotAt, requestCount, percentile, sampleHost, hourlyMultiplier, pendingSlots } from '../scripts/traffic-check.mjs';

test('hourly window supports the extension but remains bounded to 96 slots', () => {
  assert.equal(slotAt(100, 99), null);
  assert.equal(slotAt(100, 100), 0);
  assert.equal(slotAt(100, 100 + 72 * HOUR - 1), 71);
  assert.equal(slotAt(100, 100 + 72 * HOUR), 72);
  assert.equal(slotAt(100, 100 + 96 * HOUR), null);
});
test('counts stay in requested range and percentiles are stable', () => {
  for (let i = 0; i < 1000; i++) {
    const count = requestCount();
    assert.ok(count >= 20 && count <= 200);
  }
  assert.equal(percentile([5, 1, 3], .5), 3);
  assert.equal(percentile([], .95), null);
});
test('Korean-time peak and quiet boundaries apply exactly', () => {
  for (const [time, expected] of [
    ['00:00', 2], ['00:59', 2], ['01:00', 1], ['02:59', 1],
    ['03:00', 0], ['07:59', 0], ['08:00', 1], ['18:59', 1], ['19:00', 2], ['23:59', 2],
  ]) assert.equal(hourlyMultiplier(Date.parse(`2026-11-25T${time}:00+09:00`)), expected, time);
});
test('peak requests allow 400 and quiet hours issue no requests', async () => {
  const peak = await sampleHost(HOSTS[0], 400, Infinity, {
    duration: 0, fetcher: async () => new Response('ok'),
  });
  assert.equal(peak.sent, 400);
  let calls = 0;
  const quiet = await sampleHost(HOSTS[0], 20, Infinity, {
    duration: 0, enforceSchedule: true, now: () => Date.parse('2026-11-25T03:00:00+09:00'),
    fetcher: async () => { calls++; return new Response('ok'); },
  });
  assert.equal(calls, 0);
  assert.equal(quiet.stopped, 'Quiet hours');
});
test('only safe read-only paths are requested', async () => {
  const urls = [];
  const result = await sampleHost(HOSTS[0], 20, Infinity, {
    duration: 0, fetcher: async (url, options) => {
      urls.push(url); assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual'); return new Response('ok');
    },
  });
  assert.equal(result.sent, 20);
  assert.equal(result.errors, 0);
  assert.deepEqual([...new Set(urls)], [HOSTS[0] + '/', HOSTS[0] + '/new']);
});
test('stops on rate limits, repeated errors, and deadline', async () => {
  for (const [status, expected] of [[429, 1], [503, 3], [404, 3]]) {
    const result = await sampleHost(HOSTS[1], 200, Infinity, {
      duration: 0, fetcher: async () => new Response('', { status }),
    });
    assert.equal(result.sent, expected); assert.ok(result.stopped);
  }
  const result = await sampleHost(HOSTS[0], 20, 0, { duration: 0 });
  assert.equal(result.sent, 0);
  await assert.rejects(sampleHost('https://example.com', 20, Infinity));
});
test('network errors preserve their cause for diagnosis', async () => {
  const result = await sampleHost(HOSTS[0], 20, Infinity, {
    duration: 0,
    fetcher: async () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }); },
  });
  assert.equal(result.sent, 3);
  assert.ok(result.requests.every(request => request.error === 'ENOTFOUND'));
});
test('catch-up drains only unattempted future-policy slots and skips quiet hours', () => {
  const start = Date.parse('2026-11-24T13:00:00+09:00');
  const end = Date.parse('2026-11-27T00:00:00+09:00');
  const catchUpFrom = Date.parse('2026-11-24T20:30:00+09:00');
  const now = Date.parse('2026-11-25T09:00:00+09:00');
  const attempted = new Set([8, 9]);
  const pending = pendingSlots({ start, end, catchUpFrom, now, attempted });
  assert.deepEqual(pending.map(item => item.slot), [10, 11, 12, 13, 19, 20]);
  assert.deepEqual(pending.map(item => item.multiplier), [2, 2, 1, 1, 1, 1]);
  assert.deepEqual(pendingSlots({ start, end, catchUpFrom, now: Date.parse('2026-11-25T05:00:00+09:00') }), []);
  assert.deepEqual(pendingSlots({ start, end, catchUpFrom, now: end }), []);
});
test('without catch-up policy only the current slot is selected', () => {
  const start = Date.parse('2026-11-24T13:00:00+09:00');
  assert.deepEqual(pendingSlots({ start, end: start + 72 * HOUR, now: start + 2 * HOUR }), [{ slot: 2, multiplier: 1 }]);
});
