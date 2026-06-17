# TuneTrees Issue 337: Staging CI/CD Plan

Issue: https://github.com/sboagy/tunetrees/issues/337

## Status

- [x] top-down review. 
- [x] Clarifying questions are resolved.
- [x] "Cloudflare Setup Instructions For Scott" completed.
- [x] 1Password vault for `rhizome/shared-staging` fully configured.
- [x] `.env.staging.template` created for both the tunetrees and cubefsrs repos.
- [x] Add staging settings and hyperdrive configuration for both the tunetrees and cubefsrs repos in wrangler.toml files.

## Goal

Move TuneTrees from the current production-shaped deploy path to a staged release workflow:

1. Push or merge to `main` runs the existing CI test suite.
2. If CI passes, GitHub Actions deploys TuneTrees to Cloudflare staging.
3. Before staging tests run, CI refreshes staging data from production, sanitizes it, and verifies the result.
4. Staging uses real Supabase staging, a staging Worker, a Pages staging branch/domain, and correct R2 separation.
5. A later phase adds an explicit manual production deploy workflow.
6. After TuneTrees is converted, cubefsrs is brought onto the same system.
7. A dedicated R2 phase completes production-to-staging object copy automation and bucket independence.

Architectural priority: implement the durable architecture the first time. Avoid deferrals that merely create technical debt. Deferral is acceptable only where sequencing is genuinely safer, such as proving DB copy/sanitization before automating large object copies.

## Architecture Context Read

I read:

- `rhizome/ARCHITECTURE.md`
- `rhizome/design/shared_pwa_architecture.md`
- `tunetrees/ARCHITECTURE.md`
- TuneTrees issue #337 description and comment thread
- Current TuneTrees CI/deploy config in `.github/workflows/ci.yml`
- Current Cloudflare config in `wrangler.toml` and `worker/wrangler.toml`
- Current production 1Password env template in `.env.prod.template`
- Current rhizome local DB orchestration in `scripts/db-push-local.sh`

Important boundary: rhizome is still in transition, but remote deployment/data orchestration is a shared infrastructure concern. Put generic production-to-staging backup/restore/safety wrappers in rhizome when they can remain app-agnostic, and keep app-specific scrub rules/config outside generic logic.

## Decided Direction

### Branching and deploy model

Use GitHub Actions direct deploys to Cloudflare via Wrangler/CLI, not Cloudflare's automatic Git integration.

- `main` push remains the staging pipeline trigger.
- Existing `.github/workflows/ci.yml` keeps the current quality/unit/local Playwright/PWA test gates.
- After tests pass, `ci.yml` deploys staging only.
- Existing automatic production deploy behavior on `main` must be removed/disabled in Phase 1.
- Preserve production deploy commands/scripts for Phase 2.
- Phase 2 creates a separate manually triggered production workflow, likely `.github/workflows/deploy-production.yml`, using `workflow_dispatch`.

### Secret management

Use 1Password for staging secrets, matching the current production pattern.

- Add `.env.staging.template`.
- Store staging values under 1Password item `op://rhizome/shared-staging/...`.
- Keep only `OP_SERVICE_ACCOUNT_TOKEN` in GitHub Environment secrets.
- Do not duplicate staging Supabase/Cloudflare secrets directly into GitHub repository secrets unless a later constraint forces it.
- Do not provide account-level Supabase Personal Access Tokens to GitHub Actions for staging email isolation or SMTP verification. `SUPABASE_ACCESS_TOKEN` must not be required by this pipeline. The staging SMTP preflight is a local environment assertion requiring `SUPABASE_SMTP_HOST` to match `STAGING_SMTP_SAFE_HOST_PATTERN`, with no Supabase Management API call.

### Staging Supabase

Scott has created the staging project.

- 1Password item: `shared-staging`.
- Staging Supabase uses asymmetric JWT signing keys (RS256).
- Worker auth must support JWKS verification.
- Supabase OAuth callback domains have already been configured manually for `https://staging.tunetrees.com/*`.
- Frontend auth redirects must use `https://staging.tunetrees.com` when built for staging.
- Realtime is enabled at the project level.
- Any table-level Realtime publication setup must be handled by migrations/scripts.

Note from code inspection: `worker/src/media.ts` already verifies non-HS JWTs via Supabase JWKS at `/auth/v1/.well-known/jwks.json`. Phase 1 includes a prerequisite task to resolve the generated/oosync sync worker auth path before staging deploy proceeds.

### Staging Cloudflare resources

Use these resources:

- Pages project: reuse `tunetrees-pwa`.
- Pages deployment branch: `staging`, via `wrangler pages deploy dist --project-name=tunetrees-pwa --branch=staging`.
- Pages custom domain: `staging.tunetrees.com`.
- Worker name: `tunetrees-sync-worker-staging`.
- Worker route/domain: `staging-api.tunetrees.com`.
- Hyperdrive: create a staging-specific Hyperdrive config bound as `HYPERDRIVE` in the staging Worker environment.
- User-upload R2 bucket: `tunetrees-vault-staging`.
- Rhythm assets: initially read production `tunetrees-rhythm-assets` as static read-only assets, then Phase 4 adds staging rhythm-asset bucket/copy automation if needed.

Important R2 distinction: staging must never write user uploads to production `tunetrees-vault`. Reading production static rhythm assets is acceptable initially because those assets are app-owned, static, and non-user data.

### Staging data strategy

Staging should be a high-fidelity mirror of production because local development is the controlled sandbox.

