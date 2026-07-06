# TuneTrees Issue 362: Resend SMTP For Supabase Auth Email

Issue: https://github.com/sboagy/tunetrees/issues/362
Reference comment: https://github.com/sboagy/tunetrees/issues/362#issuecomment-4644647786

## Status

- [x] Read `rhizome/ARCHITECTURE.md`.
- [x] Read `rhizome/design/shared_pwa_architecture.md`.
- [x] Read TuneTrees issue #362 and the targeted issue comment.
- [x] Draft plan and clarifying questions.
- [x] Resolve clarifying questions.
- [x] Begin implementation after explicit go-ahead.
- [x] Create durable runbook at `docs/supabase-auth-email.md`.
- [ ] Complete manual Supabase Dashboard SMTP setup and verification.

## Goal

Replace Supabase's default, rate-limited transactional email provider with Resend SMTP for deployed TuneTrees environments, especially auth emails such as sign-up confirmations, magic links, password recovery, and email-change confirmations.

The default Supabase provider should remain in place for local development so the shared local Supabase instance continues to use Inbucket as the local SMTP catcher.

## Architecture Context

Rhizome is the shared infrastructure and architecture home for the multi-repo workspace. The current shared PWA architecture is still in transition:

- TuneTrees is currently mostly standalone.
- Rhizome owns shared Supabase local configuration and shared infrastructure glue.
- `auth` is a shared identity layer across apps.
- Infrastructure changes that affect the shared Supabase environment belong in rhizome when they can remain app-agnostic.
- App-specific schema or domain logic must stay out of rhizome.

This SMTP change is infrastructure/auth-provider configuration, not an app schema change. The plan should therefore live in rhizome, while any app-specific CI or env template changes should be made in the affected app repos during implementation.

## Problem Summary

Issue #362 reports delayed or missing email confirmation for a real user. The referenced comment identifies the likely root cause: production still relying on Supabase's default email provider, which is intended for testing and has strict rate limits. The intended fix is to configure a dedicated transactional provider.

Resend is selected as the provider:

- `tunetrees.com` has already been added to Resend.
- A test email has already been sent.
- Resend API keys are stored in 1Password for shared staging, production, and local vault paths.
- The local environment must not be switched to Resend.

## Resolved Decisions

- Production setup is manual-first through the Supabase Dashboard. Do not automate Supabase Auth SMTP mutation through the Management API.
- Do not store or use Supabase Management API access tokens, even for read-only SMTP audits.
- Durable instructions belong in a new rhizome runbook: `docs/supabase-auth-email.md`.
- Use Resend SMTP over TLS on port `465`.
- Use SMTP username `resend`.
- Use environment-specific Resend API keys from 1Password. The current staging and production values may be physically identical today, but all code/docs must assume they can differ.
- Production sender name: `TuneTrees Auth`.
- Production sender address: use `admin@tunetrees.com` unless Scott chooses `staging+admin@tunetrees.com` during the manual dashboard setup. The runbook should make this final dashboard choice explicit before saving production settings.
- Staging setup should not wait for the future secondary Resend account. Configure staging against `op://rhizome/shared-staging/Resend/RESEND_API_KEY`; Scott can swap the underlying 1Password value later with no code change.
- Staging sender address: `staging-auth@tunetrees.com` or a very similar staging-specific address on `tunetrees.com`.
- Real production smoke tests should use `sboagy+smoketest@gmail.com`.
- Non-real simulations and automated smoke checks should use Resend test addresses such as `delivered@resend.dev`.

## External Facts To Verify During Implementation

These were checked while drafting, but should be verified again when implementing because provider docs and dashboards can drift.

- Supabase documents its built-in email service as demo/testing oriented and rate-limited; the issue comment cites a 2-emails-per-hour project limit.
- Supabase supports custom SMTP for Auth email delivery.
- Resend SMTP uses:
  - host: `smtp.resend.com`
  - port: `465` for TLS, or `587` for STARTTLS
  - username: `resend`
  - password: the environment-specific Resend API key
- Resend's dedicated test addresses, including `delivered@resend.dev`, can be used for safe delivery simulation.

