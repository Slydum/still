# Changelog

## 0.4.0

Still v0.4 turns the four Life Areas into complete, calm working surfaces and finishes the cross-app release polish around them.

### Home, Work, Love, Money, and Health

- refines Home into a quiet daily orientation surface with bounded previews and clearer hierarchy
- turns Work into a practical work hub with queue, shift/pay context, meetings, incidents, changes, notes, and supporting records
- turns Love into a relationship collection for people, plans, moments, notes, and gentle connection check-ins
- turns Money into a privacy-first finance overview with transactions, upcoming bills, savings goals, accounts, and minimal summary visuals
- adds a dedicated Health overview for mood and energy, optional daily wellbeing observations, routines, Health Notes, and progressive history/settings
- preserves existing data models where possible instead of creating duplicate ledgers, check-ins, or disconnected records

### Final polish and release hardening

- aligns feature pages around shared Still page-header and summary primitives without flattening their individual character
- expands iPhone Safari form-zoom protection to compact controls across the whole app
- corrects the release QA matrix so it exercises the real Journal route plus dedicated Health and Work detail surfaces
- verifies modal focus trapping, unsaved-draft protection, Escape behavior, and focus restoration in the release browser suite
- expands deployed mobile visual QA from Home and Work to Love, Money, Health, Journal, and Settings
- centralizes the displayed release identity and guards it against package-version drift

### Release safeguards

The existing local-first, IndexedDB, Supabase/RLS, auth/recovery/cross-browser sync, bundle-budget, dependency-audit, nested-base PWA, deployment, offline reload, and live visual gates remain mandatory for this release.

Still saves supported records locally first. Cloud sync is not continuous after every edit; another device can recover only records that previously completed a successful sync. Local browser reminders are not server push notifications and are not guaranteed while the browser is fully closed or suspended. Supabase data is account-scoped through row-level security, but Still does not claim end-to-end encryption with user-only keys.

See `DATA_AND_PRIVACY.md` for the canonical data, privacy, sync, recovery, weather/location, reminder, and Demo Sandbox boundaries.

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
