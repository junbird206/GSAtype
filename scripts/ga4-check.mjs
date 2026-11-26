import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const sites = [['mytigertype', 'G-Z6042KHWDX'], ['militarytype', 'G-92RLQSND5J']];
const HOUR = 3_600_000;
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../.local-data/traffic-check-20261124');
export function browserWindowOpen(time, end, windows) {
  if (windows) return time < end && windows.some(window => time >= Date.parse(window.start) && time < Date.parse(window.end));
  const hour = new Date(time + 9 * HOUR).getUTCHours();
  return time < end && !(hour >= 3 && hour < 8);
}
export function clickPlan(count, rate, randomizedRounding = false) {
  if (!Number.isInteger(count) || count < 1 || count > 1500 || !Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error('Invalid visit/click plan');
  const expected = count * rate;
  const selected = randomizedRounding ? Math.floor(expected) + Number(randomInt(1_000_000) < (expected % 1) * 1_000_000) : Math.round(expected);
  const clicks = Array.from({ length: count }, (_, index) => index < selected);
  for (let index = count - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [clicks[index], clicks[other]] = [clicks[other], clicks[index]];
  }
  return clicks;
}
export function summarizeGa4(result) {
  if (!result?.sites) return result;
  return {
    started: result.started, finished: result.finished, stopped: result.stopped,
    sites: sites.map(([host, id]) => {
      const visits = result.sites.filter(visit => visit.host === host + '.com');
      const accepted = (visit, name) => visit.events.some(event => event.id === id && event.name === name && event.status === 204 && (name === 'page_view' || event.placement === host + '_home'));
      return { host: host + '.com', plannedVisits: result.planned?.find(item => item.host === host + '.com')?.visits,
        attemptedVisits: visits.length, acceptedPageViews: visits.filter(visit => accepted(visit, 'page_view')).length,
        acceptedPromotionViews: visits.filter(visit => accepted(visit, 'view_promotion')).length,
        plannedClicks: result.planned?.find(item => item.host === host + '.com')?.clicks,
        acceptedClicks: visits.filter(visit => accepted(visit, 'select_promotion')).length,
        errors: visits.filter(visit => visit.error).length };
    }),
  };
}

export async function checkGa4({ slot, end, outputDirectory = directory, visitCounts, clickRate = 1, concurrency = 1, targetHost, spreadMs = 0, windows, randomizedClicks = false }) {
  const active = () => browserWindowOpen(Date.now(), end, windows);
  if (!active()) return { skipped: 'Outside test hours' };
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error('Invalid browser concurrency');
  if (targetHost && !sites.some(([host]) => host + '.com' === targetHost)) throw new Error('Invalid target host');
  if (!Number.isFinite(spreadMs) || spreadMs < 0 || spreadMs > 24 * 60_000) throw new Error('Invalid pacing');
  const jobs = sites.filter(([host]) => !targetHost || host + '.com' === targetHost).flatMap(([host, id]) => {
    const count = visitCounts ? visitCounts[host + '.com'] : 1;
    return clickPlan(count, clickRate, randomizedClicks).map((click, index) => ({ host, id, click, index, count }));
  });
  if (spreadMs) jobs.sort((a, b) => a.index / Math.max(1, a.count - 1) - b.index / Math.max(1, b.count - 1));
  await mkdir(outputDirectory, { recursive: true });
  const output = resolve(outputDirectory, `ga4-hour-${String(slot).padStart(2, '0')}.json`);
  try { await writeFile(output + '.lock', String(process.pid), { flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') return { skipped: 'GA4 check already started for this hour' };
    throw error;
  }
  let playwright;
  try { playwright = require('playwright'); }
  catch { playwright = require('/Users/juny/.npm/_npx/a80a913f4f8f2557/node_modules/playwright'); }
  const result = { started: new Date().toISOString(), slot, sites: [],
    planned: sites.map(([host]) => ({ host: host + '.com', visits: jobs.filter(job => job.host === host).length, clicks: jobs.filter(job => job.host === host && job.click).length })) };
  let next = 0, consecutiveFailures = 0, stopped = false, persistence = Promise.resolve();
  const persist = () => {
    const data = JSON.stringify(result, null, 2);
    persistence = persistence.then(() => writeFile(output, data));
    return persistence;
  };
  await persist();
  const browser = await playwright.chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
  const paceStart = Date.now();
  try {
    async function worker() {
    while (!stopped && next < jobs.length) {
      if (!active()) { result.stopped = 'Quiet hours or deadline'; break; }
      const { host, id, click, index } = jobs[next++];
      const count = visitCounts ? visitCounts[host + '.com'] : 1;
      const wait = paceStart + index * spreadMs / Math.max(1, count - 1) - Date.now();
      if (wait > 0) await sleep(wait);
      if (stopped || !active()) { result.stopped ||= 'Quiet hours or deadline'; break; }
      // Fresh isolated cookies per check; no client IDs or analytics events are fabricated.
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const sample = { host: host + '.com', measurementId: id, visit: index, clickPlanned: click, events: [], error: null, status: 0, ms: 0, started: new Date().toISOString() };
      result.sites.push(sample);
      try {
        await context.route('**/*', route => {
          const url = new URL(route.request().url());
          if (stopped || !active() || url.pathname.startsWith('/api/')) return route.abort();
          if (url.hostname === 'goo.gle') return route.fulfill({ contentType: 'text/html', body: 'Link checked. No signup submitted.' });
          return route.continue();
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        page.on('response', response => {
          const url = new URL(response.url());
          if (url.hostname === host + '.com' && response.status() === 429) { stopped = true; result.stopped = 'Rate limited'; }
          if (!/(^|\.)google-analytics\.com$/.test(url.hostname) || !url.pathname.endsWith('/collect')) return;
          for (const line of (response.request().postData() || '').split('\n')) {
            const params = new URLSearchParams([...url.searchParams, ...new URLSearchParams(line)]);
            sample.events.push({ name: params.get('en'), id: params.get('tid'), status: response.status(),
              placement: params.get('ep.creative_slot'),
              promotionItems: [...params].some(([key, value]) => key.startsWith('pr') && value.includes('google_ai_student_1year')) });
          }
        });
        const waitForEvent = async name => {
          const until = Math.min(Date.now() + 30_000, end);
          while (active() && Date.now() < until) {
            const event = sample.events.find(e => e.name === name && e.id === id && e.status === 204 && (name === 'page_view' || e.placement === host + '_home'));
            if (event) return event;
            await page.waitForTimeout(300);
          }
          throw new Error('No successful GA4 response for ' + name);
        };
        const started = Date.now();
        const response = await page.goto(`https://${host}.com/`, { waitUntil: 'domcontentloaded' });
        sample.status = response?.status() || 0;
        sample.ms = Date.now() - started;
        if (sample.status < 200 || sample.status >= 400) throw new Error('Page HTTP status ' + sample.status);
        await waitForEvent('page_view');
        await page.locator('[data-promotion=home]').scrollIntoViewIfNeeded();
        await waitForEvent('view_promotion');
        if (!active()) throw new Error('Test hours ended');
        if (click) {
          await page.locator('[data-promotion=home] [data-offer-link]').click();
          await waitForEvent('select_promotion');
        }
        consecutiveFailures = 0;
      } catch (error) {
        sample.error = error.message;
        consecutiveFailures++;
        if (consecutiveFailures >= 3) { stopped = true; result.stopped = 'Three consecutive browser/GA4 failures'; }
      }
      finally { await context.close(); }
      await persist();
    }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  } finally { await browser.close(); }
  result.finished = new Date().toISOString();
  await persist();
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = JSON.parse(await readFile(resolve(directory, 'plan.json'), 'utf8'));
  const start = Date.parse(plan.start), end = Date.parse(plan.end);
  const slot = Math.floor((Date.now() - start) / HOUR);
  if (Number.isFinite(end) && slot >= 0 && slot < 96 && end > start && end <= start + 96 * HOUR) {
    const result = await checkGa4({ slot, end });
    console.log(JSON.stringify(result, null, 2));
    if (result.sites?.some(site => site.error)) process.exitCode = 1;
  } else { console.log('Outside configured test window.'); }
}
