# Still implementation notes

## Runtime flow

1. `stillContext.ts` creates the local presentation context from time, mood, energy, optional weather, and occasion.
2. `quoteEngine.ts` scores the quote library against that context.
3. `useDailyQuote.ts` stores one stable quote per local date in IndexedDB and avoids recently used quote IDs.
4. `themeEngine.ts` selects matching companion, time/weather, plant, check-in, and priority illustrations.
5. `DashboardPage.tsx` renders the resulting theme while keeping the dashboard layout stable.

## Application state boundary

`src/stores/appStoreCore.ts` owns the Zustand state shape and baseline actions. `src/stores/useAppStore.ts` is the public store module and applies the correctness adapters that normalize event ranges, money input, recurring-task behavior, and Work shift timestamps/earnings.

The old runtime filename `useAppStoreLegacy.ts` was retired in Phase 4. Source hygiene rejects reintroducing that path or importing it again. This was deliberately a behavior-preserving consolidation rather than a store rewrite during release hardening.

Zustand persistence keeps the historical `still-app-state-v1` storage name so older installations can hydrate once for migration. Before new writes, the public store configures persistence through `devicePersistedState()`, limiting localStorage to:

- `notificationsEnabled`
- `autoWeather`
- `weather`
- `occasion`

Durable personal data and synced domain settings must not be added back to that allowlist.

## Persistence and cloud synchronization

Still is local-first. `usePermanentDataRepository.ts` persists supported edits to the Dexie database before cloud synchronization. IndexedDB is the canonical durable local database.

The current Dexie schema stores tasks, events, journal entries, expenses, notification history, entity links, Work shifts, check-ins, settings records, and repository metadata. Notification history is durable on the local device but is intentionally excluded from cloud synchronization.

Account settings are stored as four independent records in the existing settings table:

- `account`: profile, appearance, reduced motion, and reminder schedule preferences
- `work`: Work profile and privacy preference
- `money`: accounts, bills, savings goals, and privacy preference
- `health`: routines and signal preferences

`cloudSync.ts` maps those to independent Supabase record types. Record conflicts are ordered by logical `syncCounter`, then deterministic `mutationId` tie-breaking rather than device wall-clock timestamps. Server acknowledgements carry `serverRevision` and clear local dirty state on an exact logical-version match. Deletions use tombstones.

Cloud sync is currently triggered when the authenticated app starts, when the user selects **Sync now**, and during logout flows. It is not a continuous per-edit background sync service.

The canonical product-facing storage, privacy, recovery, and sync contract is `DATA_AND_PRIVACY.md`. Update that document and matching UI copy whenever these behaviors change.

## Migration model

Repository bootstrap is intentionally backwards-compatible:

- older Dexie schemas are upgraded in place without deleting existing records;
- old `still-app-state-v1` durable fields can hydrate long enough to seed IndexedDB, after which device-only persistence prunes the duplicate localStorage payload;
- a bundled v1 `account` settings row is split into `account`, `work`, `money`, and `health` rows;
- fresh-device default settings use clean zero-revision placeholders so real cloud settings beat defaults;
- existing granular records with real revisions are never overwritten by a later legacy bundle migration.

Browser migration coverage in `scripts/e2e-demo-browser.mjs` must remain green before changing any of these rules.

## Release visual QA

`scripts/live-visual-check.mjs` is shared by pull-request preview CI and post-deploy Pages QA. Without `STILL_LIVE_URL` it starts a local Vite preview; with `STILL_LIVE_URL` it tests the deployed release.

The Phase 4 matrix covers 390×844, 1024×768, 1280×900, 1440×900, and 1680×1050 across Home, Work, Money, Health, and Settings, plus Quick Add modal geometry and keyboard focus. Screenshots and measured geometry are written under `artifacts/release-visual` and retained by CI.

## Asset paths

Production illustrations are served from:

```text
/public/assets/illustrations/<category>/<filename>.webp
```

The central path registry is `src/theme/stillAssets.ts`. Components should use that registry rather than hard-coded illustration paths.

## Weather

The dashboard supports both manual weather selection and optional automatic local weather. Automatic weather uses browser geolocation and sends latitude/longitude directly to the Open-Meteo forecast API. The returned condition is used for the current device experience; coordinates are not written to the Still Supabase record set.

The automatic-weather preference and location/weather state are device-specific rather than account-synced settings.

## Reminders

Reminder checks run in `useReminderEngine.ts` while the Still page/PWA process is active. The service worker displays notifications and handles notification clicks, but there is no server-side push service or service-worker scheduler that can guarantee reminders after the browser process is fully closed.

Product copy must not promise guaranteed background delivery. See `DATA_AND_PRIVACY.md` for the user-facing boundary.

## Demo sandbox

Demo records use the separate `still-demo-local` IndexedDB database and are excluded from Supabase synchronization. Browser permissions remain browser-level, so demo isolation claims should apply to Still records and cloud sync rather than to browser permission controls.
