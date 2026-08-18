#!/usr/bin/env bash
#
# Seed the Supabase database, without hand-editing a connection string.
#
# The connection string has to carry the database password inline, which means
# pasting a long URL and swapping one word inside it — easy to get wrong, and
# the failure ("password authentication failed") does not say which part was
# wrong. This asks for the pieces instead and assembles the URL itself.
#
#   bash scripts/seed-supabase.sh
#
# Passwords are read with the terminal echo off, so nothing appears on screen
# or in your shell history.

set -euo pipefail

# The project-specific part of the connection string. Everything except the
# password, which is the only thing that differs per person.
PROJECT_REF='postgres.mtisvygwkhakwebsaaya'
DB_HOST='aws-1-eu-west-1.pooler.supabase.com'
DB_PORT='6543' # transaction pooler — NOT 5432, which runs out of connections

cd "$(dirname "$0")/.."

echo
echo "Be Whole Care — database seed"
echo "-----------------------------"
echo "Supabase project: ${PROJECT_REF#postgres.}"
echo

# --- database password ------------------------------------------------------
# Set when the Supabase project was created. If it is lost it cannot be shown
# again — reset it under Settings -> Database -> Reset database password.
read -rsp "Supabase DATABASE password: " DB_PASSWORD
echo
if [ -z "$DB_PASSWORD" ]; then
  echo "No password entered. Nothing was changed." >&2
  exit 1
fi

# --- the account the practice will sign in with -----------------------------
read -rp "Owner's sign-in email [bewholecare@gmail.com]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-bewholecare@gmail.com}"

read -rsp "Password to set for that account (8+ characters): " ADMIN_PASSWORD
echo
if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  echo "That password is too short. Nothing was changed." >&2
  exit 1
fi

# Percent-encode the database password. A '@' or '/' inside it would otherwise
# be read as part of the URL structure and produce a misleading auth failure.
ENCODED_PASSWORD="$(DB_PASSWORD="$DB_PASSWORD" node -e \
  'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')"

export DATABASE_URL="postgresql://${PROJECT_REF}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

echo
node scripts/seed-postgres.mjs --admin "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"

echo
echo "Done. Next: add DATABASE_URL to Vercel, then redeploy."
echo "The value to paste there is the same URL this script just built:"
echo "  postgresql://${PROJECT_REF}:<your-db-password>@${DB_HOST}:${DB_PORT}/postgres"
