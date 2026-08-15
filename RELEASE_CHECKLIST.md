# Release checklist

Before merging a change to `main`:

- `app-quality` passes: formatting baseline, TypeScript/source hygiene, unit tests, dependency audit, production build, bundle budget, browser demo/IndexedDB integration, the responsive/keyboard route matrix, Work laptop/interaction QA, and the Phase 4 release visual matrix.
- The responsive/keyboard route matrix covers primary routes at 320px, 390px, 768px, and 1280px, rejects horizontal overflow or missing page headings, verifies the displayed release version against `package.json`, and exercises modal focus trapping, unsaved-draft protection, Escape behavior, and focus restoration.
- The Phase 4 release visual matrix covers Home, Work, Love, Money, Health, and Settings at 390×844, 1024×768, 1280×900, 1440×900, and 1680×1050. It also opens Quick Add at every viewport, verifies dialog geometry and keyboard focus, and stores 35 screenshots plus measured geometry as a CI artifact.
- The route matrix must exercise the real Journal (`/today`), dedicated Health (`/health`), and Work detail (`/work/details`) surfaces rather than relying on fallback or redirect routes to pass.
- Work-specific QA must pass at 1366×768 and 1440×900 and retain the Option 1 geometry plus persisted meeting deletion flow.
- `database-security` passes: migrations apply cleanly, pgTAP verifies RLS plus synchronization behavior, and the disposable browser acceptance flow covers signup/login, password recovery, cross-browser sync, deletion propagation, granular Work/Money/Health settings, logout/local-copy behavior, account binding, and sync-gated local clearing.
- GitHub Pages `build` passes, including nested-base PWA verification.
- Browser migration QA passes against an older Dexie database and the bundled v1 settings/localStorage format before any persistence or sync migration is merged.
- Source hygiene confirms the retired `src/stores/useAppStoreLegacy.ts` runtime path has not returned and Work styles are not injected through runtime `<style>` elements.
- Database migrations required by the release are applied to production only after the disposable local-database tests pass.
- No service-role key, password, private token, or other privileged secret is present in the diff.
- New artwork has provenance/license information recorded according to `ASSET_PROVENANCE.md`.
- User-facing claims about local storage, cloud sync cadence, recovery, location/weather, reminders, demo isolation, and privacy match `DATA_AND_PRIVACY.md`.
- If the set of cloud-synced fields or device-specific fields changes, update `DATA_AND_PRIVACY.md`, README documentation, `IMPLEMENTATION_NOTES.md`, and matching Settings/Auth copy in the same pull request.

## Expected `main` protection

Repository settings should protect `main` and require pull requests plus these checks before merge:

- `app-quality`
- `database-security`
- GitHub Pages `build`

Also enable dismissal/revalidation of stale approvals if multiple maintainers are reviewing, and prevent force pushes and branch deletion on `main`.

The GitHub app used by automated maintenance may not have permission to change branch-protection settings. If protection is not already enabled, configure the rules above in GitHub repository settings before treating CI as a mandatory merge gate.

## Post-merge verification

After a merge to `main`:

- Confirm the `main` `app-quality` and `database-security` jobs pass on the merge commit.
- Confirm the GitHub Pages `build`, **deploy**, `live-pages-smoke`, and `live-visual-qa` jobs complete successfully for the merge commit. A pull-request Pages build does not prove that production was deployed or that the deployed service worker can reload offline.
- `live-pages-smoke` must exercise the deployed Demo Sandbox, a direct nested route, the `/still/` service-worker scope, and an offline reload of the installed app shell.
- `live-visual-qa` must rerun the same five-viewport release matrix against the deployed Pages URL and retain its screenshot/metrics artifact.
- Review the release visual artifact for Home, Work, Love, Money, Health, Settings, and Quick Add at all target widths rather than relying only on geometry assertions.
- For a release containing a production database migration, confirm the production schema/security boundary still matches the tested migration and review Supabase security advisors.
- Smoke-check any release-specific browser/device behavior that cannot be automated reliably, especially notification and location permission UX on the intended mobile browsers.

## Tagging a release

Create a release tag only after the exact `main` commit has passed all post-merge checks above. The tag must point to that verified commit, not to an earlier pull-request head. Release notes should summarize user-visible changes and any known limitations without overstating backup, privacy, notification, or offline guarantees.
