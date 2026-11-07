import { keys } from './model.js';

export function withSampleFriends(card) {
  // Seeded samples stay the same when switching tabs or refreshing this preview.
  let seed = 2166136261;
  for (const char of card.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const ratings = Array.from({ length: 3 }, () => Object.fromEntries(keys.map(key => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return [key, 1 + seed % 5];
  })));
  return {
    ...card,
    preview: true,
    count: 3,
    unlocked: true,
    averages: Object.fromEntries(keys.map(key => [key, ratings.reduce((sum, scores) => sum + scores[key], 0) / ratings.length])),
  };
}