- Copy full `public` schema data.
- Include `auth` users.
- Include media metadata.
- Back up production before first runs.
- Run production-to-staging copy automatically after a successful staging deploy and before staging tests.
- Make the data refresh easy to disable with `SKIP_STAGING_DATA_REFRESH=true` and a matching `skip_staging_data_refresh` workflow input for manual runs.
- Use direct `DATABASE_URL`, `pg_dump`, and `psql` flows for data copy and sanitization.
- Do not use `supabase link` for data operations.
- Use Supabase CLI only where native Supabase behavior is truly needed, such as schema migrations.
- Run a post-copy sanitization script.
- Use a rhizome-local `staging-whitelist.json` file to preserve selected users.
- The script must run with enough privilege to update `auth.users`, likely direct `postgres` database credentials in CI rather than anon/client Supabase credentials.
- First-run production backups should use TuneTrees `npm run db:remote:backup`, which delegates to rhizome's remote backup script for `public` and `auth`.
- Add TuneTrees `npm run db:remote:backup:all` for full shared-instance backups of `public`, `cubefsrs`, and `auth`.
- Add a similar cubefsrs package script during Phase 3.

Whitelist file structure:

```json
[
  {
    "id": "your-exact-supabase-uid-12345",
    "email": "testuser@tunetrees.com",
    "regex": "^test-user-.*@tunetrees\\.com$"
  }
]
```

Preservation rule: a user is preserved if any whitelist object matches by exact `id`, exact `email`, or `regex` against email.

For every non-preserved user:

- scrub display names and any personally identifiable profile fields in the `public` schema;
- overwrite `auth.users.email` with a safe staging-only value such as `scrubbed-[id]@staging.tunetrees.com`;
- ensure recovery/invite/metadata fields cannot contact real users if Supabase stores them outside the primary email column.

## R2 Architecture

TuneTrees has two distinct R2 concerns:

1. `tunetrees-rhythm-assets`: public/static rhythm audio assets referenced by `VITE_R2_AUDIO_BASE_URL`.
2. `tunetrees-vault`: authenticated user-upload media behind Worker binding `TUNETREES_VAULT`.

### Rhythm assets

Initial architecture:

- Staging reads production `tunetrees-rhythm-assets` read-only.
- Staging `VITE_R2_AUDIO_BASE_URL` can initially use the same public base URL as production.
- This is acceptable because rhythm assets are static app assets, not user data.
- Phase 4 adds a separate staging rhythm asset bucket/copy path if we need full asset-publishing isolation.

### Vault/user uploads

Initial architecture:

- Production bucket: `tunetrees-vault`.
- Preview bucket: `tunetrees-vault-preview`.
- Staging bucket: `tunetrees-vault-staging`.
- Staging Worker binding name remains `TUNETREES_VAULT`, but `[env.staging]` points it at `tunetrees-vault-staging`.
- Staging must never bind `TUNETREES_VAULT` to production `tunetrees-vault`, even read-only, because the Worker supports uploads.

Data-copy implication:

- Copying DB media metadata without corresponding R2 object bytes means old copied media may 404 in staging.
- This is acceptable only as a temporary sequencing state while DB copy/sanitization is brought up.
- Phase 4 must implement a controlled production-to-staging R2 copy path for object keys referenced by copied metadata.

## Cloudflare Setup Instructions For Scott

These are one-time/manual Cloudflare setup items before the Phase 1 workflow can succeed.

### Pages

1. Confirm the Cloudflare Pages project `tunetrees-pwa` exists.
2. Add custom domain `staging.tunetrees.com` to the Pages project.
3. Point `staging.tunetrees.com` at the `staging` branch deployment for the project.
4. Confirm Cloudflare DNS has the generated CNAME/record for `staging.tunetrees.com`.
5. Confirm the Pages project accepts direct uploads from Wrangler using the Cloudflare API token available through 1Password `shared-staging`.

### Worker

1. Create or allow Wrangler to create Worker `tunetrees-sync-worker-staging`.
2. Add route/custom domain `staging-api.tunetrees.com`.
3. Ensure CORS expectations allow requests from `https://staging.tunetrees.com`.
4. Create a staging Hyperdrive config that points to the staging Supabase database.
5. Record the staging Hyperdrive ID in 1Password under `shared-staging`.
6. Ensure the staging Worker receives secret values:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - no legacy `SUPABASE_JWT_SECRET` should be required for RS256 tokens, but keep the production HS path intact for production until it is also migrated
   - optional direct `DATABASE_URL` only if needed for bypass/troubleshooting

### R2

1. Create staging user-upload bucket `tunetrees-vault-staging`.
2. Do not bind staging user uploads to production `tunetrees-vault`.
3. Confirm staging can read production rhythm assets from the current `VITE_R2_AUDIO_BASE_URL`.
4. Store the selected staging `VITE_R2_AUDIO_BASE_URL` in 1Password `shared-staging`.
5. Defer `tunetrees-rhythm-assets-staging` creation to Phase 4 unless you want static rhythm asset publishing isolation immediately.

### Supabase

Scott has already configured the staging project and OAuth callbacks. Remaining checks:

1. Confirm the staging database connection string is compatible with Hyperdrive.
2. Configure staging Auth email delivery so copied production users can never receive email from staging:
   - acceptable: Supabase built-in SMTP/email delivery disabled for staging;
   - acceptable: custom SMTP pointed at a null/catch-all provider such as Mailtrap, with no forwarding to external addresses;
   - unacceptable: any provider configuration that can deliver to arbitrary external recipient addresses;
   - record the chosen staging email-provider configuration and verification method for the Phase 1 data-refresh preflight.
3. Confirm `shared-staging` includes:
   - `SUPABASE_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DATABASE_URL`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `VITE_WORKER_URL_TUNETREES` set to `https://staging-api.tunetrees.com`
   - staging Hyperdrive ID
   - `VITE_R2_AUDIO_BASE_URL`
4. Confirm Realtime table publications are created by migrations/scripts, not only dashboard state.

## Phase 1: TuneTrees Staging Deployment And Tests

Scope: replace automatic production deploy-on-main with automatic staging deploy-on-main.

