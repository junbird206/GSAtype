import { createSupabaseStore } from '../../server/supabase-store.mjs';

export default async () => {
  const store = createSupabaseStore({ url: process.env.SUPABASE_URL, serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY });
  await store.purgeExpired();
  return new Response(null, { status: 204 });
};

export const config = { schedule: '0 15 * * *' };
