-- CREATE DATABASE cannot run inside a DO block or transaction,
-- so it lives in its own file. Run after setup-db.sql:
--
--   psql -U postgres -f scripts/create-database.sql
--
-- If the database already exists, psql reports an error you can ignore.

CREATE DATABASE peditrack OWNER peditrack;
