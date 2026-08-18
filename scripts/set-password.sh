#!/usr/bin/env bash
#
# Set (or reset) the password on a staff account.
#
#   bash scripts/set-password.sh
#
# The seed script deliberately leaves an existing account alone, so it cannot
# be used to change a forgotten password. The app's own reset flow needs email
# delivery, which is not configured yet — so this is the way in.
#
# It also lists the accounts that exist, which answers "which email do I sign
# in with?" without guessing.

set -euo pipefail

PROJECT_REF='postgres.mtisvygwkhakwebsaaya'
DB_HOST='aws-1-eu-west-1.pooler.supabase.com'
DB_PORT='6543'

cd "$(dirname "$0")/.."

echo
read -rsp "Supabase DATABASE password: " DB_PASSWORD
echo
[ -n "$DB_PASSWORD" ] || { echo "Nothing entered." >&2; exit 1; }

ENCODED_PASSWORD="$(DB_PASSWORD="$DB_PASSWORD" node -e \
  'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')"
export DATABASE_URL="postgresql://${PROJECT_REF}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

# Show who can sign in, before asking which one to change.
node --input-type=module -e '
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const rows = await sql`select email, role from users where role <> ${"CLIENT"} order by role desc`;
console.log("");
if (rows.length === 0) {
  console.log("  No staff accounts exist. Run scripts/seed-supabase.sh first.");
} else {
  console.log("  Staff accounts that can reach /admin:");
  for (const r of rows) console.log("    " + r.email + "  (" + r.role + ")");
}
await sql.end();
'

echo
read -rp "Email to set a password for: " EMAIL
[ -n "$EMAIL" ] || { echo "Nothing entered." >&2; exit 1; }

read -rsp "New password (8+ characters): " NEW_PASSWORD
echo
if [ "${#NEW_PASSWORD}" -lt 8 ]; then
  echo "Too short. Nothing changed." >&2
  exit 1
fi

EMAIL="$EMAIL" NEW_PASSWORD="$NEW_PASSWORD" node --input-type=module -e '
import crypto from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";

// Must match lib/auth/password.ts exactly, or the app cannot verify the hash.
const scrypt = promisify(crypto.scrypt);
const params = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const salt = crypto.randomBytes(16);
const derived = await scrypt(process.env.NEW_PASSWORD.normalize("NFKC"), salt, 64, params);
const hash = `scrypt$${params.N}$${params.r}$${params.p}$${salt.toString("base64")}$${derived.toString("base64")}`;

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const rows = await sql`
  update users set password_hash = ${hash}, updated_at = now()
  where email = ${process.env.EMAIL}
  returning email, role`;

if (rows.length === 0) {
  console.log("");
  console.log("  No account with that email. Nothing changed.");
  await sql.end();
  process.exit(1);
}

// Existing sessions were signed against the old state; drop them so a
// forgotten password cannot be left logged in somewhere.
await sql`delete from sessions where user_id in (select id from users where email = ${process.env.EMAIL})`;

console.log("");
console.log("  Password updated for " + rows[0].email + " (" + rows[0].role + ")");
console.log("  Any existing sessions for that account were signed out.");
console.log("");
await sql.end();
'
