# Release checklist

Before merging a change to `main`:

- `app-quality` passes: formatting baseline, TypeScript/source hygiene, unit tests, dependency audit, production build, bundle budget, and browser demo/IndexedDB integration.
- `database-security` passes: migrations apply cleanly and pgTAP verifies RLS plus synchronization behavior.
- GitHub Pages `build` passes, including nested-base PWA verification.
- Database migrations required by the release are applied to production only after the disposable local-database tests pass.
- No service-role key, password, private token, or other privileged secret is present in the diff.
- New artwork has provenance/license information recorded according to `ASSET_PROVENANCE.md`.

## Expected `main` protection

Repository settings should protect `main` and require pull requests plus these checks before merge:

- `app-quality`
- `database-security`
- GitHub Pages `build`

Also enable dismissal/revalidation of stale approvals if multiple maintainers are reviewing, and prevent force pushes and branch deletion on `main`.

The GitHub app used by automated maintenance may not have permission to change branch-protection settings. If protection is not already enabled, configure the rules above in GitHub repository settings before treating CI as a mandatory merge gate.
