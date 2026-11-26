import test from 'node:test';
import assert from 'node:assert/strict';
import { browserWindowOpen, clickPlan, summarizeGa4 } from '../scripts/ga4-check.mjs';

test('browser checks obey quiet hours and exclusive deadline', () => {
  const end = Date.parse('2026-11-27T21:00:00+09:00');
  for (const [time, active] of [['02:59', true], ['03:00', false], ['07:59', false], ['08:00', true], ['19:00', true]]) {
    assert.equal(browserWindowOpen(Date.parse(`2026-11-25T${time}:00+09:00`), end), active);
  }
  assert.equal(browserWindowOpen(end, end), false);
  assert.equal(browserWindowOpen(end - 1, end), true);
});
test('all visits are planned with approximately ten percent clicks', () => {
  for (let count = 20; count <= 1200; count++) {
    const plan = clickPlan(count, .1);
    assert.equal(plan.length, count);
    assert.equal(plan.filter(Boolean).length, Math.round(count * .1));
  }
  assert.throws(() => clickPlan(1501, .1));
  assert.throws(() => clickPlan(20, NaN));
});
test('GA4 summary counts accepted visits and clicks, not HTTP requests', () => {
  const result = summarizeGa4({ planned: [{host:'mytigertype.com',visits:20,clicks:2}], sites: [
    { host:'mytigertype.com', error:null, events:[{name:'page_view',id:'G-Z6042KHWDX',status:204}] },
    { host:'mytigertype.com', error:'timeout', events:[] },
  ] });
  assert.equal(result.sites[0].plannedVisits, 20);
  assert.equal(result.sites[0].attemptedVisits, 2);
  assert.equal(result.sites[0].acceptedPageViews, 1);
  assert.equal(result.sites[0].acceptedClicks, 0);
  assert.equal(result.sites[0].errors, 1);
});
test('one percent clicks stay within rounding tolerance at all configured volumes', () => {
  for (let visits = 60; visits <= 1200; visits++) {
    const clicks = clickPlan(visits, .01).filter(Boolean).length;
    assert.equal(clicks, Math.round(visits * .01));
    assert.ok(Math.abs(clicks - visits * .01) <= .5 + Number.EPSILON * visits);
  }
});
test('bounded 1500 visit validation chooses exactly fifteen clicks', () => {
  assert.equal(clickPlan(1500, .01).filter(Boolean).length, 15);
});
