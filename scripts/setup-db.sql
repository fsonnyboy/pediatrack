-- ═══════════════════════════════════════════════════════
--  PediTrack — one-time local database setup
--  Run once as a PostgreSQL superuser (usually "postgres"):
--
--    psql -U postgres -f scripts/setup-db.sql
--
--  Change the password below before running.
-- ═══════════════════════════════════════════════════════

-- Create the application role.
-- Postgres has no "CREATE ROLE IF NOT EXISTS", so this is wrapped
-- in a DO block that skips creation when the role already exists.
DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'peditrack') THEN
    CREATE ROLE peditrack WITH LOGIN PASSWORD 'peditrack_dev';
  END IF;
END
$$;

-- Prisma Migrate needs to create and drop a shadow database during
-- development migrations, which requires CREATEDB on the role.
ALTER ROLE peditrack CREATEDB;