### 1. Add staging env template

Add TuneTrees `.env.staging.template` using 1Password references under `op://rhizome/shared-staging/...`.

It should include at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `VITE_WORKER_URL`
- `VITE_R2_AUDIO_BASE_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- staging Hyperdrive ID or deploy-time variable used to generate `worker/wrangler.toml`

### 2. Audit generated oosync sync worker auth path for RS256/JWKS

Before deploying to staging, audit and confirm that the generated oosync sync worker auth path reads JWT public keys via JWKS (`/auth/v1/.well-known/jwks.json`) rather than a static `SUPABASE_JWT_SECRET`. If it uses a static HS256 secret, implement JWKS support in the oosync worker runtime or its generated auth middleware and land that change in oosync before Phase 1 proceeds. The current CI's use of `SUPABASE_JWT_SECRET` for local worker dev (HS256) confirms this gap exists and must be resolved.

This is a Phase 1 prerequisite and completion gate. Phase 1 is not complete until the staging Worker sync path accepts RS256 Supabase tokens through JWKS verification, not only the media path and not only local HS256 worker-dev tokens.

### 3. Configure Cloudflare Worker staging env

Update `worker/wrangler.toml` with `[env.staging]`:

- `name = "tunetrees-sync-worker-staging"`
- route/custom domain for `staging-api.tunetrees.com` if managed through Wrangler config

Wrangler environment inheritance is a production-resource footgun: top-level `[[r2_buckets]]`, `[[hyperdrive]]`, and `[vars]` can be inherited by `[env.staging]` unless explicitly overridden. The staging environment must therefore define all environment-specific bindings explicitly and must never rely on inherited top-level production bindings.

`[env.staging]` must explicitly define:

- `[[env.staging.r2_buckets]]` with:
  - `binding = "TUNETREES_VAULT"`
  - `bucket_name = "tunetrees-vault-staging"`
  - no inherited production `tunetrees-vault` bucket
- `[[env.staging.hyperdrive]]` with:
  - `binding = "HYPERDRIVE"`
  - the staging Hyperdrive ID from `op://rhizome/shared-staging/...`
  - no inherited production Hyperdrive ID
- `[env.staging.vars]` with:
  - `SUPABASE_URL` set to the staging Supabase URL
  - no inherited production Supabase URL

Before the real staging Worker deploy, CI must run `wrangler deploy --env staging --dry-run` or the closest Wrangler-supported equivalent and parse/verify the resolved configuration. The deploy must fail before publishing if the resolved staging bindings contain production resource names or IDs, including:

- `tunetrees-vault`
- the production Hyperdrive ID
- the production Supabase URL/project ref

Update `worker/package.json` deploy scripts so staging and production deploys are explicit:

- `deploy:staging`
- `deploy:production`

The staging script should run `op run --env-file="../.env.staging.template"` and deploy with `wrangler deploy --env staging`. It must set Cloudflare Worker secrets for staging without logging secret values.

### 4. Configure Cloudflare Pages staging deploy

Keep Pages project `tunetrees-pwa`.

The staging deploy step should:

- build with `.env.staging.template`;
- run `npx wrangler pages deploy dist --project-name=tunetrees-pwa --branch=staging`;
- output the staging Pages deployment URL and `https://staging.tunetrees.com`.

### 5. Production-to-staging database copy and sanitization

Place generic remote DB copy/safety tooling in rhizome if it can stay app-agnostic. Keep TuneTrees-specific scrub field config as explicit app config.

Minimum implementation:

- Add `rhizome/staging-whitelist.json` or `rhizome/config/staging-whitelist.json`.
- Add a script that validates whitelist shape before touching data.
- Add app-specific scrub config for TuneTrees public-schema PII fields.
- Back up production before first runs.
- Use TuneTrees `npm run db:remote:backup` for the initial production backup of `public` and `auth`.
- Add TuneTrees `npm run db:remote:backup:all` to back up `public`, `cubefsrs`, and `auth`.
- Preserve rhizome as the actual backup implementation owner; TuneTrees and cubefsrs package scripts should delegate to rhizome rather than duplicating backup logic.
- Before refreshing staging data, apply TuneTrees migrations to the staging Supabase project so staging schema comes from migrations only; the data refresh script must validate that all dumped `public` tables and `auth.users` already exist in staging before any truncate/restore step runs.
- Before restoring any `auth.users` data, run a pre-copy staging SMTP safety check using only local environment assertions:
  - require `SUPABASE_SMTP_HOST` to be set to the staging project's configured null/catch-all SMTP host;
  - require `STAGING_SMTP_SAFE_HOST_PATTERN`, and fail unless `SUPABASE_SMTP_HOST` matches that allow-list;
  - fail before dump/restore if either local assertion is missing or if the SMTP host can deliver to external addresses;
  - this is a local fail-closed verification guard and does not replace the Database Trigger Method below.
- Before restoring any data into `auth.users`, sanitize the `auth.users` dump locally before it ever reaches staging:
  - do not require ownership of Supabase-managed `auth.users`, because hosted Supabase database credentials can truncate and insert but cannot reliably run `ALTER TABLE auth.users DISABLE TRIGGER ALL;`;
  - dump `auth.users` without `--disable-triggers` so the dump contains no trigger DDL for the Supabase-managed auth table;
  - rewrite the plain COPY data for non-whitelisted users locally, scrubbing the named `auth.users` PII fields below before composing the staging restore file;
  - restore only sanitized `auth.users` rows into staging; raw production auth rows must never be inserted into staging.
