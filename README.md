## Setup

1. Copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `OWNER_EMAIL` (or `ALLOWED_EMAILS`)
2. Apply database migrations:

```bash
npm run db:migrate
```

## Development

Run the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Authentication and Access Control

- App access is protected with Supabase magic link auth.
- Only emails in `OWNER_EMAIL` / `ALLOWED_EMAILS` can access the app.
- Row-level security (RLS) enforces per-user data access in Supabase for ledger tables.

## Deployment Notes

- Disable open signups in Supabase Auth settings.
- Keep all secret values only in server env vars.
- Rotate keys if any sensitive files were ever exposed.

## Tech

- Next.js App Router
- Supabase (Auth + Postgres + RLS)
