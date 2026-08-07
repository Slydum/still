# Still implementation notes

## Runtime flow

1. `stillContext.ts` creates the local presentation context from time, mood, energy, optional weather, and occasion.
2. `quoteEngine.ts` scores the quote library against that context.
3. `useDailyQuote.ts` stores one stable quote per local date in IndexedDB and avoids recently used quote IDs.
4. `themeEngine.ts` selects matching companion, time/weather, plant, check-in, and priority illustrations.
5. `DashboardPage.tsx` renders the resulting theme while keeping the dashboard layout stable.

## Persistence and cloud synchronization

Still is local-first. `usePermanentDataRepository.ts` persists supported edits to the Dexie database before cloud synchronization. `cloudSync.ts` synchronizes account-backed records through Supabase.

Cloud sync is currently triggered when the authenticated app starts, when the user selects **Sync now**, and during logout flows. It is not a continuous per-edit background sync service.

The canonical product-facing storage, privacy, recovery, and sync contract is `DATA_AND_PRIVACY.md`. Update that document and matching UI copy whenever these behaviors change.

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
