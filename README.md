# Easy Check-In

A location-based check-in app for gyms and offices. Members tap one button to
check in at a place they're physically standing near; admins get monthly reports
of who was where, and for how long.

Built as a PWA so it runs on any phone without an app store.

## Requirements

- **Node 22.13 or newer** (`.nvmrc` pins 22.13.1 — run `nvm use`). Older 22.x
  releases break the Better Auth CLI and ESLint's dependencies.
- **PostgreSQL** — [Neon](https://neon.com) free tier in production, or any
  local Postgres for development.

## Setup

```bash
nvm use
npm install
```

Create a `.env.local` file in the project root:

```bash
# Any PostgreSQL URL. For Neon use the POOLED string (host contains "-pooler").
DATABASE_URL="postgresql://user@localhost:5432/easy_check_in"

# Generate with: openssl rand -base64 32
BETTER_AUTH_SECRET="<paste a long random string>"

# The app's public origin. Locally this is http://localhost:3000.
BETTER_AUTH_URL="http://localhost:3000"
```

Create the database and apply the schema:

```bash
createdb easy_check_in     # skip if you already have a database
npm run db:migrate
npm run dev
```

Then sign up at <http://localhost:3000/sign-up> and promote yourself to super
admin so you can create organizations:

```bash
npm run make-super-admin -- you@example.com
```

## Roles

| Role            | Can do                                                           |
| --------------- | ---------------------------------------------------------------- |
| **Super admin** | Create organizations, assign org admins, see everything          |
| **Org admin**   | Manage one organization: members, join requests, places, reports |
| **Member**      | Check in and out, see their own history                          |

Super admin is an account-level flag set by `make-super-admin`. The other two are
per-organization roles.

## Scripts

| Command                    | What it does                          |
| -------------------------- | ------------------------------------- |
| `npm run dev`              | Start the dev server                  |
| `npm run build`            | Production build                      |
| `npm run typecheck`        | TypeScript, no emit                   |
| `npm run lint`             | ESLint                                |
| `npm test`                 | Vitest                                |
| `npm run db:generate`      | Write a migration from schema changes |
| `npm run db:migrate`       | Apply pending migrations              |
| `npm run db:studio`        | Browse the database                   |
| `npm run auth:generate`    | Regenerate Better Auth tables         |
| `npm run make-super-admin` | Promote an account to super admin     |

Run `npm run auth:generate` after changing the plugin list in `src/lib/auth.ts`,
then `npm run db:generate && npm run db:migrate` to turn the regenerated schema
into SQL.

## Architecture

- **Next.js App Router** — server actions for anything the UI triggers; route
  handlers only where a non-React client calls in (auth, CSV download, the
  geocoding proxy).
- **Drizzle ORM** over the standard `pg` driver, so the same code runs against
  Neon, a local Postgres, or RDS with no changes.
- **Better Auth** with the username, organization, and admin plugins. It owns the
  `user`, `session`, `account`, `verification`, `organization`, `member`, and
  `invitation` tables; everything else is defined in
  `src/lib/db/schema/app.ts`.
- `output: "standalone"` is set, so the app can be containerised and moved off
  Vercel later.

All timestamps are stored in UTC and rendered in the viewer's local timezone.

## Deployment

Deploys to Vercel as-is. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and
`BETTER_AUTH_URL` (your deployed origin) as environment variables, and point
`DATABASE_URL` at a Neon pooled connection string.

Note that Vercel's Hobby plan is for non-commercial use. If this becomes a paid
service, move to a Pro plan or self-host the standalone build.
