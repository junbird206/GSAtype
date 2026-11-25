import { randomInt } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { checkGa4, summarizeGa4 } from './ga4-check.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(root, '.local-data/traffic-check-20261124');
const configPath = resolve(directory, 'plan.json');
export const HOSTS = ['https://mytigertype.com', 'https://militarytype.com'];
export const HOUR = 3_600_000;
export function slotAt(start, now) {
  const slot = Math.floor((now - start) / HOUR);
  return slot >= 0 && slot < 96 ? slot : null;
}
export function requestCount() { return randomInt(20, 201); }
export function hourlyMultiplier(time) {
  const hour = new Date(time + 9 * HOUR).getUTCHours();
  if (hour >= 3 && hour < 8) return 0;
  return hour >= 19 || hour < 1 ? 2 : 1;
}
export function pendingSlots({ start, end, now, catchUpFrom, attempted = new Set() }) {
  const current = slotAt(start, now);
  if (current === null || now >= end || hourlyMultiplier(now) === 0) return [];
  const first = Number.isFinite(catchUpFrom) ? Math.max(0, Math.ceil((catchUpFrom - start) / HOUR)) : current;
  const pending = [];
  for (let slot = Math.min(first, current); slot <= current; slot++) {
    const multiplier = hourlyMultiplier(slot === current ? now : start + slot * HOUR);
    if (multiplier && !attempted.has(slot)) pending.push({ slot, multiplier });
  }
  return pending;
}
export function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

export async function sampleHost(host, count, end, options = {}) {
  if (!HOSTS.includes(host) || !Number.isInteger(count) || count < 20 || count > 400) {
    throw new Error('Invalid test target or request count');
  }
  const { fetcher = fetch, duration = 120_000, pause = sleep, now = Date.now, record = async () => {}, enforceSchedule = false } = options;
  const started = now();
  const requests = [];
  let failures = 0;
  let stopped = null;
  for (let i = 0; i < count; i++) {
    const delay = started + i * duration / (count - 1) - now();
    if (delay > 0) await pause(delay);
    if (now() >= end) { stopped = 'Test deadline'; break; }
    if (enforceSchedule && hourlyMultiplier(now()) === 0) { stopped = 'Quiet hours'; break; }
    const url = `${host}${i % 2 ? '/new' : '/'}`;
    const begin = now();
    let status = 0;
    let error = null;
    try {
      const response = await fetcher(url, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10_000),
        headers: { 'User-Agent': 'OwnedSiteAvailabilityTest/1.0', 'X-Synthetic-Test': 'availability-72h' },
      });
      status = response.status;
      await response.arrayBuffer();
    } catch (caught) {
      error = caught.cause?.code || caught.code || caught.name || 'NetworkError';
    }
    const ms = now() - begin;
    const item = { at: new Date(begin).toISOString(), url, status, ms, ...(error ? { error } : {}) };
    requests.push(item);
    await record(item);
    failures = status === 0 || status >= 400 || ms >= 5000 ? failures + 1 : 0;
    if (status === 429 || failures >= 3) {
      stopped = status === 429 ? 'Rate limited' : 'Three consecutive failed or slow requests';
      break;
    }
  }
  return {
    host, planned: count, sent: requests.length, stopped,
    errors: requests.filter(r => r.status < 200 || r.status >= 400).length,
    p50Ms: percentile(requests.map(r => r.ms), .5),
    p95Ms: percentile(requests.map(r => r.ms), .95), requests,
  };
}

