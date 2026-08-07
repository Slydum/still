# Security policy

## Reporting a vulnerability

Please avoid opening a public issue for a vulnerability that could expose another user's data, authentication state, credentials, or private journal/financial/work information.

Use GitHub's private vulnerability-reporting interface for this repository when it is available. If that interface is not available, contact the repository owner privately through GitHub before publishing technical details.

A useful report includes the affected commit or deployment, reproduction steps, expected versus observed behavior, and the security impact. Do not include real user data or privileged credentials in a report.

## Security boundaries

Still's browser bundle may contain Supabase publishable configuration because publishable keys are intended for client applications. Authorization is enforced by Supabase row-level security and security-invoker database functions. Service-role keys and other privileged secrets must never be committed or exposed to the client.

Supabase cloud sync is account-scoped but is not an end-to-end encrypted vault with user-only keys. Product privacy language must not claim otherwise. See `DATA_AND_PRIVACY.md` for the canonical storage, synchronization, third-party weather, device-state, and recovery boundaries.

Security-sensitive database changes should include pgTAP/RLS regression coverage and must pass the `database-security` CI job before release.
