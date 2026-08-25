# Running without Docker (alternative)

> The default setup uses Docker — see the README. Use this only if you would
> rather point PediTrack at a PostgreSQL you installed directly on Windows.

Postgres is the only external dependency either way — rate limiting is
in-memory and nothing else needs a broker or cache.

---

## 1. Confirm PostgreSQL is running

**Windows** — open `services.msc` and look for a service named
`postgresql-x64-16` (or your version). It should say **Running**.
Or from PowerShell:

```powershell
Get-Service -Name postgresql*
```

**macOS**

```bash
brew services list
```

**Linux**

```bash
sudo systemctl status postgresql
```

If `psql` is not on your PATH on Windows, it lives at
`C:\Program Files\PostgreSQL\16\bin\psql.exe`.

---

## 2. Create the role and database

Run these once, as a superuser (normally `postgres`). You will be prompted
for the `postgres` account password.

```bash
psql -U postgres -f scripts/setup-db.sql
psql -U postgres -f scripts/create-database.sql
```

`setup-db.sql` creates a `peditrack` login role with the password
`peditrack_dev` and grants it `CREATEDB` — Prisma Migrate needs that in
development because it creates a temporary shadow database to diff
migrations against.

**Change the password** in `scripts/setup-db.sql` before running it if this
machine is shared.

Prefer to do it by hand instead? Two statements:

```sql
CREATE ROLE peditrack WITH LOGIN PASSWORD 'peditrack_dev' CREATEDB;
CREATE DATABASE peditrack OWNER peditrack;
```

### Using your existing `postgres` superuser instead

Skip `setup-db.sql`, create just the database, and point `DATABASE_URL` at
the `postgres` account:

```sql
CREATE DATABASE peditrack;
```

```
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/peditrack?schema=public"
```

---

## 3. Point the app at it

Open `.env` and set `DATABASE_URL`. A `.env` was generated for you with a
random `JWT_SECRET` already filled in — only the password needs changing:

```
DATABASE_URL="postgresql://peditrack:peditrack_dev@localhost:5432/peditrack?schema=public"
```

If your password contains `@ : / ? #` or a space, URL-encode it.
`p@ssw0rd` becomes `p%40ssw0rd` — otherwise the `@` is read as the start of
the hostname and the connection fails with a confusing parse error.

Non-default port? Change `5432` to match.

---

## 4. Verify before migrating

```bash
npm run db:check
```

This confirms the server is reachable, the credentials work, and reports
whether the schema has been created yet. It names the specific fix for each
failure rather than printing a driver stack trace.

---

## 5. Create the schema and seed

```bash
npm run db:migrate    # creates all 11 tables
npm run db:seed       # 12 vaccines, 4 staff accounts, 5 demo patients
```

---

## Troubleshooting

**`Can't reach database server at localhost:5432`**
Postgres is not running, or is listening on a different port. Check the
service, then confirm the port in `postgresql.conf`.

**`password authentication failed for user "peditrack"`**
The password in `DATABASE_URL` does not match what `setup-db.sql` created,
or a special character needs URL-encoding.

**`database "peditrack" does not exist`**
`create-database.sql` did not run. Run step 2 again.

**`P3014: could not create the shadow database`**
The role lacks `CREATEDB`. Run:

```sql
ALTER ROLE peditrack CREATEDB;
```

**`role "peditrack" already exists`** when running `setup-db.sql`
Harmless — the script is written to skip creation when the role is already
there. `create-database.sql` will still error if the database exists; that
is also safe to ignore.

**Starting over.** `npm run db:reset` drops the schema, re-runs every
migration and re-seeds. It destroys all data in the `peditrack` database, so
never point it at anything real.