- The Infrastructure API Method is explicitly rejected for email isolation and SMTP verification in this pipeline. Do not use the Supabase Management API or `SUPABASE_ACCESS_TOKEN` to change, toggle, or read SMTP settings from CI.
- The CI pipeline must operate using only project-scoped credentials such as `SUPABASE_SERVICE_ROLE_KEY` and direct privileged staging Postgres credentials.
- The `auth.users` sanitization must explicitly scrub at least these columns for every non-whitelisted user:
  - `email`: replace with deterministic staging-only address such as `scrubbed-[id]@staging.tunetrees.com`;
  - `phone`: set to `NULL`;
  - `raw_user_meta_data`: replace/remove PII-bearing values and ensure no email-shaped strings remain anywhere in the JSONB document;
  - `raw_app_meta_data`: replace/remove PII-bearing values and ensure no email-shaped strings remain anywhere in the JSONB document;
  - for both JSONB metadata columns, use `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}` as the exact email-shaped detector;
  - `email_change`: set to `NULL` or an equivalent empty value;
  - `encrypted_password`: replace with a fixed staging-only bcrypt hash, stored as a script constant and never derived from production data;
  - `confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change_token_current`, and `reauthentication_token`: zero out using `NULL` or an equivalent empty value.
- The TuneTrees `public` schema sanitization must explicitly scrub these current known PII columns:
  - `public.user_profile.name`: replace with a deterministic staging display name such as `Staging User [short-id]`;
  - `public.user_profile.email`: replace with the matching staging-only scrubbed address used for `auth.users.email`;
  - `public.user_profile.phone`: set to `NULL`;
  - `public.user_profile.phone_verified`: set to `NULL`;
  - `public.user_profile.avatar_url`: set to `NULL` or a staging-safe placeholder URL.
- If future schema inspection finds additional `public` columns that store user display names, emails, phones, avatar/profile URLs, or equivalent direct identifiers, the scrub config must be updated before the data-copy job is allowed to run.
- Dump production `public` data and only `auth.users` using direct `pg_dump` with non-negotiable flags:
  - `--data-only`, because staging schema must come from migrations only and the data-copy path must never dump or restore DDL;
  - `--no-owner` and `--no-acl`, because production and staging Supabase projects can have different role ownership and grants;
  - no `--disable-triggers` for either dump, because hosted Supabase roles cannot reliably disable Supabase-managed auth triggers or app-table RI system triggers;
  - exclude `public.sync_change_log`, because it is server-maintained sync bookkeeping that restore-time triggers repopulate and copying production rows can conflict with rows created during staging restore;
  - `-n public` for the public dump and `-t auth.users` for the auth-user dump, with no implicit schema inclusion.
- Other `auth` schema tables are intentionally excluded. Tables such as `auth.identities`, `auth.audit_log_entries`, and `auth.mfa_factors` can contain OAuth profile emails, provider JSON, IP addresses, phone numbers, TOTP records, and similar PII with no scrub path in this plan. They are auto-populated by GoTrue as users log in, so copying them imports sensitive provider state that staging does not need.
- The `auth.users` dump must be sanitized before restore rather than restored raw and scrubbed later. This eliminates the PII timing window for `auth.users` in staging and avoids trigger ownership failures on hosted Supabase. The script sequence must be: (1) local SMTP assertion, (2) `pg_dump` public data without trigger DDL, (3) `pg_dump` `auth.users` without trigger DDL, (4) locally rewrite non-whitelisted auth COPY rows, (5) truncate staging public and auth data, (6) restore sanitized auth plus public data, (7) post-restore public/profile sanitization and validation.
- The data dump must not include `cubefsrs`, `realtime`, `storage`, `supabase_migrations`, or any other schema/table outside explicit `public` and `auth.users`.
- Verbose command logging must be disabled during `auth` dump/restore:
  - do not use `pg_dump --verbose`, `psql --echo-all`, `set -x`, or any command wrapper that can print copied auth rows or SQL values into CI logs;
  - logs may include counts, schema names, and project refs, but must not include raw user emails or auth row contents.
- Restore into staging using direct `psql`/`pg_restore` with non-negotiable restore behavior:
  - run inside one transaction via `--single-transaction`;
  - stop on the first error via `-v ON_ERROR_STOP=1`;
  - fail the workflow rather than leaving staging half-populated after a mid-restore failure.
- Run sanitization in staging with direct privileged database connection.
- Sanitization must run in the same transaction block as the restore where possible.
- If same-transaction sanitization is not technically possible, sanitization must run immediately after restore with an `ON ERROR`/failure trap that deletes all non-whitelisted `auth.users` rows before the job exits.
- If sanitization fails, CI must fail fast and delete the non-whitelisted staging `auth.users` rows.
- Fail CI if any non-whitelisted `auth.users.email` remains outside the safe staging domain.
- Fail CI if any non-whitelisted `auth.users.raw_user_meta_data` or `auth.users.raw_app_meta_data` JSONB value contains an email-shaped string anywhere in the document, not only at top-level keys. Implement this as `ci/check_no_emails_in_jsonb.py`, run by CI against both columns after sanitization; the script must recursively walk all JSON nodes, including objects and arrays, test every string scalar with `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`, and exit nonzero on any match.
- Fail CI if `auth.identities` contains rows for non-whitelisted users after restore, because production OAuth identities must not be copied into staging.
- Fail CI if any named TuneTrees `public` PII column listed above retains non-whitelisted production-looking PII after sanitization.
- Fail CI if staging `SUPABASE_URL` or `DATABASE_URL` points at production.
- Fail CI if source and target project refs/hosts match.
- Support `SKIP_STAGING_DATA_REFRESH=true` and workflow input `skip_staging_data_refresh` to skip refresh temporarily, but default to refresh-on-successful-staging-deploy before staging tests.

Safety gates:

