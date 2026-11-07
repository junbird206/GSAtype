import test from 'node:test';
import assert from 'node:assert/strict';
import { keys, resultFor, difference, tierFor, toRating } from '../src/v2/model.js';
const all = value => Object.fromEntries(keys.map(key => [key, value]));
test('all ties produce balanced cards at different ability levels', () => {
  for (const score of [1, 3, 5]) assert.equal(resultFor(all(score)).primary, 'balanced');
  assert.equal(resultFor(all(1)).ovr, 40);
  assert.equal(resultFor(all(5)).ovr, 99);
});
test('partial ties are explicit and stable; ordering uses unrounded averages', () => {
  const tied = resultFor({ ...all(2), social: 4, teamwork: 4 });
  assert.equal(tied.primary, 'social');
  assert.deepEqual(tied.leaders, ['social', 'teamwork']);
  assert.equal(resultFor({ ...all(2), social: 4.01, teamwork: 4.02 }).primary, 'teamwork');
});
test('tier boundaries and unclamped raw data conversion', () => {
  assert.deepEqual([0, 2, 3, 4, 5, 9, 10, 30].map(n => tierFor(n).id), ['preview','preview','bronze','bronze','silver','silver','gold','gold']);
  assert.equal(toRating(3), 70);
});
test('comparison selects greatest absolute difference, including negative and equal', () => {
  assert.equal(difference(all(3), { ...all(3), social: 5 }).key, 'social');
  assert.equal(difference(all(3), { ...all(3), mental: 1 }).delta, -2);
  assert.match(difference(all(3), all(3)).text, /닮았어요/);
});
