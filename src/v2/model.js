import { theme } from '../../config/tiger.js';

export const keys = theme.stats.map(stat => stat.key);
export const toRating = value => Math.round(40 + (value - 1) / 4 * 59);
export function resultFor(scores, count = 0) {
  const ranked = keys.map(key => ({ key, value: scores[key] })).sort((a, b) => b.value - a.value || keys.indexOf(a.key) - keys.indexOf(b.key));
  const leaders = ranked.filter(stat => Math.abs(stat.value - ranked[0].value) < 0.000001);
  const balanced = leaders.length === keys.length;
  const primary = balanced ? 'balanced' : ranked[0].key;
  const secondary = balanced ? null : ranked[1].key;
  return {
    type: theme.types[primary], primary, secondary: secondary ? theme.types[secondary] : null,
    leaders: leaders.map(s => s.key), balanced,
    ovr: toRating(keys.reduce((sum, key) => sum + scores[key], 0) / keys.length),
    numbers: Object.fromEntries(keys.map(key => [key, toRating(scores[key])])),
    tier: tierFor(count),
  };
}
export function tierFor(count) {
  if (count >= 10) return { id: 'gold', name: '골드', next: null };
  if (count >= 5) return { id: 'silver', name: '실버', next: 10 };
  if (count >= 3) return { id: 'bronze', name: '브론즈', next: 5 };
  return { id: 'preview', name: '예상 카드', next: 3 };
}
export function difference(self, friends) {
  const ordered = theme.stats.map(stat => ({ ...stat, delta: friends[stat.key] - self[stat.key] })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const biggest = ordered[0];
  if (Math.abs(biggest.delta) < 0.05) return { ...biggest, text: '내가 아는 나와 친구들이 아는 나, 생각보다 닮았어요.' };
  return { ...biggest, text: biggest.delta > 0
    ? `친구들은 내 ${biggest.name}을 ${Math.abs(biggest.delta).toFixed(1)}점 더 높게 봤어요.`
    : `내가 느끼는 ${biggest.name}, 친구들에게는 아직 다 보이지 않았나 봐요.` };
}
export function radarPoints(scores, radius = 78, center = 100) {
  return keys.map((key, index) => {
    const angle = index * Math.PI / 3 - Math.PI / 2;
    const length = radius * scores[key] / 5;
    return `${center + Math.cos(angle) * length},${center + Math.sin(angle) * length}`;
  }).join(' ');
}
