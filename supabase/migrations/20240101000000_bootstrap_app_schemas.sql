-- Bootstrap: create empty schema stubs for every app schema exposed by
-- PostgREST in [api] schemas (rhizome/supabase/config.toml).
--
-- WHY THIS EXISTS
-- ---------------
-- PostgREST loads its schema cache during `supabase start`. If any schema
-- listed in [api] schemas does not yet exist, PostgREST enters an exponential-
-- backoff retry loop and eventually fails the health check, causing
-- `supabase start` to time out and abort.
--
-- The schemas below are empty stubs. All actual DDL (tables, functions, RLS,
-- triggers, seeds) is managed exclusively by each app's own migration files and
-- applied after `supabase start` via `scripts/db-push-local.sh`.

CREATE SCHEMA IF NOT EXISTS cubefsrs;
