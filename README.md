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
npm run db:seed
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
| `npm test`                 | Unit tests (Vitest)                   |
| `npm run test:e2e`         | Browser tests (Playwright)            |
| `npm run db:generate`      | Write a migration from schema changes |
| `npm run db:migrate`       | Apply pending migrations              |
| `npm run db:seed`          | Insert reference data (place types)   |
| `npm run db:studio`        | Browse the database                   |
| `npm run auth:generate`    | Regenerate Better Auth tables         |
| `npm run make-super-admin` | Promote an account to super admin     |
| `npm run icons`            | Redraw the app icons into `public/`   |

Run `npm run auth:generate` after changing the plugin list in `src/lib/auth.ts`,
then `npm run db:generate && npm run db:migrate` to turn the regenerated schema
into SQL.

## Testing

Unit tests (`npm test`) cover pure logic. Browser tests (`npm run test:e2e`) drive
real flows through Chromium and need their own database, which they truncate
before each run:

```bash
createdb easy_check_in_e2e
DATABASE_URL="postgresql://localhost:5432/easy_check_in_e2e" npm run db:migrate
npm run test:e2e
```

Point `E2E_DATABASE_URL` elsewhere if that name or host does not suit.

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
- Building with `BUILD_STANDALONE=1` emits a self-contained server bundle for
  containerising the app later. It is off by default because `next start`
  refuses to serve a standalone build, and Vercel ignores the setting anyway.

All timestamps are stored in UTC and rendered in the viewer's local timezone.

### Installing it as an app

The app is a PWA: a manifest and a minimal service worker make it installable to
a phone's home screen, where it opens without browser chrome. Android shows its
own install prompt; iOS has none, so the app tells the user to use Share → Add
to Home Screen.

The service worker caches nothing on purpose. Every screen reflects live
check-in state, and showing someone as checked in when they are not is the one
mistake this app must never make.

Icons are drawn by `npm run icons`, which renders the geofence mark and encodes
the PNGs with Node's own zlib — no image toolchain, and identical output on any
machine. Re-run it if the brand colours change.

### What location tracking this app does and does not do

Location is read **only when the user presses a button** — checking in, checking
out, or storing a location mid-visit. Nothing is sampled in the background and
nothing is recorded between those presses, which is what the consent screen
promises.

This is a deliberate limit, not an oversight. No browser can read location in
the background: iOS suspends a backgrounded web app within seconds, and the web
platform has no geofencing API. Continuous presence tracking would require
wrapping this same frontend in Capacitor and shipping through the app stores.

Because of that, a visit left open is closed at the organization's cap (12 hours
by default) rather than tracked to its real end, and the report marks it as
closed automatically.

### Maps

Admins place a pin with Leaflet. Tiles come from OpenStreetMap and address
search from [Photon](https://photon.komoot.io), both free and keyless — Photon
specifically because the public Nominatim API forbids search-as-you-type.
Requests go through `/api/geocode` so the upstream can be swapped for a keyed
provider (Geoapify, LocationIQ) without touching the client.

Both services run on fair use. If this grows beyond light traffic, move to a
paid tile and geocoding provider, and keep the "© OpenStreetMap contributors"
attribution visible on the map — it is a licence condition, not decoration.

## Deployment

Deploys to Vercel as-is. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and
`BETTER_AUTH_URL` (your deployed origin) as environment variables, and point
`DATABASE_URL` at a Neon pooled connection string.

Note that Vercel's Hobby plan is for non-commercial use. If this becomes a paid
service, move to a Pro plan or self-host the standalone build.
