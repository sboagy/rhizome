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
# from one app fails if it finds another app's migration version in the DB.
# This script bypasses that problem by applying all requested app migrations
# directly and managing the tracking table itself.
#
# USAGE
# -----
#   ./scripts/db-push-local.sh [mode] <app-dir> [app-dir2 ...]
#
#   mode (optional, must come first):
#     --migrations-only   apply migrations only, skip seeds
#     --seed-only         apply seeds only, skip migrations
#     --help | -h         print this help and exit
#
#   <app-dir>: path to an app repo root. Repeat for multiple apps.
#   Seeds in each app's supabase/seeds/ must be idempotent.
#
# EXAMPLES
# --------
#   # Single app, all steps:
#   ./scripts/db-push-local.sh /path/to/cubefsrs
#
#   # Two apps, all steps:
#   ./scripts/db-push-local.sh /path/to/cubefsrs /path/to/otherapp
#
#   # Migrations only:
#   ./scripts/db-push-local.sh --migrations-only /path/to/cubefsrs
#
#   # Seeds only for two apps:
#   ./scripts/db-push-local.sh --seed-only /path/to/cubefsrs /path/to/otherapp
#
# ENVIRONMENT OVERRIDES
# ---------------------
#   DB_PORT         Postgres port                (default: 54322)
#   DB_URL          postgres DSN                 (default: postgres://postgres:postgres@localhost:<DB_PORT>/postgres)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Parse optional mode flag (must be first argument if provided)
# ---------------------------------------------------------------------------
MODE="all"
case "${1:-}" in
    --migrations-only|--seed-only)
        MODE="$1"
        shift
        ;;
    --help|-h)
        grep "^#" "$0" | head -60 | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    --*)
        echo "Unknown flag: $1. Use --migrations-only, --seed-only, or --help." >&2
        exit 1
        ;;
esac

# ---------------------------------------------------------------------------
# Collect app directories from remaining positional arguments (APP_DIRS)
# ---------------------------------------------------------------------------
declare -a APP_DIRS=("$@")

if [[ ${#APP_DIRS[@]} -eq 0 ]]; then
    echo "" >&2
    echo "ERROR: No app directories provided." >&2
    echo "" >&2
    echo "  Provide one or more app repo root paths as positional arguments." >&2
    echo "" >&2
    echo "  Single app:" >&2
    echo "    ./scripts/db-push-local.sh /path/to/cubefsrs" >&2
    echo "" >&2
    echo "  Two apps:" >&2
    echo "    ./scripts/db-push-local.sh /path/to/cubefsrs /path/to/otherapp" >&2
    echo "" >&2
    echo "  With mode flag:" >&2
    echo "    ./scripts/db-push-local.sh --migrations-only /path/to/cubefsrs" >&2
    echo "" >&2
    exit 1
fi

DB_PORT="${DB_PORT:-54322}"
DB_URL="${DB_URL:-postgres://postgres:postgres@localhost:${DB_PORT}/postgres}"

# Convenience wrapper -- avoids repeating connection flags everywhere.
# Uses DB_URL so callers can override the connection string via environment.
pg() { psql -d "${DB_URL}" --no-psqlrc "$@"; }

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
    # Use shell interpolation rather than psql :'var' substitution; the :'var'
    # quoted form requires a minimum psql version and behaves inconsistently
    # across CI environments. `version` is always a 14-digit timestamp (safe to
    # embed directly) and `name` is derived from the migration filename (no
    # special chars). Single-quote any accidental apostrophes in name as a
    # precaution.
    local safe_name="${name//\'/\'\'}"
    count=$(pg -qAt -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = '${version}'")

    if [[ "${count}" -gt 0 ]]; then
        log_skip "${version} ${name}"
        return 0
    fi

    log "Applying ${version} ${name}  <- ${sql_file##*/}"
    pg -v ON_ERROR_STOP=1 -f "${sql_file}" -q

    # Record in the Supabase CLI migration tracking table.
    # columns: version TEXT PK, statements TEXT[] (nullable), name TEXT (nullable)
    pg -qAt \
        -c "INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES ('${version}', '${safe_name}') ON CONFLICT (version) DO NOTHING"
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

# apply_seed_file <seed_file> <app_name>
# Applies a seed file from one of the requested APP_DIRS.
# Non-idempotent baseline dumps (`baseline_local_*.sql`) are skipped once
# auth.users already has rows; all other seed files are applied as-is.
apply_seed_file() {
    local seed_file="$1"
    local app_name="$2"
    local seed_name
    seed_name="$(basename "${seed_file}")"

    if [[ "${seed_name}" == baseline_local_*.sql ]]; then
        local user_count
        user_count=$(pg -qAt -c "SELECT COUNT(*) FROM auth.users")
        if [[ "${user_count}" -gt 0 ]]; then
            log_skip "${seed_name} (${app_name}; auth.users already has ${user_count} rows)"
            return 0
        fi
    fi

    log "Applying seed: ${seed_name}  (${app_name})"
    pg -f "${seed_file}" -q
    log_ok "${seed_name}"
}

# =============================================================================
# MIGRATIONS
# =============================================================================

if [[ "${MODE}" != "--seed-only" ]]; then
    log "=== Applying migrations ==="

    # Collect migrations from the requested APP_DIRS, sorted by version
    # (timestamp prefix) so cross-app dependencies land in timestamp order.
    declare -a all_migrations
    mapfile -t all_migrations < <(
        for app_dir in "${APP_DIRS[@]}"; do
            collect_migrations_from "${app_dir}/supabase/migrations"
        done
    )

    if [[ ${#all_migrations[@]} -eq 0 ]]; then
        local_app_list="${APP_DIRS[*]}"
        log_warn "No migration files found in APP_DIRS (${local_app_list})."
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

    # Apply seed files from APP_DIRS in the order the app directories were
    # provided. Most seeds should be idempotent; baseline_local_*.sql dumps
    # are handled generically in apply_seed_file().
    for app_dir in "${APP_DIRS[@]}"; do
        seeds_dir="${app_dir}/supabase/seeds"
        if [[ ! -d "${seeds_dir}" ]]; then
            log_warn "No seeds dir found for app: ${app_dir}"
            continue
        fi
        shopt -s nullglob
        seed_files=("${seeds_dir}"/*.sql)
        shopt -u nullglob
        if [[ ${#seed_files[@]} -eq 0 ]]; then
            log_warn "No seed files in: ${seeds_dir}"
            continue
        fi
        for seed_file in "${seed_files[@]}"; do
            apply_seed_file "${seed_file}" "${app_dir##*/}"
        done
    done

    log "Seeds complete."
fi

log "=== Done ==="