- explicitly avoid an `auth.users` PII exposure window in staging by sanitizing the auth dump before restore; public-profile PII is still sanitized immediately after restore and guarded by validation;
- reject the Infrastructure API Method for email isolation and SMTP verification: do not use the Supabase Management API to change, toggle, or read SMTP settings from CI, and do not expose `SUPABASE_ACCESS_TOKEN` to the pipeline for this purpose. The SMTP preflight check must rely only on local environment assertions requiring `SUPABASE_SMTP_HOST` to match `STAGING_SMTP_SAFE_HOST_PATTERN`.
- do not use the Database Trigger Method on hosted Supabase `auth.users`; instead sanitize `auth.users` dump rows locally before restore and fail if the sanitized dump transform cannot identify the `auth.users` COPY block and required columns.
- require explicit `SOURCE_ENV=production` and `TARGET_ENV=staging`;
- print source/target project refs before execution;
- refuse to run if source and target project refs match;
- refuse to run if target hostname is not the staging Supabase project;
- refuse to run if source hostname is not the production Supabase project;
- refuse to run if staging Supabase SMTP is configured to deliver to external addresses;
- refuse to run if staging Supabase SMTP/email-provider state cannot be verified before restoring `auth.users`;
- protect the local-auth-sanitize, restore, post-restore-sanitize, and validation sequence with fail-fast behavior; because raw auth rows are never inserted into staging, cleanup must still delete non-whitelisted `auth.users` rows if a later validation step fails;
- trap restore/sanitization failures and delete all non-whitelisted `auth.users` rows before failing the job;
- validate sanitized JSONB recursively through the deterministic CI runner `ci/check_no_emails_in_jsonb.py`, including nested objects and arrays in `raw_user_meta_data` and `raw_app_meta_data`;
- validate that `auth.identities` has no rows for non-whitelisted users after restore;
- validate the named `public.user_profile` PII columns after sanitization and fail if any non-whitelisted values remain production-looking;
- keep verbose `psql`/`pg_dump` logging off for all auth dump/restore operations to prevent PII from entering CI logs;
- use dry-run/plan mode for the first validation path.

### 6. Staging Playwright tests

Add a staging Playwright config/project that:

- points `baseURL` at `https://staging.tunetrees.com`;
- does not start local web servers;
- uses staging test credentials from 1Password;
- uses email+password staging test accounts rather than OAuth, so staging tests do not depend on pre-populated `auth.identities` rows;
- verifies anonymous app shell;
- verifies auth redirect configuration;
- verifies Worker `/health`;
- verifies RS256/JWKS auth through sync and media paths;
- verifies a minimal authenticated read/sync path;
- verifies staging media upload writes to `tunetrees-vault-staging`, not production.

### 7. CI workflow changes

Modify `.github/workflows/ci.yml` and add a separate staging workflow, such as `.github/workflows/ci-staging.yml`, or an equivalent reusable workflow:

- keep current quality/unit/local E2E/PWA gates;
- split CI concurrency behavior so fast feedback remains cancellable but staging environment mutations are serialized:
  - keep `cancel-in-progress: true` only in the fast-feedback `ci.yml` workflow for quality, unit, local E2E, and local PWA jobs;
  - move staging deploy, production-to-staging data refresh, and staging smoke/E2E tests out of `ci.yml` into the separate staging workflow;
  - give the staging workflow its own top-level concurrency group, such as `staging-deploy-${{ github.ref }}`;
  - set top-level `cancel-in-progress: false` in the staging workflow so rapid `main` pushes queue instead of killing an in-progress deploy/refresh/test sequence;
  - do not rely on job-level concurrency inside a workflow that still has workflow-level `cancel-in-progress: true`, because workflow cancellation can terminate all jobs in that run.
- The staging deploy job that creates GitHub Deployment records must declare job-level permissions:
  - `contents: read`, for checkout;
  - `deployments: write`, for `gh api repos/.../deployments` and deployment status creation;
  - add this `permissions` key at the job level, not the workflow level, to keep the blast radius minimal.
- Without job-level `deployments: write`, `gh api repos/.../deployments` returns 403 and the staging proof record is never created.
- change current deploy jobs on `main` from production deploy to staging deploy;
- preserve production deploy scripts for Phase 2, but do not deploy production from `main`;
- run the staging Worker `wrangler deploy --env staging --dry-run` binding verification and fail if resolved bindings include production resources;
- deploy staging Worker before staging Pages build if the bundle points at `https://staging-api.tunetrees.com`;
- deploy staging Pages;
- refresh staging DB from production unless disabled;
- run staging smoke/E2E tests after deploy and data refresh.

Without the separate non-cancelling staging workflow, rapid PR merge sequences can cancel a data refresh or deploy mid-flight and corrupt the staging environment.

## Phase 2: TuneTrees Production Manual Deploy

Scope: add production workflow after Phase 1 staging is stable.

Create `.github/workflows/deploy-production.yml`.

Trigger:

- `workflow_dispatch`.

Behavior:

- require a `workflow_dispatch` input named `deploy_sha` containing the exact full commit SHA to deploy;
- check out that exact SHA, not the current `main` HEAD;
- verify that exact SHA has a successful GitHub Deployment record for the `staging` environment unless explicitly overridden;
- apply production Supabase migrations for the exact checked-out SHA before deploying production runtime code;
- build production with `.env.prod.template`;
- deploy production Worker;
- deploy production Pages to `tunetrees-pwa` production branch/domain;
- run production-safe smoke tests only.

### Supabase schema promotion requirement

Phase 2 is not complete until the production workflow owns Supabase schema promotion, not only Worker and Pages deployment. The staging proof gate proves that the exact SHA was exercised against the migrated staging schema; production promotion must then apply the same committed migrations to production before publishing runtime code that can depend on them.

Minimum implementation requirement:

