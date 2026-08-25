# Architecture Decisions

## Why a monorepo

The mobile app is coming. Without a monorepo, the `Patient` type would exist in three places and drift. Turborepo lets `apps/api`, `apps/web` and `apps/mobile` all import `@peditrack/types` and `@peditrack/utils` from a single source, with incremental builds so the whole thing does not rebuild on every change.

## Why NestJS over Express

Clinics accumulate features — billing, lab results, referrals, inventory. NestJS's module system means each of those arrives as a self-contained folder with its own controller, service and DTOs, rather than as another set of routes bolted onto a growing file. Dependency injection also makes the services testable without a database.

## Why Prisma

Schema-first with generated types. When a column is added to `patients`, the TypeScript type updates and every consumer that mishandles it fails to compile rather than failing in production. Migrations are versioned and reviewable.

## Soft deletes on clinical data

Patients and users are never hard-deleted — `deletedAt` is stamped instead. Medical records must remain auditable, and a foreign key from a five-year-old prescription to a deleted doctor would break history. Appointments *can* be hard-deleted, but only by an admin.

## Vitals are one row per visit

`vital_signs.appointmentId` is unique. A visit has one set of measurements; re-recording corrects them rather than appending a second reading. This keeps the growth chart honest — one point per visit, not one per keystroke.

## Allergy checking lives in the service, not the UI

`PrescriptionsService.create()` compares every prescribed medicine name and generic name against the patient's recorded allergies and rejects the write. Putting this in the frontend would mean the check disappears the moment the mobile app or an integration calls the API directly.

## Double-booking prevention

`assertSlotFree()` loads the doctor's appointments for that day and rejects any true overlap (each appointment starting before the other ends). Back-to-back bookings are allowed; a booking that starts exactly when the previous ends is fine. Cancelled and no-show appointments do not block a slot.

Under heavy concurrent booking this check has a race window between read and write. For a single clinic that is acceptable; at multi-branch scale, add a database-level exclusion constraint on `(doctor_id, tstzrange(scheduled_at, scheduled_at + duration))`.

## Every route is protected by default

`JwtAuthGuard` is registered globally. A new endpoint is authenticated unless someone deliberately adds `@Public()`. The inverse — remembering to add a guard to each new route — fails silently and eventually leaks data.

## The JWT strategy re-reads the user

`JwtStrategy.validate()` hits the database on every request rather than trusting the token payload. This costs one indexed lookup and buys immediate revocation: deactivating a staff account locks them out now, not whenever their seven-day token expires.

## MRN generation

`PT-{year}-{sequence}`. The sequence comes from the highest existing MRN for the year, not a row count — otherwise archiving a patient would cause the next registration to collide with an existing number.

## The PARENT role already exists

Adding it to the enum later would mean a migration on a live clinical database. It costs nothing now and `guardians.userId` is already there to link a guardian record to a login.
