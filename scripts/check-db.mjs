/**
 * Verifies that DATABASE_URL points at a reachable PostgreSQL server
 * before you run migrations. Gives a specific fix for each failure
 * mode rather than a raw driver stack trace.
 *
 *   npm run db:check
 */
import { readFileSync, existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', DIM = '\x1b[2m';
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const bad = (m) => console.log(`${RED}✗${RESET} ${m}`);
const hint = (m) => console.log(`  ${DIM}${m}${RESET}`);

if (!existsSync('.env')) {
  bad('No .env file found.');
  hint('Copy the template:  cp .env.example .env   (Windows: copy .env.example .env)');
  process.exit(1);
}

// Minimal .env parse — avoids needing dotenv before install completes.
// NOTE: the file wins over any pre-existing environment variable. A stray
// DATABASE_URL exported in the shell (or left over from another project) is
// exactly the kind of thing this script exists to surface, so it must not
// silently take precedence over what .env actually says.
const shellUrl = process.env.DATABASE_URL;
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const url = process.env.DATABASE_URL;

if (shellUrl && shellUrl !== url) {
  console.log(`${YELLOW}!${RESET} A DATABASE_URL was already set in your shell environment:`);
  hint(shellUrl.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@'));
  hint('Using the value from .env instead. If Prisma behaves differently from');
  hint('this check, that shell variable is why — unset it.');
  console.log('');
}

// Every workspace that runs Prisma must resolve to the same server.
const strays = ['packages/database/.env', 'packages/database/prisma/.env', 'apps/api/.env'];
for (const f of strays) {
  if (!existsSync(f)) continue;
  const m = /^\s*DATABASE_URL\s*=\s*(.*)$/m.exec(readFileSync(f, 'utf8'));
  if (!m) continue;
  const other = m[1].trim().replace(/^["']|["']$/g, '');
  if (other !== url) {
    console.log(`${YELLOW}!${RESET} ${f} disagrees with the root .env:`);
    hint(other.replace(/:\/\/([^:]+):[^@]*@/, '://$1:****@'));
    hint('The Prisma CLI reads the .env nearest its working directory, so this');
    hint('file can override the root one. Make them match or remove it.');
    console.log('');
  }
}

if (!url) {
  bad('DATABASE_URL is not set in .env');
  process.exit(1);
}

if (url.includes('CHANGE_ME')) {
  bad('DATABASE_URL still contains the CHANGE_ME placeholder.');
  hint('Open .env and set your real PostgreSQL password.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  bad('DATABASE_URL is not a valid connection string.');
  hint('Expected: postgresql://user:password@host:port/database?schema=public');
  hint('If your password contains @ : / ? or #, URL-encode it (@ becomes %40).');
  process.exit(1);
}

console.log(`\nConnecting to ${DIM}${parsed.hostname}:${parsed.port || 5432}${RESET} ` +
            `as ${DIM}${parsed.username}${RESET}, database ${DIM}${parsed.pathname.slice(1)}${RESET}\n`);

const prisma = new PrismaClient();

try {
  const [{ version }] = await prisma.$queryRaw`SELECT version()`;
  ok('Connected');
  ok(version.split(',')[0]);

  const tables = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'
  `;
  const n = tables[0].n;

  if (n === 0) {
    console.log(`\n${YELLOW}!${RESET} The database is empty — no tables yet.`);
    hint('Run:  npm run db:migrate   then   npm run db:seed');
  } else {
    ok(`${n} table(s) present`);
  }
  console.log('');
} catch (e) {
  const msg = String(e.message);
  bad('Could not connect.\n');

  if (/ECONNREFUSED|Can't reach database server/i.test(msg)) {
    hint('PostgreSQL does not appear to be running, or the port is wrong.');
    hint('Windows: check "postgresql-x64-*" is Running in services.msc');
    hint('macOS:   brew services list');
    hint('Linux:   sudo systemctl status postgresql');
  } else if (/authentication failed|password/i.test(msg)) {
    hint('The username or password in DATABASE_URL was rejected.');
    hint('Re-check the password, and URL-encode any special characters.');
  } else if (/does not exist/i.test(msg)) {
    hint('The role or database does not exist yet. Run the setup scripts:');
    hint('  psql -U postgres -f scripts/setup-db.sql');
    hint('  psql -U postgres -f scripts/create-database.sql');
  } else {
    hint(msg.split('\n')[0]);
  }
  console.log('');
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
