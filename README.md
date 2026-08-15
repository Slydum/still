# Still

Still is a local-first personal companion PWA built with React, TypeScript, Vite, Dexie, and Supabase. Supported personal records are saved to IndexedDB on the current browser/device first. Signed-in accounts can then synchronize those records through Supabase with row-level security.

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` when you need a Supabase-backed local session. Client builds use a Supabase **publishable** key only; never put a service-role key or other privileged credential in the browser environment.

## Demo sandbox

The login screen includes **Open demo sandbox**. Demo mode requires no account, does not create a Supabase user, does not cloud-sync records, and stores demo records in a separate `still-demo-local` IndexedDB database. Use **More → Demo sandbox** to reset or exit it.

Browser-granted permissions such as notification or location access still belong to the browser/device rather than to a Still account, so the demo should not be treated as a separate browser permission profile.

## Quality and release gates

```bash
npm run format:check     # text-format baseline
npm run lint             # TypeScript + source hygiene
npm test                 # unit/regression suite
npm run security:audit   # fail-closed dependency audit
npm run build            # production build
npm run build:budget     # bundle-size guardrail (after build)
```

CI also runs the headless-browser Demo Sandbox/IndexedDB migration test, responsive and keyboard route QA, Work laptop and interaction QA, a disposable local-Supabase pgTAP suite covering RLS and the sync RPC, and a disposable browser acceptance flow covering signup/login, password recovery, granular settings plus record synchronization, deletion propagation, account binding, and both logout modes.

Phase 4 adds a retained visual release matrix across 390×844, 1024×768, 1280×900, 1440×900, and 1680×1050 for Home, Work, Love, Money, Health, Settings, and Quick Add modal states. The same `scripts/live-visual-check.mjs` suite runs against the local production preview before merge and against the real GitHub Pages URL after deployment. It captures 35 viewport/states per run and keeps the screenshots plus measured geometry as workflow artifacts for review.

After a production GitHub Pages deployment, `live-pages-smoke` opens the actual deployed site in headless Chrome and verifies Demo Sandbox entry, direct nested routing, the `/still/` service-worker scope, and an offline reload of the cached app shell. `live-visual-qa` reruns the release visual matrix against that deployed build.

## Data, synchronization, and recovery

- IndexedDB/Dexie is the authoritative durable local persistence layer for supported personal records, settings records, and local notification history.
- Zustand/localStorage is intentionally limited to four device-scoped values: notification enablement, automatic-weather preference, current weather, and optional occasion state.
- Supabase holds the cloud copy of records that have completed a successful sync.
- General account settings plus Work, Money, and Health settings synchronize as independent records rather than one giant preference bundle.
- Local notification history is durable on the current device but is not cloud-synced.
- Edits are saved locally first; cloud sync is attempted when the signed-in app starts, when **Sync now** is used, and during logout flows. It does not run continuously after every edit.
- Sync conflicts resolve deterministically with logical record revisions rather than device wall-clock order.
- Deletions are represented by tombstones so offline devices cannot silently resurrect removed records.
- Ordinary logout attempts a sync but may still finish if cloud access is unavailable; unsynced changes remain only in that browser until the same account returns and syncs successfully.
- **Log out and clear this device** requires a successful sync before removing Still-managed local account data.
- A new device can recover only records that previously reached Supabase. Unsynced local edits are not a cloud backup.

Older `still-app-state-v1` localStorage payloads and bundled v1 settings remain migration-readable. Repository bootstrap imports supported durable data into IndexedDB, splits settings into independent domain records, and subsequent persistence writes prune the old duplicate durable localStorage state.

See `DATA_AND_PRIVACY.md` for the canonical list of cloud-synced versus device-specific data, the Supabase privacy boundary, weather/location behavior, reminder limitations, demo boundaries, migration language, and recovery guarantees. `IMPLEMENTATION_NOTES.md` documents the corresponding code-level storage and synchronization architecture.

Database schema changes belong in `supabase/migrations/`. Security-sensitive database behavior should have a corresponding test in `supabase/tests/database/`.

## Weather and reminders

Automatic weather is optional. When enabled, the browser obtains location and sends coordinates directly to Open-Meteo for current conditions; Still does not add those coordinates to the user's Supabase account.

Reminders are local browser notifications driven by the running page/PWA process. Browsers may throttle or suspend background timers, and Still has no server-side push service for a fully closed browser. Do not treat reminder delivery as guaranteed when the browser is closed or suspended.

## Deployment

GitHub Pages is the active production deployment path. The workflow builds Still under `/still/`, verifies nested-base PWA output, uploads the Pages artifact, deploys only for non-pull-request runs, and then smoke-tests the deployed PWA plus the full visual release matrix before the commit is considered release-ready.

`vercel.json` remains as SPA rewrite configuration, but Vercel Git deployments are intentionally disabled with `git.deploymentEnabled: false`.

See `RELEASE_CHECKLIST.md` for the release gates, post-merge verification, artifact review, and repository settings expected around `main`.

## Artwork and licensing

Bundled artwork is a significant part of this repository. See `ASSET_PROVENANCE.md` for the provenance policy. No open-source license has been declared for this repository, so do not assume redistribution rights for the application or its artwork.
