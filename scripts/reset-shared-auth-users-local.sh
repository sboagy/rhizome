#!/usr/bin/env bash
# reset-shared-auth-users-local.sh
#
# Resets auth users in the local Supabase instance, then re-seeds the shared
# workspace test identities.
#
# Default mode:  deletes only the 8 managed test UUIDs (safe for local dev
#               environments shared with real accounts).
# --all mode:    deletes EVERY row in auth.users and all dependent tables,
#               then re-seeds.  Use this when you want a completely clean slate.
#
# Usage (from any app or the rhizome root):
#   bash scripts/reset-shared-auth-users-local.sh           # managed UUIDs only
#   bash scripts/reset-shared-auth-users-local.sh --all     # wipe everything
#
# Environment overrides:
#   DB_PORT   Supabase local DB port (default: 54322)
#   DB_URL    Full psql connection string (overrides DB_PORT when set)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PORT="${DB_PORT:-54322}"
DB_URL="${DB_URL:-postgres://postgres:postgres@localhost:${DB_PORT}/postgres}"
SEED_FILE="${SCRIPT_DIR}/../supabase/seeds/00_shared_test_auth_users.sql"

# ---------------------------------------------------------------------------
# Parse flags.
# ---------------------------------------------------------------------------
RESET_ALL=false
for arg in "$@"; do
  case "$arg" in
    --all) RESET_ALL=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# The UUIDs below are the ONLY rows touched in default (non---all) mode.
# They correspond to the shared test identities in 00_shared_test_auth_users.sql.
# ---------------------------------------------------------------------------
MANAGED_IDS="(
  '00000000-0000-4000-8000-000000009001',
  '00000000-0000-4000-8000-000000009002',
  '00000000-0000-4000-8000-000000009004',
  '00000000-0000-4000-8000-000000009005',
  '00000000-0000-4000-8000-000000009006',
  '00000000-0000-4000-8000-000000009007',
  '00000000-0000-4000-8000-000000009008',
  '00000000-0000-4000-8000-000000009009',
  '5d1e503e-2404-46f0-9cde-8dd2eb63a611'
)"

# ---------------------------------------------------------------------------
# Delete auth rows, either scoped to managed UUIDs or all users.
#
# Deletion order respects FK dependencies so we don't rely on CASCADE
# behaviour (which can differ between Supabase versions):
#
#   mfa_amr_claims  →  sessions
#   refresh_tokens  →  sessions
#   sessions        →  users
#   mfa_factors     →  users
#   one_time_tokens →  users
#   identities      →  users
#   users           (root)
# ---------------------------------------------------------------------------
if [[ "${RESET_ALL}" == "true" ]]; then
  echo ">> [--all] Deleting ALL auth users and dependent rows..."
  psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;

DELETE FROM auth.mfa_amr_claims;
DELETE FROM auth.refresh_tokens;
DELETE FROM auth.sessions;
DELETE FROM auth.mfa_factors;
DELETE FROM auth.one_time_tokens;
DELETE FROM auth.identities;
DELETE FROM auth.users;

COMMIT;
SQL
  echo "   OK: all auth users deleted"
else
  echo ">> Deleting managed test auth users and all dependent auth rows..."
  psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 -q <<SQL
BEGIN;

-- MFA AMR claims reference sessions.
DELETE FROM auth.mfa_amr_claims
WHERE session_id IN (
  SELECT id FROM auth.sessions WHERE user_id IN ${MANAGED_IDS}
);

-- Refresh tokens reference sessions.
DELETE FROM auth.refresh_tokens
WHERE session_id IN (
  SELECT id FROM auth.sessions WHERE user_id IN ${MANAGED_IDS}
);

-- Sessions reference users.
DELETE FROM auth.sessions
WHERE user_id IN ${MANAGED_IDS};

-- MFA factors reference users.
DELETE FROM auth.mfa_factors
WHERE user_id IN ${MANAGED_IDS};

-- One-time tokens reference users (present in recent Supabase versions).
DELETE FROM auth.one_time_tokens
WHERE user_id IN ${MANAGED_IDS};

-- Identities reference users.
DELETE FROM auth.identities
WHERE user_id IN ${MANAGED_IDS};

-- Delete the users themselves last.
DELETE FROM auth.users
WHERE id IN ${MANAGED_IDS};

COMMIT;
SQL
  echo "   OK: managed test auth users deleted"
fi

# ---------------------------------------------------------------------------
# Re-seed the managed users from the shared seed file.
# ---------------------------------------------------------------------------
if [[ ! -f "${SEED_FILE}" ]]; then
    echo "Missing seed file: ${SEED_FILE}" >&2
    exit 1
fi

echo ">> Re-seeding shared auth users: ${SEED_FILE##*/}"
psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 -f "${SEED_FILE}" -q
echo "   OK: shared auth users reset complete"
