# Friend-Rated Tiger Cards

## Local preview

Use Node 22.13+ (the built-in SQLite module is needed locally).

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:4173/`. This uses a real local API with SQLite persistence, not simulated ratings in browser storage. Data and the stable hashing secret live in ignored `.local-data/cards.sqlite`. `TIGER_DATA_PATH` overrides the database file. Use separate browser profiles/private contexts to act as different friends. A localhost link is not accessible to friends on other devices.

The original v1 files remain in `src/`; the active app is `src/v2/`. Existing illustrations are reused. The new frontend uses Vite and vanilla JavaScript to retain the existing runtime pattern. Stats, names, illustration mapping and main copy are in `config/tiger.js`.

## Production setup

Production uses Netlify Functions with Supabase PostgreSQL. It never falls back to ephemeral local storage.

1. Create a Supabase project and run `database/001_tiger_backend.sql`, then `database/002_retention.sql` as the administrator in its SQL editor.
2. Set these server-only environment variables in Netlify:
   - `SUPABASE_URL`: HTTPS project origin.
   - `SUPABASE_SECRET_KEY`: server-only secret API key (`sb_secret_...`). Legacy `SUPABASE_SERVICE_ROLE_KEY` remains supported as a fallback. Never put either key in a `VITE_` variable or the browser.
   - `TIGER_HASH_SECRET`: stable randomly generated secret of at least 32 characters. Rotating it invalidates existing owner links and device comparisons.
3. Build with `npm run build` and deploy both `dist/` and `netlify/functions/` using `netlify.toml`. A static-only upload cannot receive ratings.
4. Connect the intended public domain before distributing links. The app and QR codes use the current site origin.
5. Verify creation, three independent ratings, owner recovery, exports and deletion against that deployment. Test native Kakao webviews on iOS and Android. Review the existing signup URL and GA4 ID with the team.

The SQL is exercised locally with PostgreSQL via PGlite. Hosted credentials belong only in the target Netlify site's function environment; never commit them or reuse local SQLite data as the production database.

## Data and access

- Public responses contain only nickname, share ID, timestamp, count and aggregate scores after three ratings. Self-scores and individual ratings are not exposed publicly.
- Owner access requires an independent 256-bit bearer key; only its HMAC is persisted. Recovery URLs use a fragment (`#key=`), which the app consumes and clears before analytics. Share URLs never include this key.
- Devices and IP rate-limit buckets are HMACed with separate scopes. A client-generated device ID discourages repeat ratings; it cannot prove one person per rating across browsers or cleared storage.
- A SQL row lock and local SQLite transaction enforce the maximum of 30 ratings. Unique `(card_id, device_hash)` values enforce one vote per device.
- Owner deletion removes the card and ratings. The retention deadline is the end of January 31, 2027 in Korea. Daily Netlify cleanup removes expired rate buckets and purges campaign records at the deadline; the API also closes and purges on subsequent requests. Confirm the scheduled function is enabled after deployment. Provider backups follow the provider's retention policy.
- No photos, real-name fields, school IDs, emails or phone numbers are collected. Gemini face cards use an external copy-prompt flow. Free-plan eligibility and deadlines are not advertised without verification.

## Product rules

The creator gets a self-assessed preview immediately. Three friends unlock the friend-only average and comparison. All-equal scores produce a balanced type; partial ties show all top stats and use configured order to select the main illustration. More ratings can change the type. Bronze/silver/gold thresholds are 3/5/10. Exports include the public rating URL and QR.

The primary CTA is sharing; signup is secondary. Face prompts are available. Kakao-specific SDK sharing, dynamic per-card Open Graph previews, military content and gold animation are not part of this first pass. Native share and link-copy fallbacks work without a Kakao SDK key. Feed images are exposed in the UI; the renderer also supports story dimensions for subsequent UI work.

## Verification

```sh
npm test
npm run build
node tests/browser.mjs
```

Tests cover original scoring, new calculations, persistent SQLite/API access and PostgreSQL migration/RPC access. `tests/browser.mjs` needs Playwright; set `PLAYWRIGHT_MODULE` to an installed module if the bundled runtime path differs. It creates and deletes test cards, saves screenshots in ignored `test-results/`, checks five viewport widths and decodes exported QR codes. It does not replace real Kakao iOS/Android testing. GA4 live reporting and external signup completion are not verified locally.

References: [Supabase function permissions](https://supabase.com/docs/guides/database/functions), [Netlify function routing](https://docs.netlify.com/build/functions/configuration/), [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/).
