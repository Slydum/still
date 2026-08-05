# Still Supabase setup

Still uses Supabase as an optional cloud synchronization layer while keeping Dexie as the offline copy on each device.

## Project

- Project ref: `hkezdsmpdnpnwvmqgkrx`
- Region: Singapore (`ap-southeast-1`)
- Database migration: `migrations/20260805152000_create_still_sync_records.sql`

The browser application uses only the project's publishable key. Never add a secret key or service-role key to frontend code.

## Frontend environment

Copy `.env.example` to `.env.local` for local development and set:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Add the same variables to the Vercel project before deploying cloud sync. The application remains usable offline when they are missing, but cloud sync is disabled and shows a configuration message.

## Authentication URLs

Magic-link sign-in redirects back to `/more#cloud-sync`. In Supabase Dashboard, open **Authentication → URL Configuration** and configure:

1. The deployed Still origin as the Site URL.
2. The deployed origin followed by `/more#cloud-sync` as an allowed redirect URL.
3. `http://localhost:5173/more#cloud-sync` as an allowed redirect URL for local development.

Add preview deployment origins only when they are trusted and needed.

## Data model

`public.still_records` stores one row per user-owned application record. The composite primary key is `(user_id, record_type, record_id)`.

- Row Level Security is enabled.
- Authenticated users can access only rows where `auth.uid() = user_id`.
- Anonymous access is revoked.
- `sync_still_records(jsonb)` performs conflict-safe last-write-wins upserts.
- A tombstone wins when update timestamps are equal.

## Current synchronization behavior

Cloud sync runs after sign-in, when the user taps **Sync now**, and when a signed-in account is restored on the More screen. Local editing remains available offline.

The integration synchronizes tasks, events, journal entries, expenses, entity links, work shifts, and check-ins. Preferences and notifications remain device-local for now.

Local persistence writes explicit record-level changes instead of treating every item missing from a full in-memory array as deleted. This prevents a stale tab from creating tombstones for records it never observed.
