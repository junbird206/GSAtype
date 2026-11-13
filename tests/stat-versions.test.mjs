import test from 'node:test';
import assert from 'node:assert/strict';
import { theme, legacyTheme, themeForCard, themeForScores } from '../config/tiger.js';
import { SCORE_KEYS, LEGACY_SCORE_KEYS, scoreVersion } from '../config/stats.js';
import { resultFor, difference, radarPoints } from '../src/v2/model.js';
import { personalCard } from '../src/v2/personalization.js';
import { withSampleFriends } from '../src/v2/friends-preview.js';

test('new cards use the six confirmed stats in order with matching types and prompts', () => {
  assert.deepEqual(theme.stats.map(s => s.name), ['지능', '체력', '인성', '재력', '매력', '병맛력']);
  assert.deepEqual(theme.stats.map(s => s.key), SCORE_KEYS);
  for (const key of SCORE_KEYS) {
    const scores = Object.fromEntries(SCORE_KEYS.map(k => [k, k === key ? 5 : 2]));
    const result = resultFor(scores);
    assert.equal(result.primary, key);
    assert.equal(result.type, theme.types[key]);
    assert.equal(Object.values(result.numbers).every(Number.isFinite), true);
    const card = { id: key, nickname: '테스트', selfScores: scores, count: 0 };
    const { prompt } = personalCard(card, 'self');
    for (const stat of theme.stats) assert.ok(prompt.includes(`${stat.name} ${result.numbers[stat.key]}`));
    assert.ok(!prompt.includes('학구력'));
    assert.equal(radarPoints(scores).split(' ').length, 6);
    assert.equal(themeForCard(withSampleFriends(card)), theme);
  }
});

test('legacy cards, empty public cards, previews and face prompts retain legacy labels', () => {
  const scores = Object.fromEntries(LEGACY_SCORE_KEYS.map(k => [k, k === 'teamwork' ? 5 : 2]));
  const card = { id: 'old-card', nickname: '기존카드', selfScores: scores, count: 0 };
  assert.equal(themeForScores(scores), legacyTheme);
  assert.equal(themeForCard(card), legacyTheme);
  assert.equal(themeForCard({ statVersion: 'campus-v1', averages: null }), legacyTheme);
  assert.equal(themeForCard({ statVersion: 'friends-v2', averages: null }), theme);
  assert.equal(themeForCard({ averages: null }), legacyTheme);
  assert.equal(resultFor(scores).type.name, '팀플 캐리형');
  assert.equal(difference(scores, { ...scores, grade: 5 }).name, '학구력');
  assert.ok(personalCard(card).prompt.includes('과제력 99'));
  assert.ok(!personalCard(card).prompt.includes('재력'));
  assert.equal(scoreVersion(withSampleFriends(card).averages), 'campus-v1');
  assert.equal(scoreVersion({ ...scores, grade: undefined, intelligence: 3 }), null);
});
