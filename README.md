# rhizome
Shared core infrastructure and code for TuneTrees and CubeFSRS PWA apps

## Runbooks

- [Supabase Auth email with Resend SMTP](docs/supabase-auth-email.md)

## Package builds

Consumers install the committed `dist/` with `npm ci --ignore-scripts`.
They do not need to execute Rhizome or dependency installation scripts.

The **Build packaged dist** workflow installs with scripts disabled, explicitly
runs typecheck and build, verifies the package entry points, and uploads the
built output. Pull requests only validate; pushes to `main` also commit changed
`dist/` files in a separate job that has repository write access and runs no
package scripts. A manual run on `main` can refresh the output too.

Repository rules must allow `github-actions[bot]` to push the generated commit
to `main`; the workflow does not bypass branch protection. Bot pushes made with
`GITHUB_TOKEN` do not trigger another push workflow, preventing a build loop.
Wait for the workflow to finish and pin consumers to the resulting commit
containing the refreshed output, not the preceding source-only commit. No
consumer lockfiles are updated automatically. If a write is blocked, the build
artifact remains available, and the workflow fails rather than silently
claiming that the committed package is current.

To regenerate locally:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run build
```

TypeScript 7 remains the typechecker; `@typescript/typescript6` supplies the
JavaScript compiler API required by the declaration generator. Keep this build
dependency until the generator no longer needs that API.

Commit `dist/` with source changes when a feature-branch consumer needs the new
package before merge. `npm run yalc:push` also explicitly builds before publishing
locally. The optional `prepare` lifecycle hook builds when Vite is available and
propagates build failures; consumers using `--ignore-scripts` never run it.
