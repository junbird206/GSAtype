import { readFile, writeFile, readdir, mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pendingSlots, hourlyMultiplier } from '../../scripts/traffic-check.mjs';
import { checkGa4, summarizeGa4 } from '../../scripts/ga4-check.mjs';

const directory = resolve('.local-data/traffic-check-20261124');
const checkpointDirectory = resolve('.local-data/cloud-checkpoint');
const checkpointPath = resolve(checkpointDirectory, 'checkpoint.json');
const plan = JSON.parse(await readFile('.github/traffic/plan.json', 'utf8'));
const start = Date.parse(plan.start), end = Date.parse(plan.end);
const mode = process.argv[2];
await mkdir(directory, { recursive: true });
await mkdir(checkpointDirectory, { recursive: true });

if (mode === 'prepare') {
  let checkpoint, bootstrap = false;
  try { checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    checkpoint = JSON.parse(await readFile('.github/traffic/seed.json', 'utf8'));
    bootstrap = true;
  }
  if (checkpoint.campaign !== plan.start || !Array.isArray(checkpoint.attemptedSlots)) throw new Error('Checkpoint campaign mismatch');
  await writeFile(resolve(directory, 'plan.json'), JSON.stringify(plan, null, 2));
  for (const slot of checkpoint.attemptedSlots) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 96) throw new Error('Invalid checkpoint slot');
    await writeFile(resolve(directory, `hour-${String(slot).padStart(2, '0')}.json.lock`), 'Previously attempted; never replay.');
  }
  const active = Date.now() >= start && Date.now() < end && hourlyMultiplier(Date.now()) !== 0;
  const pending = pendingSlots({ start, end, now: Date.now(), catchUpFrom: start, attempted: new Set(checkpoint.attemptedSlots) });
  // Persist reservations remotely before visits start, so an interrupted job cannot replay them.
  checkpoint.attemptedSlots = [...new Set([...checkpoint.attemptedSlots, ...pending.map(item => item.slot)])].sort((a, b) => a - b);
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  const probe = active && bootstrap && pending.length === 0;
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `active=${active}\nprobe=${probe}\nexpired=${Date.now() >= end}\n`);
  console.log(JSON.stringify({ active, probe, pending, bootstrap, end: plan.end }));
} else if (mode === 'probe') {
  const result = await checkGa4({ slot: 'migration-' + process.env.GITHUB_RUN_ID, end,
    visitCounts: { 'mytigertype.com': 20, 'militarytype.com': 20 }, clickRate: .1, concurrency: 4 });
  console.log(JSON.stringify(summarizeGa4(result), null, 2));
  if (result.skipped || result.stopped || result.sites?.some(site => site.error)) process.exitCode = 1;
} else if (mode === 'export') {
  const checkpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
  const slots = (await readdir(directory)).flatMap(name => {
    const match = /^hour-(\d+)\.json(?:\.lock)?$/.exec(name);
    return match ? [Number(match[1])] : [];
  });
  checkpoint.attemptedSlots = [...new Set([...checkpoint.attemptedSlots, ...slots])].sort((a,b) => a-b);
  checkpoint.updated = new Date().toISOString();
  await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summaries = [];
    for (const name of await readdir(directory)) {
      if (!/^ga4-hour-.*\.json$/.test(name)) continue;
      summaries.push(summarizeGa4(JSON.parse(await readFile(resolve(directory, name), 'utf8'))));
    }
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Browser / GA4 Results\n\nEnds: ${plan.end}\n\n\`\`\`json\n${JSON.stringify(summaries, null, 2)}\n\`\`\`\n`);
  }
} else { throw new Error('Expected prepare, probe, or export'); }
