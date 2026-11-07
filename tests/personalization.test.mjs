import test from 'node:test';
import assert from 'node:assert/strict';
import { personalCard, personalCardPath } from '../src/v2/personalization.js';
import { theme } from '../config/tiger.js';

const all = value => Object.fromEntries(theme.stats.map(s => [s.key, value]));
const card = { id: 'demo', nickname: '테스터', count: 3, selfScores: all(1), averages: { ...all(4), teamwork: 5 } };

test('personalized prompts match the selected card and its six scores', () => {
  for (const view of ['self', 'friends']) {
    const selected = personalCard(card, view);
    assert.equal(selected.perspective, view);
    assert.equal(selected.count, view === 'self' ? 0 : 3);
    assert.match(selected.prompt, new RegExp(`OVR: ${selected.result.ovr}`));
    assert.ok(selected.prompt.includes(selected.result.type.name));
    for (const stat of theme.stats) assert.ok(selected.prompt.includes(`${stat.name} ${selected.result.numbers[stat.key]}`));
    assert.match(selected.prompt, /첫 번째 이미지 = 수정할 원본 카드/);
    assert.match(selected.prompt, /두 번째 이미지 = 카드에 넣을 내 상반신 사진/);
    assert.match(selected.prompt, /상반신/);
    assert.match(selected.prompt, /QR코드와 링크/);
    assert.match(selected.prompt, /편집한 이미지 한 장만/);
  }
  assert.notEqual(personalCard(card, 'self').prompt, personalCard(card, 'friends').prompt);
});

test('locked or unavailable friends result falls back to the self card', () => {
  for (const extra of [{ count: 2 }, { averages: null }]) {
    const selected = personalCard({ ...card, ...extra }, 'friends');
    assert.equal(selected.perspective, 'self');
    assert.equal(selected.result.ovr, 40);
    assert.equal(selected.result.tier.id, 'preview');
  }
});

test('personalization links retain perspective and explicit sample mode only', () => {
  assert.equal(personalCardPath(card, 'self'), '/c/demo/face?view=self');
  assert.equal(personalCardPath({ ...card, preview: true }, 'friends'), '/c/demo/face?view=friends&preview=friends');
  assert.equal(personalCardPath({ ...card, count: 0 }, 'friends'), '/c/demo/face?view=self');
});
