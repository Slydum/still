# Release checklist

Before merging a change to `main`:

- `app-quality` passes: formatting baseline, TypeScript/source hygiene, unit tests, dependency audit, production build, bundle budget, and browser demo/IndexedDB integration.
- `database-security` passes: migrations apply cleanly, pgTAP verifies RLS plus synchronization behavior, and the disposable browser acceptance flow covers signup/login, password recovery, cross-browser sync, deletion propagation, logout/local-copy behavior, account binding, and sync-gated local clearing.
- GitHub Pages `build` passes, including nested-base PWA verification.
- Database migrations required by the release are applied to production only after the disposable local-database tests pass.
- No service-role key, password, private token, or other privileged secret is present in the diff.
- New artwork has provenance/license information recorded according to `ASSET_PROVENANCE.md`.
- User-facing claims about local storage, cloud sync cadence, recovery, location/weather, reminders, demo isolation, and privacy match `DATA_AND_PRIVACY.md`.
- If the set of cloud-synced fields or device-specific fields changes, update `DATA_AND_PRIVACY.md`, README documentation, and matching Settings/Auth copy in the same pull request.

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
- Confirm the GitHub Pages `build`, **deploy**, and `live-pages-smoke` jobs complete successfully for the merge commit. A pull-request Pages build does not prove that production was deployed or that the deployed service worker can reload offline.
- `live-pages-smoke` must exercise the deployed Demo Sandbox, a direct nested route, the `/still/` service-worker scope, and an offline reload of the installed app shell.
- For a release containing a production database migration, confirm the production schema/security boundary still matches the tested migration and review Supabase security advisors.
- Smoke-check any release-specific browser/device behavior that cannot be automated reliably, especially notification and location permission UX on the intended mobile browsers.

## Tagging a release

Create a release tag only after the exact `main` commit has passed all post-merge checks above. The tag must point to that verified commit, not to an earlier pull-request head. Release notes should summarize user-visible changes and any known limitations without overstating backup, privacy, notification, or offline guarantees.
