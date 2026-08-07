# Changelog

## 0.1.0

Still's first release candidate establishes the local-first application, account-backed synchronization, and release safeguards developed through Phases 1–9.

### Included

- local-first tasks, events, journal entries, expenses, check-ins, work shifts, links, and account preferences
- Supabase account sync with per-user row-level security
- deterministic logical conflict resolution, incremental pulls, dirty-record pushes, and deletion tombstones
- account lifecycle controls that preserve local data on ordinary logout and require a successful sync before clearing local data
- isolated no-account Demo Sandbox for safe product testing
- nested-path GitHub Pages PWA support and offline app-shell caching
- visible persistence failure reporting and domain-level date/time/money correctness safeguards
- unit, browser, IndexedDB migration, RLS/database, authentication, recovery, cross-browser sync, and deployed-PWA release gates

### Important behavior

Still saves supported records locally first. Cloud sync is not continuous after every edit; a new device can recover only records that previously completed a successful sync. Local browser reminders are not server push notifications and are not guaranteed while the browser is fully closed or suspended. Supabase data is account-scoped through row-level security, but Still does not claim end-to-end encryption with user-only keys.

See `DATA_AND_PRIVACY.md` for the canonical data, privacy, sync, recovery, weather/location, reminder, and Demo Sandbox boundaries.