- Add an exact TuneTrees root `package.json` script:
  - `"db:production:schema:push": "FORCE_COLOR=1 op run --env-file=\".env.prod.template\" -- node scripts/run-supabase-schema-push.mjs --env production"`
  - `"db:staging:schema:push": "FORCE_COLOR=1 op run --env-file=\".env.staging.template\" -- node scripts/run-supabase-schema-push.mjs --env staging"`
  - `scripts/run-supabase-schema-push.mjs` owns masking, target assertions,
    migration-list preflight, pinned Supabase CLI invocation, output
    classification, and job-summary reporting.
  - `.env.prod.template` must continue to resolve `DATABASE_URL` from `op://rhizome/shared-production/Supabase/DATABASE_URL`.
  - `.env.staging.template` must continue to resolve staging `DATABASE_URL` from `op://rhizome/shared-staging/Supabase/DATABASE_URL`.
- Pin the Supabase CLI version used for remote schema pushes inside
  `scripts/run-supabase-schema-push.mjs` (`supabase@2.98.2`) or pin the
  `supabase` devDependency to exact `2.98.2` and invoke the checked-in
  package-lock version. Do not rely on an unpinned `npx supabase`.
- Add a staging CI step to the already-live Phase 1 `.github/workflows/ci.yml`; this is not optional. The `deploy-staging` job must run `npm run db:staging:schema:push` before staging data refresh, staging smoke tests, and creation of the successful `staging` Deployment proof.
- Existing `staging` Deployment proofs created before this migration gate is added are considered pre-migration-gate proofs. They are acceptable for app-only releases with no Supabase migrations, but they are not sufficient proof for a production deploy that includes schema changes.
- The staging Deployment proof must only be created after staging migrations, staging Worker deploy, staging Pages deploy, staging data refresh, generated-contract validation, and staging smoke tests have all passed for the same SHA.
- In `.github/workflows/deploy-production.yml`, run production schema migration after exact-SHA checkout and staging Deployment proof verification, but before production Worker and Pages deploy.
- Production migrations must use production-scoped 1Password values from `op://rhizome/shared-production/...`; do not add separate Supabase database secrets directly to GitHub unless a later constraint forces it. The `OP_SERVICE_ACCOUNT_TOKEN` exposed to the production GitHub Environment should be scoped to the minimum 1Password vault/items needed for production deployment rather than broad account access.
- Before any remote schema push, mask the resolved database URL with `echo "::add-mask::$DATABASE_URL"` or equivalent so a password-bearing connection string cannot appear in logs. Do this inside the `op run` context before invoking `supabase db push`.
- Before any remote schema push, assert the target environment by parsing the resolved `DATABASE_URL` host/dbname and comparing it to the expected staging or production Supabase project host. Write only a masked, redacted, or hashed host+dbname summary to `$GITHUB_STEP_SUMMARY`; never print credentials.
- The production migration step is covered by the same `production-promotion` workflow concurrency group with `cancel-in-progress: false`; concurrent production workflows must queue so two `supabase db push` runs cannot race against the same production database.
- The production migration step must fail closed with Supabase CLI failure behavior; if migration fails, do not deploy Worker or Pages.
- The production workflow job summary must record whether production migrations were applied, skipped because no pending migrations existed, or failed. Capture Supabase CLI output and branch on stable strings such as `No migrations to apply` vs. `Applying migration`; if the CLI output format changes, fail closed and require the summary logic to be updated rather than silently reporting an unknown state.
- Before applying production migrations, run a read-only preflight such as `npx supabase@2.98.2 migration list --db-url "$DATABASE_URL"` and write the pending/applied migration summary to `$GITHUB_STEP_SUMMARY` without exposing credentials.
- Add `timeout-minutes: 30` to the production migration step. If it times out, treat it as a failed/unknown migration state and follow the partial-migration recovery procedure below before retrying.
- The `db:production:schema:push` command is expected to be idempotent when previous migrations were fully applied and recorded by Supabase's migration table. It is not assumed safe after a partial migration failure until an operator inspects the actual applied state.
- Do not run data-copy, sanitization, or production-to-staging refresh scripts against production as part of schema promotion. Production schema migration is DDL-only plus any explicit migration-authored data backfill SQL.

Partial migration recovery:

- If a production migration fails or times out, the workflow must stop before Worker/Pages deploy.
- The on-call operator must inspect applied state with `npx supabase@2.98.2 migration list --db-url "$DATABASE_URL"` and, when needed, direct SQL inspection of the affected objects.
- The operator must decide whether to roll forward with a corrective migration or manually reverse the partial change. Prefer roll-forward fixes unless reversal is clearly safer and has been tested.
- The decision and action taken must be recorded in the deployment-audit issue or workflow summary before re-triggering production deployment.
- Do not retry the workflow blindly after a partial migration failure.

Required migration compatibility model:

- Default rule: every migration that can be promoted by this workflow must be backward-compatible with the currently deployed production app and Worker until the new Worker and Pages deployment completes.
- This compatibility model is a code-review gate. CI can verify that migrations apply and that generated contracts match, but it cannot prove semantic compatibility for destructive or behavioral schema changes; authors and reviewers must check that explicitly in the PR.
- Additive changes are normally allowed in one release: new tables, new nullable columns, new columns with safe defaults, new indexes, new views, new functions, and non-breaking trigger additions.
- Adding a `NOT NULL` column is allowed only when the migration provides a safe default, backfills existing rows, and leaves old code compatible. Otherwise split it into multiple releases.
- Adding constraints, unique indexes, foreign keys, or stricter checks is allowed only after validating or backfilling existing production data in the migration. Use `NOT VALID`/`VALIDATE CONSTRAINT` or an equivalent low-risk pattern where appropriate for large tables.
- Altering column types, renaming columns, changing column semantics, tightening nullability, changing primary keys, changing RLS policies, or changing trigger behavior must be treated as potentially breaking unless explicitly proven backward-compatible.
- Deleting columns, deleting tables, dropping views/functions used by existing code, removing enum values, or removing compatibility triggers is never a one-release change. Use expand/contract.

