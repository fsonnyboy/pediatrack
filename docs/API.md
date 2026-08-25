# PediTrack API Reference

Base URL: `http://localhost:3001/api/v1`
Interactive docs: `http://localhost:3001/api/docs`

All endpoints require a `Authorization: Bearer <token>` header except `POST /auth/login`.

## Response format

Successful responses are wrapped:

```json
{ "success": true, "data": { }, "timestamp": "2026-08-23T10:00:00.000Z" }
```

Paginated responses carry a `meta` block alongside `data`:

```json
{
  "success": true,
  "data": [],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3,
            "hasNextPage": true, "hasPreviousPage": false },
  "timestamp": "2026-08-23T10:00:00.000Z"
}
```

Errors:

```json
{
  "success": false,
  "statusCode": 409,
  "message": "The doctor already has an appointment that overlaps this time slot",
  "error": "Conflict",
  "path": "/api/v1/appointments",
  "timestamp": "2026-08-23T10:00:00.000Z"
}
```

## Endpoints

### Auth
| Method | Path | Roles |
|---|---|---|
| POST | `/auth/login` | Public |
| GET | `/auth/me` | All |
| POST | `/auth/change-password` | All |
| POST | `/auth/logout` | All |

### Patients
| Method | Path | Roles |
|---|---|---|
| GET | `/patients` | All |
| POST | `/patients` | All |
| GET | `/patients/:id` | All |
| PATCH | `/patients/:id` | All |
| DELETE | `/patients/:id` | Admin, Doctor |
| GET | `/patients/:id/appointments` | All |
| GET | `/patients/:id/vaccinations` | All |
| GET | `/patients/:id/prescriptions` | All |
| GET | `/patients/:id/growth-chart` | All |
| GET | `/patients/:id/notes` | Admin, Doctor, Nurse |

`GET /patients` accepts `search`, `gender`, `ageGroup`, `page`, `limit`, `sortBy`, `sortOrder`.

### Appointments
| Method | Path | Roles |
|---|---|---|
| GET | `/appointments` | All |
| POST | `/appointments` | All |
| GET | `/appointments/:id` | All |
| PATCH | `/appointments/:id` | All |
| PATCH | `/appointments/:id/status` | All |
| POST | `/appointments/:id/vitals` | Admin, Doctor, Nurse |
| POST | `/appointments/:id/notes` | Admin, Doctor, Nurse |
| DELETE | `/appointments/:id` | Admin |

Booking returns **409 Conflict** when the slot overlaps an existing appointment for that doctor.

### Vaccinations
| Method | Path | Roles |
|---|---|---|
| GET | `/vaccines` | All |
| GET | `/vaccinations` | All |
| POST | `/vaccinations` | Admin, Doctor, Nurse |
| GET | `/vaccinations/due-soon?days=30` | All |
| GET | `/vaccinations/schedule/:patientId` | All |
| PATCH | `/vaccinations/:id` | Admin, Doctor, Nurse |
| DELETE | `/vaccinations/:id` | Admin |

### Prescriptions
| Method | Path | Roles |
|---|---|---|
| GET | `/prescriptions` | All |
| POST | `/prescriptions` | Admin, Doctor |
| GET | `/prescriptions/:id` | All |
| PATCH | `/prescriptions/:id/status` | Admin, Doctor |
| DELETE | `/prescriptions/:id` | Admin |

`POST /prescriptions` returns **400** when a prescribed medicine matches a recorded patient allergy.

### Dashboard
| Method | Path |
|---|---|
| GET | `/dashboard/stats` |
| GET | `/dashboard/overview` |
| GET | `/dashboard/upcoming?days=7` |
| GET | `/dashboard/today` |
| GET | `/dashboard/recent-patients?limit=8` |

### Users
| Method | Path | Roles |
|---|---|---|
| GET | `/users` | Admin |
| POST | `/users` | Admin |
| GET | `/users/doctors` | All |
| PATCH | `/users/:id` | Admin |
| DELETE | `/users/:id` | Admin |
