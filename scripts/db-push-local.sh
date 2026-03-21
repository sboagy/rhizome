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
#   TUNETREES_DIR   path to tunetrees repo root  (default: <gittt_root>/tunetrees)
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
    count=$(pg -v version="${version}" -qAt -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations WHERE version = :'version'")

    if [[ "${count}" -gt 0 ]]; then
        log_skip "${version} ${name}"
        return 0
    fi

    log "Applying ${version} ${name}  <- ${sql_file##*/}"
    pg -v ON_ERROR_STOP=1 -f "${sql_file}" -q

    # Record in the Supabase CLI migration tracking table.
    # columns: version TEXT PK, statements TEXT[] (nullable), name TEXT (nullable)
    pg \
        -v version="${version}" \
        -v migration_name="${name}" \
        -qAt \
        -c "INSERT INTO supabase_migrations.schema_migrations(version, name) VALUES (:'version', :'migration_name') ON CONFLICT (version) DO NOTHING"
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

    # Collect migrations from tunetrees and all APP_DIRS, sorted by version
    # (timestamp prefix). Sorting ensures shared auth / extension migrations
    # from tunetrees land before app schemas that reference auth.users.
    declare -a all_migrations
    mapfile -t all_migrations < <(
        collect_migrations_from "${TUNETREES_DIR}/supabase/migrations"
        for app_dir in "${APP_DIRS[@]}"; do
            collect_migrations_from "${app_dir}/supabase/migrations"
        done
    )

    if [[ ${#all_migrations[@]} -eq 0 ]]; then
        app_list="${APP_DIRS[*]}"
        log_warn "No migration files found. Check TUNETREES_DIR (${TUNETREES_DIR}) and APP_DIRS (${app_list})."
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
    # App seeds (from APP_DIRS): applied in order for each app directory.
    # All seed files in each app's supabase/seeds/ are expected to be
    # idempotent (e.g. using ON CONFLICT DO NOTHING).
    # ------------------------------------------------------------------
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
            log "Applying seed: ${seed_file##*/}  (${app_dir##*/})"
            pg -f "${seed_file}" -q
            log_ok "${seed_file##*/}"
        done
    done

    log "Seeds complete."
fi

log "=== Done ==="
