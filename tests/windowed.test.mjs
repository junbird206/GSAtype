import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { currentSlot } from '../.github/traffic/windowed.mjs';
import { clickPlan, browserWindowOpen } from '../scripts/ga4-check.mjs';
const plan = JSON.parse(await readFile(new URL('../.github/traffic/windowed-plan.json', import.meta.url), 'utf8'));
test('requested evening, quiet, and morning windows have exact Korean-time boundaries', () => {
  for (const [time, active] of [
    ['2026-11-26T14:59:59',false], ['2026-11-26T15:00:00',true],
    ['2026-11-27T01:59:59',true], ['2026-11-27T02:00:00',false],
    ['2026-11-27T09:59:59',false], ['2026-11-27T10:00:00',true],
    ['2026-11-27T11:59:59',true], ['2026-11-27T12:00:00',false],
  ]) {
    const now = Date.parse(time + '+09:00');
    assert.equal(currentSlot(plan, now) !== null, active, time);
    assert.equal(browserWindowOpen(now, Date.parse(plan.end), plan.windows), active, time);
  }
});
test('two consecutive planned quarters have 50 to 100 visits per site', () => {
  assert.equal(plan.visitsPerQuarter.minimum * 2, 50);
  assert.equal(plan.visitsPerQuarter.maximum * 2, 100);
  assert.equal(plan.catchUp, false);
});
test('small cohorts use unbiased rounding rather than always rounding clicks to zero', () => {
  for (let count = 25; count <= 50; count++) {
    for (let index=0; index<20; index++) {
      const clicks = clickPlan(count,.01,true).filter(Boolean).length;
      assert.ok(clicks === 0 || clicks === 1);
    }
  }
});
