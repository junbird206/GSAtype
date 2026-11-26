import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkGa4, summarizeGa4 } from '../../scripts/ga4-check.mjs';

const host = process.env.TEST_HOST;
if (!['mytigertype.com', 'militarytype.com'].includes(host)) throw new Error('Unknown test host');
const plan = JSON.parse(await readFile('.github/traffic/plan.json', 'utf8'));
const result = await checkGa4({
  slot: `burst-${process.env.GITHUB_RUN_ID}-${host}`,
  end: Math.min(Date.parse(plan.end), Date.now() + 27 * 60_000),
  outputDirectory: resolve('.local-data/burst'),
  visitCounts: { [host]: 1500 }, targetHost: host,
  clickRate: .01, concurrency: 8, spreadMs: 24 * 60_000,
});
const summary = summarizeGa4(result);
console.log(JSON.stringify(summary, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `## ${host}: bounded 30-minute validation\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\nHTTP 204 confirms transport only; GA4 report counts may differ.\n`);
const measured = summary.sites?.find(site => site.host === host);
if (result.stopped || !measured || measured.acceptedPageViews !== 1500 || measured.acceptedPromotionViews !== 1500 || measured.acceptedClicks !== 15 || measured.errors) process.exitCode = 1;
