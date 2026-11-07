import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { ApiError, errorResponse, jsonResponse } from './errors.mjs';
import { readJson, validateBody } from './validation.mjs';
import { RETENTION_END } from './retention.mjs';

const CARD_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SHARE_ID = '[A-Za-z0-9_-]{12}';
const ownerRoute = new RegExp(`^/api/cards/(${CARD_ID})$`);
const publicRoute = new RegExp(`^/api/public/(${SHARE_ID})(/ratings)?$`);

export function createApi({ store, hashSecret, clock = Date.now, rateLimits = {} }) {
  if (typeof hashSecret !== 'string' || hashSecret.length < 32) throw new Error('A stable hash secret of at least 32 characters is required.');
  const limits = { create: 10, rating: 60, ...rateLimits };
  if (!Object.values(limits).every((n) => Number.isSafeInteger(n) && n > 0)) throw new Error('Invalid rate limits.');
  const hash = (purpose, value) => createHmac('sha256', hashSecret).update(`${purpose}\0${value}`).digest('hex');

  async function rateLimit(scope, clientIp) {
    const now = clock();
    const window = Math.floor(now / 60_000);
    const expiresAt = (window + 1) * 60_000;
    // Only trusted transport metadata is accepted, never forwarded headers from the caller.
    const result = await store.consumeRate({
      key: hash(`ip:${scope}:${window}`, clientIp || 'unknown'),
      now, expiresAt, limit: limits[scope],
    });
    if (!result.allowed) {
      throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.', {
        'Retry-After': String(Math.max(1, Math.ceil((expiresAt - now) / 1000))),
      });
    }
  }

  function ownerHash(request) {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get('authorization') || '');
    if (!match) throw new ApiError(401, 'UNAUTHORIZED', 'A valid owner bearer key is required.', { 'WWW-Authenticate': 'Bearer' });
    return hash('owner', match[1]);
  }

  return async function handleApi(request, { clientIp } = {}) {
    try {
      if (clock() >= RETENTION_END) {
        await store.purgeExpired();
        throw new ApiError(410, 'CAMPAIGN_ENDED', 'The campaign has ended.');
      }
      const url = new URL(request.url);
      const owner = ownerRoute.exec(url.pathname);
      const shared = publicRoute.exec(url.pathname);
      let allowed;
      if (url.pathname === '/api/cards') allowed = ['POST'];
      else if (owner) allowed = ['GET', 'DELETE'];
      else if (shared) allowed = shared[2] ? ['POST'] : ['GET'];
      else throw new ApiError(404, 'NOT_FOUND', 'API route not found.');
      if (!allowed.includes(request.method)) throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.', { Allow: allowed.join(', ') });

      if (owner) {
        const args = { id: owner[1], ownerHash: ownerHash(request) };
        if (request.method === 'DELETE') {
          await store.deleteCard(args);
          return jsonResponse(null, 204);
        }
        return jsonResponse(await store.getOwnerCard(args));
      }
      if (shared && !shared[2]) return jsonResponse(await store.getPublicCard({ shareId: shared[1] }));

      const creating = !shared;
      await rateLimit(creating ? 'create' : 'rating', clientIp);
      const input = validateBody(await readJson(request), creating);
      const common = { deviceHash: hash('device', input.deviceId), channel: input.channel, createdAt: new Date(clock()).toISOString() };
      if (creating) {
        const id = randomUUID();
        const shareId = randomBytes(9).toString('base64url');
        const ownerKey = randomBytes(32).toString('base64url');
        await store.createCard({ ...common, id, shareId, ownerHash: hash('owner', ownerKey), nickname: input.nickname, selfScores: input.selfScores });
        return jsonResponse({ id, shareId, ownerKey }, 201);
      }
      return jsonResponse(await store.submitRating({ ...common, shareId: shared[1], scores: input.scores }), 201);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