Expand/contract scenarios:

1. Add or reshape:
   - release A: add the new schema shape while keeping the old shape working;
   - backfill data if needed;
   - deploy code that can read/write both old and new shape or continues using the old shape.
2. Switch reads/writes:
   - release B: deploy app/Worker/codegen changes that use the new shape;
   - keep old columns/tables/views/triggers present for rollback and for any clients still running older bundles/service workers.
3. Contract:
   - release C, after old clients/workers are no longer expected to write the old shape: drop old columns/tables/views/triggers and remove compatibility code.

Concrete examples:

- Adding `public.note.summary text`: one release is acceptable if nullable or defaulted and old code ignores it.
- Adding `public.note.summary text not null`: use a default plus backfill, or split into add nullable -> backfill -> enforce not null.
- Renaming `public.note.body` to `content`: add `content`, dual-write/backfill, deploy readers for `content`, then later drop `body`.
- Changing `public.media_asset.size` from `text` to `integer`: add `size_int`, backfill with validated casts, deploy code using `size_int`, then later drop/rename the old column.
- Deleting `public.reference.url`: first remove code reads/writes and deploy, wait for old service workers/clients to age out, then drop the column in a later production deploy.
- Tightening RLS on a synced table: first add tests and staging validation proving sync worker and browser paths still work for migrated staging data; do not combine unproven RLS tightening with unrelated schema churn.

Codegen and client compatibility:

- Any migration that changes synced tables must follow the generated-file workflow: apply migration locally, run schema codegen, and include generated outputs from the generator rather than hand-editing generated files.
- Staging must validate the generated app/Worker contract against the migrated staging database before the `staging` Deployment proof is created. Minimum validation is `npm run codegen:schema:check && npm run typecheck` after `npm run db:staging:schema:push`; if `codegen:schema:check` cannot target staging directly, add an equivalent check that runs codegen against the migrated staging database URL and fails on generated diff.
- Because TuneTrees is a PWA, old service workers or browser bundles may remain active briefly after production deploy. Migrations must account for that overlap unless the release includes an explicit cache/service-worker invalidation plan.
- A cache/service-worker invalidation plan is required for any migration that removes or renames a column/table/view used by browser-side Drizzle queries, changes the sync protocol or generated table metadata in a way old clients cannot tolerate, or removes compatibility triggers/views/functions. Minimum acceptable mechanisms include bumping an explicit service-worker/app version used by the PWA update flow, forcing a Workbox update/activation path that calls `skipWaiting()` and coordinates `clients.claim()` with a user-visible reload prompt, or documenting why old clients remain compatible until the contract phase lands.

### Staging proof requirement

This is a non-negotiable release gate, not an implementation-time choice.

After a successful Phase 1 staging deploy, production-to-staging data refresh, and staging smoke/E2E test run, the staging CI job must create a GitHub Deployment record tied to the exact `${{ github.sha }}`:

- create a Deployment via the GitHub Deployments API with `environment = "staging"` and `ref` set to `${{ github.sha }}`;
- create a Deployment status of `success` only after every staging deploy, data refresh, and staging test gate has passed;
- use `gh api repos/:owner/:repo/deployments` and `gh api repos/:owner/:repo/deployments/{deployment_id}/statuses` or an equivalent GitHub REST client;
- do not mark the Deployment `success` before the staging tests complete.

The production workflow must check this Deployment API proof before deploying:

- accept only an exact `deploy_sha` input from `workflow_dispatch`;
- query GitHub Deployments for `environment=staging` and the exact `deploy_sha`;
- inspect the matching Deployment statuses;
- proceed only if at least one Deployment for that exact SHA has a `success` status;
- fail closed if no matching successful `staging` Deployment exists.

The production workflow must not interpret "latest successful staging run" or "HEAD of main has passed staging" as sufficient proof. The check is exactly: does a `staging` environment Deployment exist for this exact SHA with status `success`?

Override behavior:

- include an explicit override input, for example `override_staging_check`;
- require a human-readable override reason when the override is used;
- write an audit entry to the GitHub job summary describing the SHA, actor, timestamp, and reason;
- optionally also write the same audit entry as a comment on issue #337 or a dedicated deployment-audit issue;
- never bypass the staging Deployment proof silently.

### Release train lock

Once a production deploy is triggered for SHA-A, staging is treated as locked for SHA-A until the production deploy completes or is explicitly aborted.

Minimum implementation requirement:

- production deploys use a single production-promotion concurrency group with `cancel-in-progress: false`;
- the production workflow job summary must state that staging is locked for `deploy_sha` while production promotion is in progress;
- operators must not intentionally update or promote a different staging SHA while the production deploy is running;
- if the production deploy is aborted, the aborting operator must record the abort in the production workflow summary or the deployment-audit issue before staging is considered unlocked.

GitHub has no native lock for an external staging environment that automatically coordinates with an independent production workflow. If stronger enforcement is needed after Phase 2, add a GitHub Environment protection rule on `staging` or an explicit repo-level promotion-lock mechanism before allowing fully unattended production promotion.

Recommended production smoke coverage:

- anonymous app shell loads;
- service worker/assets reachable;
- Worker `/health` responds;
- Supabase auth endpoint reachable;
- optional login with a dedicated production smoke-test user, with no writes.

Production workflow should use a GitHub Environment such as `production` with required reviewer protection if we keep an environment gate in addition to `workflow_dispatch`.

## Phase 3: Convert cubefsrs To The Same System

Scope: after TuneTrees staging and production are working, apply the pattern to cubefsrs.

High-level tasks:

