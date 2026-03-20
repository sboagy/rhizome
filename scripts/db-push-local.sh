#!/usr/bin/env bash
# =============================================================================
# rhizome/scripts/db-push-local.sh
#
# Orchestrates schema migrations and seeding for the shared local Supabase
# instance. Run this after `supabase start` from the rhizome directory.
#
# WHY THIS EXISTS
# ---------------
# The Supabase CLI tracks applied migrations in supabase_migrations.schema_migrations.
# That table is shared across the single Postgres instance, but each app repo's
# CLI only knows its own migration directory. Running `supabase db push --local`
# from tunetrees fails if it finds a cubefsrs migration version in the DB, and
# vice versa. This script bypasses that problem by applying all app migrations
# directly and managing the tracking table itself.
#
# USAGE
# -----
#   ./scripts/db-push-local.sh               # apply migrations + seeds
#   ./scripts/db-push-local.sh --migrations-only
#   ./scripts/db-push-local.sh --seed-only
#   ./scripts/db-push-local.sh --help
#
# ENVIRONMENT OVERRIDES
# ---------------------
#   TUNETREES_DIR   path to tunetrees repo root  (default: <gittt_root>/tunetrees)
#   CUBEFSRS_DIR    path to cubefsrs repo root   (default: <gittt_root>/oosync.worktrees/cf-e2e)
#   DB_PORT         Postgres port                (default: 54322)
#   DB_URL          postgres DSN                 (default: postgres://postgres:postgres@localhost:<DB_PORT>/postgres)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# This script lives in a worktree under <gittt_root>/rhizome.worktrees/<branch>/scripts,
# so GITTT_ROOT is three levels up: scripts -> rhizome-cubefsrs-e2e -> rhizome.worktrees -> gittt
GITTT_ROOT="$(cd "${REPO_ROOT}/../.." && pwd)"

TUNETREES_DIR="${TUNETREES_DIR:-${GITTT_ROOT}/tunetrees}"
CUBEFSRS_DIR="${CUBEFSRS_DIR:-${GITTT_ROOT}/oosync.worktrees/cf-e2e}"
DB_PORT="${DB_PORT:-54322}"
DB_URL="${DB_URL:-postgres://postgres:postgres@localhost:${DB_PORT}/postgres}"

MODE="${1:-all}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
    grep "^#" "$0" | head -40 | sed 's/^# \{0,1\}//'
    exit 0
fi

if [[ "${MODE}" != "all" && "${MODE}" != "--migrations-only" && "${MODE}" != "--seed-only" ]]; then
    echo "Unknown mode: ${MODE}. Use --migrations-only, --seed-only, or omit for all." >&2
    exit 1
fi

# Convenience wrapper -- avoids repeating connection flags everywhere.
pg() { PGPASSWORD=postgres psql -h localhost -p "${DB_PORT}" -U postgres postgres --no-psqlrc "$@"; }

log()      { printf '>> %s\n' "$*"; }
log_ok()   { printf '   OK: %s\n' "$*"; }
log_skip() { printf '   skip: %s (already applied)\n' "$*"; }
log_warn() { printf '   WARN: %s\n' "$*" >&2; }

# =============================================================================
# Migration application
# =============================================================================

# apply_migration <version> <name> <sql_file>
# Skips if version is already recorded in supabase_migrations.schema_migrations.
apply_migration() {
    local version="$1"
    local name="$2"
    local sql_file="$3"

    local count
    count=$(pg -qAt -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '${version}'")

    if [[ "${count}" -gt 0 ]]; then
        log_skip "${version} ${name}"
        return 0
    fi

    log "Applying ${version} ${name}  <- ${sql_file##*/}"
    pg -v ON_ERROR_STOP=1 -f "${sql_file}" -q

    # Record in the Supabase CLI migration tracking table.
    # columns: version TEXT PK, statements TEXT[] (nullable), name TEXT (nullable)
    pg -qAt -c "INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ('${version}', '${name}') ON CONFLICT (version) DO NOTHING"
    log_ok "${version} ${name}"
}

# collect_migrations_from <dir>
# Prints lines: "<version> <name> <absolute_path>" for each *.sql in <dir>.
collect_migrations_from() {
    local dir="$1"
    if [[ ! -d "${dir}" ]]; then
        log_warn "Migrations dir not found: ${dir}"
        return 0
    fi
    for f in "${dir}"/*.sql; do
        [[ -f "$f" ]] || continue
        local basename
        basename="$(basename "$f" .sql)"
        local version="${basename%%_*}"
        local name="${basename#*_}"
        printf '%s %s %s\n' "${version}" "${name}" "${f}"
    done
}

# =============================================================================
# MIGRATIONS
# =============================================================================

if [[ "${MODE}" != "--seed-only" ]]; then
    log "=== Applying migrations ==="

    # Collect migrations from all apps, sorted by version (timestamp prefix).
    # This ensures shared auth/extensions from tunetrees land before cubefsrs
    # schema objects that reference auth.users.
    declare -a all_migrations
    mapfile -t all_migrations < <(
        collect_migrations_from "${TUNETREES_DIR}/supabase/migrations"
        collect_migrations_from "${CUBEFSRS_DIR}/supabase/migrations"
    )

    if [[ ${#all_migrations[@]} -eq 0 ]]; then
        log_warn "No migration files found. Check TUNETREES_DIR (${TUNETREES_DIR}) and CUBEFSRS_DIR (${CUBEFSRS_DIR})."
    else
        # Sort by version field (first column, numeric timestamp prefix)
        while IFS=' ' read -r version name sql_file; do
            apply_migration "${version}" "${name}" "${sql_file}"
        done < <(printf '%s\n' "${all_migrations[@]}" | sort -k1,1)
    fi

    log "Migrations complete."
fi

# =============================================================================
# SEEDS
# =============================================================================

if [[ "${MODE}" != "--migrations-only" ]]; then
    log "=== Applying seeds ==="

    # ------------------------------------------------------------------
    # tunetrees baseline: a full pg_dump including auth.users, identities,
    # and all public schema data. NOT idempotent -- skip if auth.users
    # already has rows to avoid duplicate key errors on re-runs.
    # ------------------------------------------------------------------
    TT_SEED="${TUNETREES_DIR}/supabase/seeds/baseline_local_20260217.sql"
    if [[ ! -f "${TT_SEED}" ]]; then
        log_warn "tunetrees seed not found: ${TT_SEED}"
    else
        user_count=$(pg -qAt -c "SELECT COUNT(*) FROM auth.users")
        if [[ "${user_count}" -gt 0 ]]; then
            log_skip "tunetrees baseline seed (auth.users already has ${user_count} rows)"
        else
            log "Applying tunetrees baseline seed (auth.users + public schema data)..."
            pg -f "${TT_SEED}" -q
            log_ok "tunetrees baseline seed applied"
        fi
    fi

    # ------------------------------------------------------------------
    # cubefsrs global catalog: algorithm categories, subsets, and cases.
    # Uses ON CONFLICT DO NOTHING throughout -- safe to re-run at any time.
    # ------------------------------------------------------------------
    CF_SEED="${CUBEFSRS_DIR}/supabase/seeds/01_global_catalog.sql"
    if [[ ! -f "${CF_SEED}" ]]; then
        log_warn "cubefsrs catalog seed not found: ${CF_SEED}"
    else
        log "Applying cubefsrs global catalog seed..."
        pg -f "${CF_SEED}" -q
        log_ok "cubefsrs catalog seed applied"
    fi

    log "Seeds complete."
fi

log "=== Done ==="
