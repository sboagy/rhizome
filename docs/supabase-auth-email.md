# Supabase Auth Email With Resend SMTP

This runbook documents the manual Supabase Dashboard setup for TuneTrees transactional Auth email through Resend SMTP.

Issue: https://github.com/sboagy/tunetrees/issues/362

## Operating Rules

- Production and staging Supabase Auth SMTP settings are configured manually in the Supabase Dashboard.
- Do not automate these settings with the Supabase Management API.
- Do not store or use Supabase Management API access tokens for this workflow.
- Do not expose Resend API keys to browser code, worker code, checked-in env files, logs, or CI output.
- Keep local development on the shared rhizome Supabase Inbucket setup.
- Treat staging and production Resend API keys as separate secrets, even if the underlying 1Password values are temporarily identical.

## Source References

These values were checked against official docs on 2026-07-06. Re-check the source docs before changing provider settings.

- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase local CLI config: https://supabase.com/docs/guides/local-development/cli/config
- Resend SMTP: https://resend.com/docs/send-with-smtp
- Resend with Supabase SMTP: https://resend.com/docs/send-with-supabase-smtp
- Resend test emails: https://resend.com/docs/dashboard/emails/test-emails

## Shared SMTP Values

Use these values for deployed Supabase projects:

| Setting | Value |
| --- | --- |
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` |
| Security | TLS / implicit SSL |
| SMTP username | `resend` |
| SMTP password | Environment-specific Resend API key from 1Password |

Do not use these values for local development.

## 1Password Secret References

| Environment | 1Password reference |
| --- | --- |
| Production | `op://rhizome/shared-production/Resend/RESEND_API_KEY` |
| Staging | `op://rhizome/shared-staging/Resend/RESEND_API_KEY` |
| Local | May exist at `op://rhizome/shared-local/Resend/RESEND_API_KEY`; not wired into local Supabase |

The local reference may be available for future one-off manual experiments only. It must not be configured in `supabase/config.toml` or required for local Supabase startup.

## Production Setup

Use the production Supabase project and the production Resend key.

1. Open the production Supabase project in the Dashboard.
2. Navigate to the Auth SMTP settings.
3. Enable custom SMTP.
4. Configure:
   - SMTP host: `smtp.resend.com`
   - SMTP port: `465`
   - Security: TLS / implicit SSL
   - SMTP username: `resend`
   - SMTP password: value from `op://rhizome/shared-production/Resend/RESEND_API_KEY`
   - Sender name: `TuneTrees Auth`
   - Sender email: `admin@tunetrees.com`
5. If Scott explicitly chooses the alternate during setup, use `staging+admin@tunetrees.com` as the production sender email instead, and update this runbook plus the issue plan with that final choice.
6. Save the settings.
7. Send a Supabase Auth test email if the Dashboard offers that option.
8. Trigger one controlled production Auth email to `sboagy+smoketest@gmail.com`.
9. Verify:
   - Resend shows the email event.
   - The physical inbox receives the email promptly.
   - The email From display name is `TuneTrees Auth`.
   - The From address is the selected production sender.
   - Supabase no longer shows default-provider or rate-limit behavior for the controlled test.

## Staging Setup

Use the staging Supabase project and the staging Resend key.

The separate staging Resend account does not need to exist before this setup. The Dashboard should reference the current value stored behind `op://rhizome/shared-staging/Resend/RESEND_API_KEY`; Scott can later swap the underlying 1Password value without code changes.

1. Open the staging Supabase project in the Dashboard.
2. Navigate to the Auth SMTP settings.
3. Enable custom SMTP.
4. Configure:
   - SMTP host: `smtp.resend.com`
   - SMTP port: `465`
   - Security: TLS / implicit SSL
   - SMTP username: `resend`
   - SMTP password: value from `op://rhizome/shared-staging/Resend/RESEND_API_KEY`
   - Sender name: `TuneTrees Auth`
   - Sender email: `staging-auth@tunetrees.com` or a very similar staging-specific address on `tunetrees.com`
5. Save the settings.
6. Use Resend test addresses such as `delivered@resend.dev` for simulated delivery checks when possible.
7. Verify:
   - Resend shows the expected event.
   - Staging uses the staging key, not the production key.
   - The From address is visibly staging-specific.
   - Staging data-refresh and sanitization rules still prevent copied production users from receiving staging email.

## Local Development

Local development stays on the shared rhizome Supabase Inbucket setup.

Current local configuration lives in `supabase/config.toml`:

- `[inbucket] enabled = true`
- Inbucket web UI port: `54324`
- `[auth.rate_limit] email_sent = 2`

Do not add Resend SMTP settings to the local Supabase config. Local auth email should be verified in Inbucket, not in Resend.

Local verification:

1. Start local Supabase from rhizome.
2. Trigger a local Auth email.
3. Open the local Inbucket UI.
4. Confirm the email appears in Inbucket.
5. Confirm no matching Resend event was created.

## Safe Secret Checks

Use these only from a trusted shell with an authenticated 1Password CLI. They verify that a value exists without printing it:

```sh
op read "op://rhizome/shared-production/Resend/RESEND_API_KEY" >/dev/null
op read "op://rhizome/shared-staging/Resend/RESEND_API_KEY" >/dev/null
```

Do not run commands that echo or log the secret value. Do not add these secrets to frontend or worker env templates unless a future task introduces direct Resend API sending outside Supabase Auth.

## Rollback

If production delivery fails after enabling Resend SMTP:

1. Open the production Supabase Dashboard.
2. Disable custom SMTP or restore the previous provider settings.
3. Confirm Auth emails return to the prior behavior.
4. Inspect:
   - Resend domain verification for `tunetrees.com`
   - selected sender address
   - Resend API key used as SMTP password
   - Resend email event logs
   - Supabase Auth logs
5. Re-enable Resend only after a controlled test succeeds.

If staging delivery is unsafe:

1. Disable staging custom SMTP or point it to a testing-only/safe sink configuration.
2. Stop staging data refresh and email-capable tests until sanitization and SMTP safety are verified.
3. Re-test only with Resend test addresses or explicitly controlled staging recipients.

## Follow-Up Notes

- When the secondary staging Resend account is ready, replace the value behind `op://rhizome/shared-staging/Resend/RESEND_API_KEY`; no source changes should be needed.
- If the final production sender differs from `admin@tunetrees.com`, update this runbook and `plans/tunetrees-issue-362-resend-smtp.md`.
- If TuneTrees later sends transactional mail directly through the Resend API rather than through Supabase Auth SMTP, create a separate design note before introducing runtime secrets.
