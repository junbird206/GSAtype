import { ApiError } from './errors.mjs';
import { SCORE_KEYS, scoreVersion, scoreKeysForVersion } from '../config/stats.js';

export { SCORE_KEYS };
export const MAX_BODY_BYTES = 16 * 1024;
const profanity = ['fuck', 'shit', 'bitch', '\uc2dc\ubc1c', '\uc528\ubc1c', '\ubcd1\uc2e0', '\uac1c\uc0c8\ub07c', '\uc9c0\ub784'];
const forbiddenCharacters = /[\p{Cc}\p{Cf}\p{Cs}]/u;

function invalid(message) {
  throw new ApiError(400, 'VALIDATION_ERROR', message);
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateScores(value) {
  const version = scoreVersion(value);
  if (!version || !Object.values(value).every(n => Number.isInteger(n) && n >= 1 && n <= 5)) {
    invalid('Scores must contain all six stats from one supported version, each an integer from 1 to 5.');
  }
  return Object.fromEntries(scoreKeysForVersion(version).map((key) => [key, value[key]]));
}

export function validateBody(body, creating) {
  const fields = creating ? ['nickname', 'selfScores', 'deviceId', 'channel'] : ['scores', 'deviceId', 'channel'];
  if (!object(body) || Object.keys(body).some((key) => !fields.includes(key))) invalid('Unexpected request fields.');
  if (typeof body.deviceId !== 'string' || [...body.deviceId].length < 16 || body.deviceId.length > 256 ||
      /\s/u.test(body.deviceId) || forbiddenCharacters.test(body.deviceId)) {
    invalid('deviceId must be a non-whitespace string of 16 to 256 characters.');
  }
  const channel = body.channel ?? null;
  if (channel !== null && (typeof channel !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(channel))) {
    invalid('channel must be 1 to 64 letters, numbers, underscores or hyphens.');
  }
  const result = { deviceId: body.deviceId, channel };
  if (creating) {
    if (typeof body.nickname !== 'string') invalid('nickname is required.');
    const nickname = body.nickname.trim().normalize('NFC');
    if ([...nickname].length < 2 || [...nickname].length > 10 || forbiddenCharacters.test(nickname)) {
      invalid('nickname must contain 2 to 10 Unicode characters without control characters.');
    }
    const folded = nickname.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{Z}\p{S}]/gu, '');
    if (profanity.some((word) => folded.includes(word))) invalid('Please choose another nickname.');
    return { ...result, nickname, selfScores: validateScores(body.selfScores) };
  }
  return { ...result, scores: validateScores(body.scores) };
}

export async function readJson(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json.');
  }
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
    throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
  }
  const reader = request.body?.getReader();
  if (!reader) invalid('A JSON body is required.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'BODY_TOO_LARGE', 'Request body is too large.');
      }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    invalid('Request body must be valid JSON.');
  } finally {
    reader.releaseLock();
  }
}
