import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { checkGa4, summarizeGa4, browserWindowOpen } from '../../scripts/ga4-check.mjs';

const QUARTER = 15 * 60_000;
export function currentSlot(plan, time) {
  if (!browserWindowOpen(time, Date.parse(plan.end), plan.windows)) return null;
  const slot = Math.floor((time - Date.parse(plan.start)) / QUARTER);
  return slot >= 0 && slot < 96 ? slot : null;
}

async function main() {
  const plan = JSON.parse(await readFile('.github/traffic/windowed-plan.json', 'utf8'));
  const directory = resolve('.local-data/windowed');
  const checkpointFile = resolve(directory, 'checkpoint.json');
  await mkdir(directory, { recursive: true });
  const mode = process.argv[2];
  if (mode === 'prepare') {
    const beforeStart = Date.parse(plan.start) - Date.now();
    if (process.env.WAIT_FOR_START === 'true' && beforeStart > 0 && beforeStart <= 60 * 60_000) {
      console.log('Cloud runner waiting for the requested start: ' + plan.start);
      await sleep(beforeStart);
    }
    let checkpoint;
    try { checkpoint = JSON.parse(await readFile(checkpointFile, 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      checkpoint = { campaign: plan.campaign, attemptedSlots: [] };
    }
    if (checkpoint.campaign !== plan.campaign || !Array.isArray(checkpoint.attemptedSlots) || checkpoint.attemptedSlots.some(slot => !Number.isInteger(slot) || slot < 0 || slot >= 96)) throw new Error('Invalid checkpoint');
    const slot = currentSlot(plan, Date.now());
    const pending = slot !== null && !checkpoint.attemptedSlots.includes(slot) ? [slot] : [];
    // Missed quarters are never replayed: catching up would spike the rolling 30-minute window.
    checkpoint.attemptedSlots = [...new Set([...checkpoint.attemptedSlots, ...pending])];
    checkpoint.updated = new Date().toISOString();
    await writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2));
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `active=${pending.length > 0}\nexpired=${Date.now() >= Date.parse(plan.end)}\nslots=${JSON.stringify(pending)}\n`);
    console.log(JSON.stringify({ pending, now: new Date().toISOString(), windows: plan.windows }));
  } else if (mode === 'run') {
    const reserved = JSON.parse(process.env.TRAFFIC_CLOUD_RESERVED || '[]');
    const slot = currentSlot(plan, Date.now());
    if (slot === null || reserved.length !== 1 || reserved[0] !== slot) {
      console.log('Outside reserved quarter; no visits sent.'); return;
    }
    const quarterEnd = Date.parse(plan.start) + (slot + 1) * QUARTER;
    const end = Math.min(quarterEnd, Date.parse(plan.end));
    if (end - Date.now() < 90_000) { console.log('Quarter ending; no visits sent.'); return; }
    const counts = Object.fromEntries(['mytigertype.com', 'militarytype.com'].map(host => [host, randomInt(25, 51)]));
    const result = await checkGa4({ slot, end, windows: plan.windows, outputDirectory: directory,
      visitCounts: counts, clickRate: .01, randomizedClicks: true, concurrency: 4,
      spreadMs: Math.min(10 * 60_000, end - Date.now() - 60_000) });
    const summary = summarizeGa4(result);
    console.log(JSON.stringify(summary, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
      `## Rolling-window browser check\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\nTransport responses are not guaranteed GA4 report counts.\n`);
    if (result.stopped || result.skipped || result.sites?.some(site => site.error)) process.exitCode = 1;
  } else { throw new Error('Expected prepare or run'); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
