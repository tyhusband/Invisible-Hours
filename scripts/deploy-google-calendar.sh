#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_REF="bxrrtxynkeawzjrmcxda"

: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID first}"
: "${GOOGLE_CLIENT_SECRET:?Set GOOGLE_CLIENT_SECRET first}"

echo "Checking Supabase CLI auth..."
if ! npx supabase projects list >/dev/null 2>&1; then
  echo "Not logged in. Running: npx supabase login"
  npx supabase login
fi

echo "Linking project $PROJECT_REF..."
npx supabase link --project-ref "$PROJECT_REF"

echo "Setting Google OAuth secrets..."
npx supabase secrets set \
  GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID" \
  GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"

echo "Deploying Google Calendar Edge Functions..."
npx supabase functions deploy google-calendar-auth
npx supabase functions deploy google-calendar-events
npx supabase functions deploy google-calendar-disconnect

echo "Done. Refresh the app and try Connect Google Calendar."