Primary source links to re-check:

- Supabase custom SMTP docs: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase local CLI auth config docs: https://supabase.com/docs/guides/local-development/cli/config
- Resend SMTP docs: https://resend.com/docs/send-with-smtp
- Resend Supabase integration docs: https://resend.com/docs/send-with-supabase-smtp
- Resend test emails docs: https://resend.com/docs/dashboard/emails/test-emails

## Environment Model

### Local

Local must continue using rhizome's shared local Supabase config and Inbucket.

Current local config in `rhizome/supabase/config.toml` already enables Inbucket:

- `[inbucket] enabled = true`
- local Auth remains configured through `supabase/config.toml`
- no Resend SMTP settings should be added to local config
- no local 1Password Resend key should be consumed by scripts unless a future explicit manual smoke test needs it

The 1Password path `op://rhizome/shared-local/Resend/RESEND_API_KEY` may exist, but implementation should not wire it into the local Supabase runtime.

### Staging

Staging should use a staging-specific Resend API key value from:

- `op://rhizome/shared-staging/Resend/RESEND_API_KEY`

The code and scripts must assume this value differs from production, even if it is currently the same physical key.

The user plans to create a second free Resend account for staging using `sboagy+staging@gmail.com`. Implementation should not wait for that account:

- configure staging with the current staging 1Password reference; and
- rely on Scott swapping the underlying 1Password value later when the secondary staging Resend account is ready.

Staging must preserve the email-safety constraints from the staging CI/CD work. In particular, if staging data is refreshed from production, staging must not send email to unsanitized production user addresses. Resend custom SMTP makes this more important, not less.

Staging should use a staging-specific sender such as `staging-auth@tunetrees.com` on the main `tunetrees.com` domain to avoid extra DNS overhead while keeping staging mail visually distinct.

### Production

Production should use:

- `op://rhizome/shared-production/Resend/RESEND_API_KEY`

Production should be configured for real transactional delivery from the verified `tunetrees.com` domain.

Production should use:

- sender name: `TuneTrees Auth`
- sender address: `admin@tunetrees.com` by default, with `staging+admin@tunetrees.com` documented as an alternate only if Scott selects it during manual dashboard setup
- smoke-test recipient: `sboagy+smoketest@gmail.com`

## Proposed Implementation Shape

### Phase 1: Manual Production Rescue Runbook

Purpose: quickly remove the production bottleneck while keeping implementation risk low.

1. Confirm Resend domain verification for `tunetrees.com` is complete.
2. Confirm the intended production sender identity:
   - name: `TuneTrees Auth`
   - address: `admin@tunetrees.com` by default, or `staging+admin@tunetrees.com` if Scott chooses that alternate during dashboard setup
3. In Supabase production dashboard, enable custom SMTP for Auth.
4. Configure:
   - host: `smtp.resend.com`
   - port/security: TLS on `465`
   - username: `resend`
   - password: `op://rhizome/shared-production/Resend/RESEND_API_KEY`
   - sender/from name and address from step 2
5. Send Supabase Auth test email if dashboard supports it.
6. Trigger one low-risk auth email in production for `sboagy+smoketest@gmail.com`.
7. Verify in:
   - Resend dashboard
   - recipient inbox
   - Supabase Auth behavior
8. Record the final configuration in `docs/supabase-auth-email.md` without exposing secrets.

This phase can be done manually first because it is a third-party dashboard setting and directly addresses the user-facing rate limit.

### Phase 2: Staging SMTP Configuration And Safety Policy

Purpose: wire staging to Resend while avoiding accidental real-user mail.

1. Configure staging using the current 1Password reference at `op://rhizome/shared-staging/Resend/RESEND_API_KEY`.
2. Define staging sender identity as `staging-auth@tunetrees.com` or a very similar staging-specific address on `tunetrees.com`.
3. Configure staging Supabase Auth custom SMTP using `op://rhizome/shared-staging/Resend/RESEND_API_KEY`.
4. Add a staging verification/safety step to the existing staging deployment/data-refresh plan:
   - do not mutate SMTP settings from CI;
   - verify expected environment variables/config references before any email-capable staging smoke test;
   - keep existing production-data sanitization requirements in force.
