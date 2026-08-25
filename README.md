# PediTrack

**Pediatric clinic management platform** — patient records, check-ups, bookings, vaccinations and prescriptions in one system.

Built as a production-ready MVP on a Turborepo monorepo, structured so a parent-facing mobile app can be added without touching the backend.

---

## Stack

| Layer     | Technology |
|-----------|------------|
| Backend   | NestJS 10, Prisma 5, PostgreSQL 16, JWT + Passport |
| Frontend  | Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query |
| Mobile    | React Native + Expo *(planned — API is ready)* |
| Tooling   | Turborepo, Docker Compose, Jest |

---

## Quick start

**Requirements:** Node 20+, Docker Desktop.

```bash
# 1. Install dependencies
npm install

# 2. Copy the environment file (defaults already match docker-compose.yml)
cp .env.example .env

# 3. Start the database, migrate and seed — one command
npm run setup

# 4. Run the API and web app together
npm run dev
```

> **Port note.** The Postgres container publishes on host port **5433**, not
> 5432. That keeps it from colliding with a PostgreSQL you may already have
> installed on the machine. Inside the container it is still 5432 — only the
> host mapping differs, and `DATABASE_URL` already points at 5433.
>
> Connecting with a GUI client? Use `localhost:5433`, user `peditrack`,
> password `peditrack_dev`, database `peditrack`.

Verify the connection at any time with `npm run db:check` — it reports whether
the server is reachable, whether the credentials work, and whether the schema
has been created.

| Service          | URL |
|------------------|-----|
| Web dashboard    | http://localhost:3000 |
| API              | http://localhost:3001/api/v1 |
| Swagger docs     | http://localhost:3001/api/docs |
| Prisma Studio    | `npm run db:studio` |

### Demo accounts

Each seeded account gets a **unique random password**, generated at seed time and
printed once to stdout when you run `npm run db:seed`. Copy them to a password
manager immediately — they are not stored anywhere and re-running the seed does
not regenerate them for existing accounts.

| Role         | Email |
|--------------|-------|
| Admin        | admin@peditrack.app |
| Doctor       | doctor@peditrack.app |
| Nurse        | nurse@peditrack.app |
| Receptionist | reception@peditrack.app |

---

## Project structure

```
peditrack/
├── apps/
│   ├── api/          NestJS REST API
│   ├── web/          Next.js clinic dashboard
│   └── mobile/       React Native parents portal (placeholder)
├── packages/
│   ├── database/     Prisma schema, migrations and seed
│   ├── types/        Shared TypeScript interfaces
│   └── utils/        Date, format and medical helpers
└── docker-compose.yml
```

The `packages/types` and `packages/utils` workspaces are consumed by **all three** apps. When the mobile app is built it imports the same `Patient`, `Appointment` and `VaccinationRecord` types the web dashboard uses — there is no second source of truth.

---

## Features

**Patients** — Auto-generated medical record numbers (`PT-2026-00001`), guardian records, allergies, chronic conditions, birth details, and soft delete so clinical history is never destroyed.

**Appointments** — Booking with double-booking prevention (overlapping slots for the same doctor are rejected), status workflow from pending through completed, and per-visit vital signs and clinical notes.

**Vaccinations** — A seeded WHO/EPI-aligned schedule of 12 childhood vaccines. Next-dose dates are calculated automatically from each vaccine's interval, and the tracker surfaces overdue patients first.

**Prescriptions** — Multi-medicine prescriptions with dosage, frequency and duration. The API rejects a prescription whose medicine matches a recorded patient allergy rather than writing it silently.

**Growth tracking** — Weight, height and head circumference plotted against age in months, seeded with the child's birth measurements as the first data point.

**Roles** — `ADMIN`, `DOCTOR`, `NURSE`, `RECEPTIONIST`, enforced by guards on the API and mirrored in the UI. A `PARENT` role is already in the schema for the mobile app.

---

## Commands

```bash
npm run dev           # Run all apps in watch mode
npm run build         # Build everything
npm run test          # Run the test suite
npm run type-check    # Type-check all workspaces
npm run lint          # Lint all workspaces

npm run db:migrate    # Create and apply a migration
npm run db:seed       # Re-seed demo data
npm run db:studio     # Open Prisma Studio
npm run db:reset      # Drop and recreate the database

npm run docker:up     # Start Postgres, Redis, Mailhog
npm run docker:down   # Stop them
```

---

## Testing

```bash
npm run test                        # everything
npm run test -w @peditrack/api      # API only
npm run test:cov -w @peditrack/api  # with coverage
```

The API suite covers the logic most likely to cause real harm if it breaks: MRN generation and collision handling, appointment overlap detection, allergy-conflict rejection on prescriptions, and BMI calculation.

---

## Deployment

Each app has its own Dockerfile with a multi-stage build.

```bash
docker compose -f docker-compose.prod.yml up --build
```

**Suggested production targets:** API on Railway, Fly.io or AWS ECS · Web on Vercel · Database on Supabase, Neon or RDS · Redis on Upstash · Mobile via Expo EAS.

Before going live: set a real 256-bit `JWT_SECRET`, restrict `CORS_ORIGINS` to your domains, enable TLS, and configure automated database backups.

---

## Adding the mobile app

The backend is already prepared for it:

1. The `PARENT` role exists in the `UserRole` enum.
2. `guardians.userId` links a guardian record to a login account.
3. Shared types and utils are framework-agnostic — they import cleanly into React Native.

```bash
cd apps/mobile
npx create-expo-app@latest . --template
```

Add a `/auth/parent-login` endpoint and scope every patient query by the authenticated guardian's linked patients. See `apps/mobile/README.md` for the full plan.

---

## Security notes

Passwords are hashed with bcrypt (12 rounds). Every route is protected by default — endpoints opt out explicitly with `@Public()`. The JWT strategy re-reads the user on every request, so deactivating an account revokes access immediately rather than at token expiry. Login returns the same message for an unknown email and a wrong password so the endpoint cannot be used to enumerate registered addresses. All input is validated by class-validator DTOs with a whitelist, and an audit log table records access to clinical records.

This system stores personal health information. Before handling real patient data, review your local health data regulations (HIPAA, GDPR, the Philippines' Data Privacy Act, or whatever applies in your jurisdiction) — the technical measures here are a foundation, not a compliance certification.
