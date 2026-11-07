import { join } from 'node:path';
import { createApi } from './api.mjs';

export async function createLocalApi({ dataPath = process.env.TIGER_DATA_PATH || join(process.cwd(), '.local-data', 'cards.sqlite'), ...options } = {}) {
  // Kept out of the production import graph; Netlify must never use ephemeral SQLite.
  const { createSqliteStore } = await import('./sqlite-store.mjs');
  const store = createSqliteStore({ dataPath });
  try {
    return { handleApi: createApi({ ...options, store, hashSecret: store.hashSecret }), close: store.close };
  } catch (error) {
    store.close();
    throw error;
  }
}
