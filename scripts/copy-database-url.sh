#!/usr/bin/env bash
#
# Build the DATABASE_URL and copy it to the clipboard, ready to paste into
# Vercel's environment variables.
#
#   bash scripts/copy-database-url.sh
#
# Assembling this URL by hand means splicing a password into the middle of a
# long string — the step that failed repeatedly during setup. This does it, and
# prints nothing but the length so the value never appears on screen.

set -euo pipefail

PROJECT_REF='postgres.mtisvygwkhakwebsaaya'
DB_HOST='aws-1-eu-west-1.pooler.supabase.com'
DB_PORT='6543' # transaction pooler; 5432 exhausts connections on serverless

echo
read -rsp "Supabase DATABASE password: " DB_PASSWORD
echo

if [ -z "$DB_PASSWORD" ]; then
  echo "Nothing entered. Clipboard unchanged." >&2
  exit 1
fi

ENCODED_PASSWORD="$(DB_PASSWORD="$DB_PASSWORD" node -e \
  'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')"

URL="postgresql://${PROJECT_REF}:${ENCODED_PASSWORD}@${DB_HOST}:${DB_PORT}/postgres"

printf '%s' "$URL" | pbcopy

echo
echo "Copied to clipboard: ${#URL} characters."
echo "It starts postgresql://${PROJECT_REF}: and ends :${DB_PORT}/postgres"
echo
echo "Now, WITHOUT copying anything else:"
echo "  1. Vercel -> bewholecare-1 -> Settings -> Environment Variables"
echo "  2. Add Environment Variable"
echo "  3. Key:   DATABASE_URL"
echo "  4. Value: Cmd-V"
echo "  5. Environments: Production (and Preview)"
echo "  6. Save, then Redeploy"
