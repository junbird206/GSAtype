import { createApi } from '../../server/api.mjs';
import { createSupabaseStore } from '../../server/supabase-store.mjs';
import { errorResponse } from '../../server/errors.mjs';

let handler;
export default async function handleApi(request, context) {
  try {
    handler ??= createApi({
      store: createSupabaseStore({ url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY }),
      hashSecret: process.env.TIGER_HASH_SECRET,
    });
    if (!context?.ip) throw new Error('Trusted Netlify client IP is unavailable.');
    return await handler(request, { clientIp: context.ip });
  } catch (error) {
    return errorResponse(error);
  }
}

export const config = { path: '/api/*', preferStatic: false };
