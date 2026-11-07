import { resultFor } from './model.js';
import { facePrompt } from '../../config/tiger.js';

export function personalCard(card, perspective = 'friends') {
  const friends = perspective !== 'self' && card.count >= 3 && Boolean(card.averages);
  const scores = friends ? card.averages : card.selfScores;
  const count = friends ? card.count : 0;
  const result = resultFor(scores, count);
  return { scores, count, perspective: friends ? 'friends' : 'self', result, prompt: facePrompt(card, result) };
}

export function personalCardPath(card, perspective) {
  const query = new URLSearchParams({ view: personalCard(card, perspective).perspective });
  if (card.preview) query.set('preview', 'friends');
  return `/c/${card.id}/face?${query}`;
}
