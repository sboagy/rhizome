#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DB_PORT="${DB_PORT:-54322}"
DB_URL="${DB_URL:-postgres://postgres:postgres@localhost:${DB_PORT}/postgres}"
SEED_FILE="${REPO_ROOT}/supabase/seeds/00_shared_test_auth_users.sql"

TEST_PASSWORD="${ALICE_TEST_PASSWORD:-${TEST_USER_PASSWORD:-}}"

if [[ ! -f "${SEED_FILE}" ]]; then
    echo "Missing seed file: ${SEED_FILE}" >&2
    exit 1
fi

if [[ -z "${TEST_PASSWORD}" ]]; then
    echo "Missing ALICE_TEST_PASSWORD or TEST_USER_PASSWORD. Inject the shared test password from 1Password before running this script." >&2
    exit 1
fi

echo ">> Applying shared auth seed: ${SEED_FILE##*/}"
psql -d "${DB_URL}" --no-psqlrc -v ON_ERROR_STOP=1 -v test_password="${TEST_PASSWORD}" -f "${SEED_FILE}" -q
echo "   OK: shared auth users seeded"
