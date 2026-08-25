# PediTrack Mobile — Parents Portal

*Planned. This workspace is a placeholder; the backend it depends on is already built.*

The parents portal lets guardians view their child's health records, book appointments, and receive vaccine reminders — reading from the same NestJS API the clinic dashboard uses.

## Why this is straightforward to add

The backend was designed for it from the start:

| Already in place | Where |
|---|---|
| `PARENT` role | `UserRole` enum in `packages/database/prisma/schema.prisma` |
| Guardian → account link | `guardians.userId` column |
| Shared types | `@peditrack/types` — framework-agnostic, imports into React Native as-is |
| Shared helpers | `@peditrack/utils` — age calculation, formatting, medical thresholds |

No new database, no duplicated business logic, no second API.

## Getting started

```bash
cd apps/mobile
npx create-expo-app@latest . --template
npx expo install expo-router expo-notifications expo-secure-store
npm install @tanstack/react-query zustand
```

## Planned screens

| Screen | Purpose |
|---|---|
| Login | Parent authentication |
| Home | Next appointment, vaccines due, active medicines |
| Child profile | Switch between children, view the health summary |
| Vaccine card | Immunization history and upcoming doses |
| Appointments | Request, view and cancel bookings |
| Prescriptions | Active medicines with dosage instructions |
| Growth | Weight and height charted over time |

## Backend work required

1. **`POST /auth/parent-login`** — issues a token with `role: PARENT`.
2. **A `ParentGuard`** — resolves the authenticated user's `guardian` records and scopes every patient query to their own children. This must be enforced in the service layer, not the controller, so no route can accidentally leak another family's records.
3. **`GET /parent/children`** — the patients linked to the signed-in guardian.
4. **Push notifications** — an Expo push token per device, and a scheduled job that reads `vaccination_records.nextDueDate` to send reminders.

## Security note

Row-level scoping is the critical piece. A parent must never be able to reach another patient's record by changing an ID in a request. Every parent-facing query filters on the authenticated guardian's `patientId` list — enforced server-side, never by hiding UI.

Store the auth token in `expo-secure-store` (Keychain/Keystore), not `AsyncStorage`.
