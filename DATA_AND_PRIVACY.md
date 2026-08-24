# Still data, privacy, and recovery model

This document is the product contract for how Still stores, synchronizes, and recovers user data. User-facing copy and deployment documentation should stay consistent with these boundaries.

## Local-first storage

Still saves supported personal records to IndexedDB on the current browser/device before cloud synchronization. IndexedDB is the authoritative durable local store for account-backed records and local notification history. This local copy is what lets an already loaded, signed-in Still installation continue to work when cloud access is temporarily unavailable.

A small Zustand/localStorage record is intentionally limited to device experience state: whether browser notifications are enabled in Still, the automatic-weather preference, the current weather condition, and the optional occasion. Durable personal records and synced profile/domain settings do not use localStorage as a second permanent database.

Offline use has limits:

- A first sign-in, account creation, email confirmation, or password recovery requires network access to Supabase Auth.
- A new device needs a successful sign-in and cloud synchronization before cloud records become available locally.
- Clearing browser site data, uninstalling in a way that removes site storage, or using **Log out and clear this device** removes Still-managed local data from that browser.
- Changes that have never completed a cloud sync exist only on the browser where they were made and cannot be recovered from Supabase.

The PWA service worker caches application files for offline loading after they have been fetched successfully. Browser cache and permission controls remain browser-managed.

## What cloud sync includes

A signed-in account can synchronize these record types through Supabase:

- tasks
- events
- journal entries
- expenses
- entity links
- work shifts
- check-ins
- general account settings: profile name, appearance tone, reduced-motion choice, and reminder schedule preferences
- Work settings: work profile and Work privacy preference
- Money settings: accounts, bills, savings goals, and Money privacy preference
- Health settings: routines and Health signal preferences

General, Work, Money, and Health settings are independent synchronization records. This keeps a change in one domain from turning the entire account preference bundle into one conflict unit.

Cloud sync does **not** run continuously after every edit. Still persists edits locally first. Cloud synchronization is attempted when the signed-in app starts, when the user chooses **Sync now**, and during logout flows.

Ordinary logout is best-effort: Still tries to sync first, but logout can still complete if cloud synchronization is unavailable. Any unsynced changes remain in that browser and can only sync later after the same account signs in again.

**Log out and clear this device** is stricter. Still requires a successful synchronization before it signs out and clears the account's Still-managed local database and device state. If synchronization fails, the local copy is not cleared.

## Cloud privacy boundary

Synced Still rows are stored in Supabase and are scoped to the authenticated account with row-level security. The browser uses only Supabase publishable client configuration; privileged service-role credentials must never be shipped to the client.

The database also enforces the synchronization protocol at the write boundary. The signed-in client role cannot control server revision numbers, change record ownership/identity columns, truncate the table, or physically delete synchronized rows. Accepted updates must advance Still's logical record version, and synchronized deletion uses tombstones so it can propagate to other devices. The sync RPC also rejects oversized batches server-side. These rules protect synchronization correctness in addition to the account isolation provided by RLS.

Still's cloud sync is **not** an end-to-end encrypted vault. Do not describe Supabase-synced data as inaccessible to the service provider or as encrypted with keys only the user controls.

## Device-specific state

Some state is intentionally local to the browser/device and is not part of account cloud sync, including:

- browser notification permission and whether notifications are enabled in Still on that browser
- local notification history
- reminder delivery bookkeeping and check-in snooze state
- automatic-weather preference, current weather/location-derived state, and browser location permission
- optional occasion state used by the local presentation context
- daily quote selection/history
- PWA caches and other browser-managed site state

Reminder schedule choices such as task reminders, event reminders, daily check-in reminders, reminder time, and event lead time do sync as general account settings. Whether a particular browser is allowed to display notifications remains device-specific.

## Weather and location

Automatic weather is optional. When it runs, the browser requests geolocation and sends latitude/longitude directly to the Open-Meteo forecast endpoint to obtain current conditions. Still does not add those coordinates to the user's Supabase account.

Turning automatic weather off stops Still from making automatic weather requests. Browser-level location permission is controlled by the browser or operating system.

## Local reminders

Still reminders are local browser notifications; there is no server-side push-notification service. Reminder checks are driven by the running page/PWA process. Browsers may throttle or suspend background timers, and a fully closed browser cannot receive these local-only reminders.

Still checks again when its page becomes active, subject to the reminder delivery windows implemented by the app. Product copy must not promise guaranteed background or closed-browser delivery.

## Migration compatibility

Older Still builds persisted a much larger `still-app-state-v1` payload in localStorage. Current builds can still hydrate that payload long enough to import supported durable data into IndexedDB. Subsequent persistence writes retain only the device-scoped state described above, so the old duplicate durable localStorage payload is pruned after migration.

Older bundled account settings are likewise split into independent general, Work, Money, and Health records during repository bootstrap. Existing real granular records take precedence over migration placeholders so a fresh device default cannot overwrite cloud data.

## Demo sandbox

Demo records use the separate `still-demo-local` IndexedDB database and are never uploaded through Still's Supabase sync flow. The demo also swaps its app-state copy so normal account records are not intentionally merged into demo records.

Browser-level permissions and some browser-wide device state can still be shared because they belong to the browser rather than to a Still account. Demo copy should therefore promise isolation of **records and cloud sync**, not isolation of browser permission controls.

## Recovery language

Password reset and email confirmation are handled by Supabase Auth. A password reset link opens Still's recovery route, where the user chooses a new password; after a successful update, Still can continue with the recovered session.

Cloud data recovery is limited to records that completed a successful cloud sync. Never describe unsynced local edits as backed up or recoverable from the account.
