export const CURRENT_STAT_VERSION = 'friends-v2';
export const LEGACY_STAT_VERSION = 'campus-v1';
export const SCORE_KEYS = Object.freeze(['intelligence', 'stamina', 'character', 'wealth', 'charm', 'humor']);
export const LEGACY_SCORE_KEYS = Object.freeze(['grade', 'stamina', 'social', 'teamwork', 'mental', 'goyeon']);

export function scoreVersion(scores) {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return null;
  const keys = Object.keys(scores);
  if (keys.length !== 6) return null;
  if (SCORE_KEYS.every(key => Object.hasOwn(scores, key))) return CURRENT_STAT_VERSION;
  if (LEGACY_SCORE_KEYS.every(key => Object.hasOwn(scores, key))) return LEGACY_STAT_VERSION;
  return null;
}

export function scoreKeysForVersion(version) {
  if (version === CURRENT_STAT_VERSION) return SCORE_KEYS;
  if (version === LEGACY_STAT_VERSION) return LEGACY_SCORE_KEYS;
  throw new Error('Unknown stat version.');
}
