import { createLocalApi } from './local.mjs';
import { errorResponse } from './errors.mjs';

export { createApi } from './api.mjs';
export { createLocalApi } from './local.mjs';

let local;
export async function handleApi(request, context) {
  try {
    if (process.env.NETLIFY || process.env.NODE_ENV === 'production') {
      throw new Error('Use the Supabase-backed Netlify function in production.');
    }
    local ??= createLocalApi().catch((error) => { local = undefined; throw error; });
    return await (await local).handleApi(request, context);
  } catch (error) {
    return errorResponse(error);
  }
}
