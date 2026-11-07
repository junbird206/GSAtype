import { ApiError } from './errors.mjs';

const rpcNames = {
  consumeRate: 'tiger_consume_rate', createCard: 'tiger_create_card', getPublicCard: 'tiger_get_public_card',
  getOwnerCard: 'tiger_get_owner_card', submitRating: 'tiger_submit_rating', deleteCard: 'tiger_delete_card',
  purgeExpired: 'tiger_purge_expired',
};
const errors = {
  NOT_FOUND: [404, 'Card not found.'],
  UNAUTHORIZED: [401, 'A valid owner bearer key is required.'],
  OWNER_CANNOT_RATE: [403, 'You cannot rate your own card on this device.'],
  ALREADY_RATED: [409, 'This device has already rated this card.'],
  RATING_LIMIT: [409, 'This card has reached 30 ratings.'],
  VALIDATION_ERROR: [400, 'Invalid input.'],
};

export function createSupabaseStore({ url, serviceRoleKey, fetchImpl = fetch }) {
  const base = new URL(url);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('SUPABASE_URL must be an HTTPS project origin.');
  }
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required.');
  async function rpc(name, args) {
    const response = await fetchImpl(new URL(`/rest/v1/rpc/${name}`, base), {
      method: 'POST',
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_input: args ?? {} }),
      signal: AbortSignal.timeout(10_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Supabase RPC failed.');
    const result = await response.json();
    if (result?.error && Object.hasOwn(errors, result.error)) {
      const [status, message] = errors[result.error];
      throw new ApiError(status, result.error, message, status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {});
    }
    if (!result || !Object.hasOwn(result, 'data')) throw new Error('Unexpected RPC response.');
    return result.data;
  }
  return Object.fromEntries(Object.entries(rpcNames).map(([method, name]) => [method, (args) => rpc(name, args)]));
}