- read cubefsrs architecture/current deploy setup and scoped AGENTS instructions;
- confirm cubefsrs Supabase schema/environment strategy in the shared-PWA architecture;
- add a cubefsrs remote backup package script that delegates to rhizome, matching the TuneTrees backup pattern;
- add `.env.staging.template` for cubefsrs using `op://rhizome/shared-staging/...` or a cubefsrs-specific staging item if needed;
- configure cubefsrs Pages staging branch/domain;
- configure cubefsrs Worker staging env, if cubefsrs has a Worker;
- define cubefsrs R2 needs, if any;
- add cubefsrs staging data copy/sanitization rules for its schema;
- add cubefsrs staging smoke tests;
- add cubefsrs manual production workflow;
- update rhizome shared docs if the repeated pattern becomes canonical.

Important boundary: cubefsrs must not import TuneTrees code or depend on TuneTrees deployment assumptions. Shared helpers belong in rhizome only if they remain app-agnostic.

## Phase 4: R2 Copy Automation And Bucket Independence

Scope: complete R2 parity after cubefsrs conversion, while keeping the `tunetrees-vault-staging` binding in Phase 1.

This phase exists because database metadata and R2 object bytes are separate systems. The best long-term architecture is explicit R2 copy tooling, not silent production bucket reads for everything.

### 1. Vault object copy

Add a production-to-staging R2 copy workflow/script for user-upload objects:

- source bucket: `tunetrees-vault`;
- target bucket: `tunetrees-vault-staging`;
- copy only object keys referenced by staging-copied `public.media_asset`/reference metadata, unless a full bucket sync is explicitly requested;
- preserve content type and object metadata;
- skip unchanged objects by ETag/size where possible;
- fail and exit nonzero if any object key referenced in staging metadata cannot be found in the source bucket;
- compare object metadata explicitly, including content type and custom headers, and fail if metadata has changed even when ETag and size match;
- report the specific keys that failed source resolution or metadata comparison instead of silently skipping them;
- never delete staging objects by default;
- support dry-run mode;
- refuse to run if source and target buckets are the same;
- log counts and sample keys without exposing private media contents.

Recommended trigger:

- `workflow_dispatch` initially;
- later optionally run after successful production-to-staging DB refresh.

### 2. Rhythm assets staging bucket

Decide whether to create `tunetrees-rhythm-assets-staging`.

Use a separate staging rhythm bucket if we need to test:

- rhythm asset publishing;
- R2 custom domain changes;
- cache headers;
- CORS policy;
- destructive bucket policy changes.

If created:

- source bucket: `tunetrees-rhythm-assets`;
- target bucket: `tunetrees-rhythm-assets-staging`;
- copy all static rhythm assets;
- configure public/custom-domain access;
- update `op://rhizome/shared-staging/.../VITE_R2_AUDIO_BASE_URL` to the staging rhythm asset URL;
- add a smoke test that fetches a known rhythm asset from the staging URL.

If not created:

- keep staging reading production rhythm assets read-only;
- document the intentional shared-static-assets decision in the deployment docs.

### 3. R2 smoke tests

Add staging smoke coverage for:

- known rhythm asset fetch via `VITE_R2_AUDIO_BASE_URL`;
- authenticated media upload to staging Worker;
- uploaded object exists in `tunetrees-vault-staging`;
- uploaded object does not exist in production `tunetrees-vault`;
- copied historical media object can be fetched if vault copy workflow has run.

## Resolved Review Decisions

- Phase 3 remains cubefsrs conversion.
- Phase 4 remains historical R2 object-copy automation and optional rhythm asset bucket independence.
- `tunetrees-vault-staging` binding is implemented in Phase 1.
- The staging DB refresh kill switch is `SKIP_STAGING_DATA_REFRESH=true`.
- Manual workflow input name is `skip_staging_data_refresh`.
- First-run production backups use TuneTrees `npm run db:remote:backup`, which delegates to rhizome.
- Add TuneTrees `npm run db:remote:backup:all` for `public`, `cubefsrs`, and `auth`.
- Add a similar cubefsrs backup command during Phase 3.

No further clarifying questions remain before top-down review.

## Tentative File Touch List

Likely TuneTrees files:

- `.github/workflows/ci.yml`
  - keep fast-feedback quality/unit/local E2E/PWA jobs cancellable
- `.github/workflows/ci-staging.yml` or equivalent reusable staging workflow
  - add job-level `permissions: contents: read` and `deployments: write` to the staging deploy job that creates GitHub Deployment records
  - add `npm run db:staging:schema:push` before staging data refresh and before successful staging Deployment proof creation
  - use top-level staging concurrency with `cancel-in-progress: false`
- later `.github/workflows/deploy-production.yml`
  - add exact-SHA production schema preflight, masked `db:production:schema:push`, migration summary reporting, timeout, and failure handling before Worker/Pages deploy
- `.env.staging.template`
- `wrangler.toml`
- `worker/wrangler.toml`
- `worker/package.json`
- `package.json`
  - add `db:production:schema:push`
  - pin or invoke an exact Supabase CLI version for remote schema pushes
- possibly `scripts/**` for shared/validated schema-push wrappers if masking, target assertion, migration-state parsing, or summary reporting becomes too much shell for workflow YAML
- `playwright.config.ts` or a dedicated staging/smoke Playwright config
- `e2e/**` for staging/smoke tests
- possibly app-specific staging scrub config

Likely Rhizome files:

- `plans/tunetrees-issue-337-staging-cicd.md`
- `staging-whitelist.json` or `config/staging-whitelist.json`
- `scripts/**` for shared backup/restore/sanitization wrappers
- `scripts/**` for later shared R2 copy wrappers if app-agnostic
- possibly `README.md`, `ARCHITECTURE.md`, or `design/shared_pwa_architecture.md` if shared deployment responsibilities change

Likely cubefsrs files in Phase 3:

- its workflow files;
- its env templates;
- its Cloudflare/Supabase config;
- its Playwright/smoke tests;
- app-specific staging data config.
