# Still

Still is an offline-first personal companion PWA built with React, TypeScript, Vite, Dexie, and Supabase. The browser keeps a durable local copy for offline use; signed-in accounts synchronize supported records through Supabase with row-level security.

## Local development

Requirements: Node.js 22 or newer and npm.

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` when you need a Supabase-backed local session. Client builds use a Supabase **publishable** key only; never put a service-role key or other privileged credential in the browser environment.

## Demo sandbox

The login screen includes **Open demo sandbox**. Demo mode requires no account, does not create a Supabase user, does not cloud-sync, and stores data in a separate `still-demo-local` IndexedDB database. Use **More → Demo sandbox** to reset or exit it.

## Quality gates

```bash
npm run format:check     # text-format baseline
npm run lint             # TypeScript + source hygiene
npm test                 # unit/regression suite
npm run security:audit   # npm vulnerability audit
npm run build            # production build
npm run build:budget     # bundle-size guardrail (after build)
```

CI also runs the headless-browser demo/IndexedDB integration test and a disposable local-Supabase pgTAP suite covering RLS and the sync RPC.

## Data and synchronization

- IndexedDB/Dexie is the local persistence layer.
- Supabase is the durable cloud copy for account-synchronized records.
- Sync conflicts resolve deterministically with logical record revisions rather than device wall-clock order.
- Deletions are represented by tombstones so offline devices cannot silently resurrect removed records.
- Device-specific browser state, such as notification permission, remains local.

Database schema changes belong in `supabase/migrations/`. Security-sensitive database behavior should have a corresponding test in `supabase/tests/database/`.

## Deployment

The GitHub Pages workflow builds Still under `/still/` and verifies the nested-base PWA output before deployment. Vercel configuration is also present in `vercel.json`.

See `RELEASE_CHECKLIST.md` for the release gates and repository settings expected before merging to `main`.

## Artwork and licensing

Bundled artwork is a significant part of this repository. See `ASSET_PROVENANCE.md` for the provenance policy. No open-source license has been declared for this repository, so do not assume redistribution rights for the application or its artwork.