async function main() {
  await mkdir(directory, { recursive: true });
  if (process.argv.includes('--init')) {
    const start = Date.now();
    const plan = {
      start: new Date(start).toISOString(), end: new Date(start + 72 * HOUR).toISOString(),
      hosts: HOSTS, minimumPerHostPerHour: 20, maximumPerHostPerHour: 200, sampleDurationSeconds: 120,
    };
    await writeFile(configPath, JSON.stringify(plan, null, 2), { flag: 'wx' });
    console.log(JSON.stringify(plan));
    return;
  }
  const plan = JSON.parse(await readFile(configPath, 'utf8'));
  const start = Date.parse(plan.start);
  const end = Date.parse(plan.end);
  if (![1, 3].includes(plan.trafficMultiplier ?? 1)) throw new Error('Invalid traffic multiplier');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > start + 96 * HOUR) throw new Error('Invalid deadline');
  if (Date.now() >= end) { console.log('Test deadline reached; no requests sent.'); return; }
  const attempted = new Set((await readdir(directory)).flatMap(name => {
    const match = /^hour-(\d+)\.json(?:\.lock)?$/.exec(name);
    return match ? [Number(match[1])] : [];
  }));
  const pending = pendingSlots({ start, end, now: Date.now(), catchUpFrom: Date.parse(plan.catchUpFrom), attempted });
  if (!pending.length) { console.log('No pending active slots; no requests sent.'); return; }
  console.log(JSON.stringify({ pendingSlots: pending.map(item => item.slot) }));
  // A single wake-up drains missed slots in order, keeping normal per-slot pacing.
  for (const { slot, multiplier } of pending) {
    if (Date.now() >= end || hourlyMultiplier(Date.now()) === 0) break;
    await runSlot({ slot, multiplier, end, plan, scheduledFor: new Date(start + slot * HOUR).toISOString() });
    if (process.exitCode) break;
  }
}

async function runSlot({ slot, multiplier, end, scheduledFor, plan }) {
  const output = resolve(directory, `hour-${String(slot).padStart(2, '0')}.json`);
  try { await writeFile(`${output}.lock`, String(process.pid), { flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') { console.log('This hour was already started; no duplicate requests sent.'); return; }
    throw error;
  }
  const result = { slot, multiplier, trafficMultiplier: plan.trafficMultiplier ?? 1, scheduledFor, started: new Date().toISOString(), samples: HOSTS.map(host => ({ host, planned: requestCount() * multiplier * (plan.trafficMultiplier ?? 1), requests: [] })) };
  const persist = () => writeFile(output, JSON.stringify(result, null, 2));
  await persist();
  if (plan.browserTraffic) {
    try {
      result.ga4 = await checkGa4({ slot, end,
        visitCounts: Object.fromEntries(result.samples.map(sample => [new URL(sample.host).hostname, sample.planned])),
        clickRate: plan.promotionClickRate, concurrency: plan.browserConcurrency });
      for (const sample of result.samples) {
        const visits = result.ga4.sites?.filter(visit => 'https://' + visit.host === sample.host) || [];
        sample.sent = visits.length;
        sample.errors = visits.filter(visit => visit.status < 200 || visit.status >= 400).length;
        sample.p50Ms = percentile(visits.map(visit => visit.ms), .5);
        sample.p95Ms = percentile(visits.map(visit => visit.ms), .95);
        sample.stopped = result.ga4.stopped || null;
      }
    } catch (error) { result.ga4 = { error: error.message }; }
    result.finished = new Date().toISOString();
    await persist();
    console.log(JSON.stringify({ ...result, ga4: summarizeGa4(result.ga4) }, null, 2));
    if (result.ga4.error || result.ga4.stopped || result.ga4.sites?.some(site => site.error)) process.exitCode = 1;
    return;
  }
  // Sequential hosts keep a single request in flight; each host gets its own paced sample.
  for (let index = 0; index < HOSTS.length; index++) {
    const sample = result.samples[index];
    result.samples[index] = await sampleHost(sample.host, sample.planned, end, {
      enforceSchedule: true,
      record: async item => { sample.requests.push(item); await persist(); },
    });
    await persist();
  }
  try { result.ga4 = await checkGa4({ slot, end }); }
  catch (error) { result.ga4 = { error: error.message }; }
  result.finished = new Date().toISOString();
  await persist();
  console.log(JSON.stringify({ ...result, samples: result.samples.map(({ requests, ...summary }) => summary) }, null, 2));
  if (result.samples.some(s => s.errors || (s.stopped && !['Quiet hours', 'Test deadline'].includes(s.stopped)))) process.exitCode = 1;
  if (result.ga4.error || result.ga4.sites?.some(site => site.error)) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
