#!/usr/bin/env bash
#
# Test the Supabase database password on its own.
#
#   bash scripts/check-db.sh
#
# The seed script does several things, so a failure part-way is ambiguous. This
# does exactly one: connect, and report why it could not. It also reports how
# many characters it received, which catches the two most common causes —
# nothing typed at the invisible prompt, or a partial paste.

set -euo pipefail

PROJECT_REF='postgres.mtisvygwkhakwebsaaya'
DB_HOST='aws-1-eu-west-1.pooler.supabase.com'
DB_PORT='6543'

cd "$(dirname "$0")/.."

echo
read -rsp "Supabase DATABASE password: " DB_PASSWORD
echo
echo
echo "Received ${#DB_PASSWORD} characters."

if [ "${#DB_PASSWORD}" -eq 0 ]; then
  echo "That is empty — the prompt shows nothing as you type, but it does record"
  echo "what you type. Paste with Cmd-V instead."
  exit 1
fi

ENCODED_PASSWORD="$(DB_PASSWORD="$DB_PASSWORD" node -e \
  'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')"

export DATABASE_URL="postgresql://${PROJECT_REF}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

node --input-type=module -e '
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  connect_timeout: 15,
  idle_timeout: 2,
  max: 1,
});

try {
  const [{ now }] = await sql`select now() as now`;
  const [{ n }] = await sql`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = ${"public"}
  `;
  console.log("");
  console.log("  CONNECTED.");
  console.log("  Server time : " + now.toISOString());
  console.log("  Tables found: " + n + " (expect 22 if the schema ran)");
  console.log("");
  console.log("  The password is correct. Run: bash scripts/seed-supabase.sh");
  await sql.end();
} catch (error) {
  console.log("");
  console.log("  FAILED: " + error.message);
  console.log("");
  if (/password authentication/i.test(error.message)) {
    console.log("  The password is wrong. Things to check:");
    console.log("   - It is the DATABASE password, not your supabase.com login.");
    console.log("   - If you just reset it, copy the NEW one from the dialog;");
    console.log("     it is only shown at that moment.");
    console.log("   - Paste it (Cmd-V) rather than typing it.");
  } else if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(error.message)) {
    console.log("  That is a network problem, not a password problem.");
  }
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
}
'
