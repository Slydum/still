# Changelog

## 0.3.0

Still v0.3 is the UX consolidation release. It keeps the local-first product model established earlier while making the daily experience more coherent, accessible, navigable, and complete.

### UX consolidation

- fixes dashboard correctness issues that could hide tasks or contradict routable Life Areas
- strengthens text contrast, focus visibility, dialog semantics, focus trapping, Escape handling, and focus restoration
- clarifies Home, Settings, Life Areas, Work and Money tracker navigation, with history-aware Back behavior and scroll restoration
- simplifies Home into a daily orientation surface with bounded task/event previews and a compact Weekly Overview destination
- adds a dedicated Tasks management view with Open, Completed, and All filters
- adds expense editing so Money records can be corrected without delete-and-recreate workflows
- makes task/event notifications and Work/Money Life Area records lead to actionable destinations
- begins consolidating repeated page UI into shared design-system primitives

### Release safeguards

- adds regression gates for UX correctness, accessibility foundations, navigation/IA, Home simplification, feature workflow completion, and shared design primitives
- adds multi-viewport release QA across primary routes at 320px, 390px, 768px, and 1280px
- keeps browser/IndexedDB migration, isolated Supabase/RLS, auth/recovery/cross-browser sync, bundle-budget, security-audit, and GitHub Pages/PWA gates in the release path

### Important behavior

Still saves supported records locally first. Cloud sync is not continuous after every edit; a new device can recover only records that previously completed a successful sync. Local browser reminders are not server push notifications and are not guaranteed while the browser is fully closed or suspended. Supabase data is account-scoped through row-level security, but Still does not claim end-to-end encryption with user-only keys.

See `DATA_AND_PRIVACY.md` for the canonical data, privacy, sync, recovery, weather/location, reminder, and Demo Sandbox boundaries.

## 0.1.0

Still's first release candidate established the local-first application, account-backed synchronization, and core release safeguards.

### Included

- local-first tasks, events, journal entries, expenses, check-ins, work shifts, links, and account preferences
- Supabase account sync with per-user row-level security
- deterministic logical conflict resolution, incremental pulls, dirty-record pushes, and deletion tombstones
- account lifecycle controls that preserve local data on ordinary logout and require a successful sync before clearing local data
- isolated no-account Demo Sandbox for safe product testing
- nested-path GitHub Pages PWA support and offline app-shell caching
- visible persistence failure reporting and domain-level date/time/money correctness safeguards