5. Use Resend test addresses such as `delivered@resend.dev` for smoke testing when possible.
6. Record expected staging behavior in `docs/supabase-auth-email.md`.

### Phase 3: Environment Reference Checks

Purpose: make local/staging/production intent visible without putting secrets in source control or introducing Supabase Management API token overhead.

Add lightweight rhizome documentation or local checks that confirm the repository references the expected secret paths and local behavior.

Possible checks:

- confirm required 1Password paths exist for staging and production;
- confirm local intentionally does not set Resend SMTP env for Supabase;
- confirm runbook values match the expected Resend host, port, username, and sender identities.

Do not use Supabase Management API access tokens for read-only audits or active SMTP changes.

### Phase 4: CI/Runbook Integration

Purpose: make the operational behavior durable after the manual dashboard migration is proven.

Implemented:

- Add `docs/supabase-auth-email.md` with:
  - production SMTP setup;
  - staging SMTP setup;
  - local Inbucket behavior;
  - safe test addresses;
  - rollback to Supabase default provider or alternate SMTP provider if needed.
- Add a README pointer to the runbook.

Not implemented by design:

- Do not add `.env.production.template` / `.env.staging.template` entries because deployment scripts do not need Resend keys directly.
- Do not add Resend secrets to frontend or worker bundles. Auth SMTP is a Supabase project setting, not app runtime code.
- Do not add Supabase Management API audit scripts.

## Non-Goals

- Do not change local Supabase to use Resend.
- Do not store Resend API keys in source control.
- Do not expose Resend API keys to browser code.
- Do not use or store Supabase Management API access tokens for this work.
- Do not automate Supabase dashboard SMTP configuration.
- Do not change Supabase database schema for this issue.
- Do not hand-edit generated files in TuneTrees or oosync.
- Do not alter app auth UI unless testing reveals a user-facing error message needs improvement.
- Do not configure staging to send arbitrary emails to copied production users.

## Rollback Plan

If production delivery fails after enabling Resend SMTP:

1. Disable custom SMTP in Supabase production Auth settings, or switch back to the previous provider setting.
2. Confirm Auth emails return to prior behavior.
3. Inspect Resend domain verification, sender address, API key, and SMTP logs.
4. Re-enable only after a controlled test email succeeds.

If staging delivery is unsafe:

1. Disable staging custom SMTP or point it to a safe sink/testing-only provider.
2. Stop staging data refresh or email-capable tests until sanitized users and SMTP safety are verified.
3. Record the failure mode in this plan before retrying.

## Verification Plan

### Local

- Start shared local Supabase from rhizome.
- Trigger a local auth email.
- Verify it appears in Inbucket.
- Verify no Resend dashboard event is created for the local test.

### Staging

- Trigger an auth email to a safe recipient or Resend test address.
- Verify Resend shows the expected simulated/real delivery.
- Verify staging Supabase uses the staging key, not production.
- Verify staging sender identity is `staging-auth@tunetrees.com` or the documented staging-specific equivalent.
- Verify copied/sanitized production users cannot receive staging email.

### Production

- Trigger a controlled production Auth email to `sboagy+smoketest@gmail.com`.
- Verify Resend logs show accepted delivery.
- Verify recipient receives email promptly.
- Verify production sender name is `TuneTrees Auth`.
- Verify production sender address is the final selected production address.
- Verify no Supabase 429/default-provider behavior appears during normal usage.

## Clarifying Questions

All clarifying questions are resolved. See "Resolved Decisions" above.

## Proposed First Implementation Pass After Approval

After you give the go-ahead:

1. Re-check current Supabase and Resend docs.
2. Add a rhizome runbook doc for Supabase Auth SMTP with Resend.
3. Add or update env templates only where needed, keeping local intentionally on Inbucket.
4. Add only lightweight environment-reference checks if useful; do not add Management API scripts.
5. Update this plan with final decisions and completed verification notes.
6. Record any follow-up tasks for staging account/domain separation.
