# Work on Still from a phone terminal

The old zip-replacement workflow is no longer the supported way to update Still. Work from a normal Git checkout so migrations, CI configuration, security policy, and release documentation stay versioned together.

Requirements: Git, Node.js 22 or newer, and npm.

## First checkout

```bash
git clone https://github.com/Slydum/still.git
cd still
npm ci
npm run build
```

For a local Supabase-backed session, copy `.env.example` to `.env.local` and provide the publishable client configuration. Never place a service-role key or another privileged credential in the browser environment.

## Updating an existing checkout

```bash
cd still
git status
git pull --ff-only
npm ci
npm run format:check
npm run lint
npm test
npm run build
npm run build:budget
```

Resolve or commit local work before `git pull --ff-only`; do not overwrite the repository with an exported zip.

## Publishing changes

Create a branch, commit the complete change, push it, and open a pull request into `main`. The repository CI and GitHub Pages build should pass before merge. Database migrations must pass the disposable Supabase/pgTAP job before they are applied to production.

After merge, verify both the `main` CI run and the actual GitHub Pages **deploy** job. A successful pull-request Pages build is not proof that production was deployed.

See `README.md`, `DATA_AND_PRIVACY.md`, and `RELEASE_CHECKLIST.md` for the current architecture and release contract.
