# TuneTrees Issue 683: oosync Sync Batching Plan

Issue: https://github.com/sboagy/tunetrees/issues/683

## Status

- [x] Initial architecture context read.
- [x] Initial issue and current-code survey.
- [x] Public Gemini share reviewed.
- [x] Clarifying questions answered.
- [x] OPFS and sync-optimization context reviewed.
- [x] Full-app baseline priority clarified.
- [x] Phase 0 implementation approved by Scott.
- [x] Initial TuneTrees baseline diagnostics added.
- [ ] Implementation complete.
- [ ] TuneTrees validation complete.
- [ ] cubefsrs validation complete.
- [ ] Temporary `oosync#sync-batch-683` consumer pins removed before closing plan.

Phase 0 implementation began after Scott's go-ahead on 2026-06-30.

## Scope

Optimize `oosync` network sync latency so TuneTrees sync performance scales primarily with payload size rather than row count or request count.

The primary product focus is TuneTrees, but the solution must remain generic and must also be covered in cubefsrs. The intended ownership is:

- `oosync.worktrees/os-sync-batch-683`: generic sync runtime and worker changes.
- `tunetrees.worktrees/tt-sync-batch-683`: consumer validation, dependency pin/lockfile updates, and generated-artifact refresh only if required.
- `cubefsrs.worktrees/cf-sync-batch-683`: consumer validation, dependency pin/lockfile updates, and generated-artifact refresh only if required.
- `/Users/sboag/gittt/tunetrees`: read-only reference only; do not edit.
- `/Users/sboag/gittt/rhizome`: planning and shared architecture documentation only unless a truly shared infrastructure/doc change is approved.

## Architecture Context Read

I read:

- `tunetrees.worktrees/tt-sync-batch-683/AGENTS.md`
- `tunetrees.worktrees/tt-sync-batch-683/ARCHITECTURE.md`
- `rhizome/AGENTS.md`
- `rhizome/ARCHITECTURE.md`
- `rhizome/design/shared_pwa_architecture.md`
- `cubefsrs.worktrees/cf-sync-batch-683/AGENTS.md`
- `cubefsrs.worktrees/cf-sync-batch-683/ARCHITECTURE.md`
- `oosync.worktrees/os-sync-batch-683/AGENTS.md`
- `oosync.worktrees/os-sync-batch-683/ARCHITECTURE.md`
- GitHub issue #683 body and visible comments.
- Public Gemini share: https://share.gemini.google/ivxwGgXDgcCX
- `plans/sync-opt-gemini.pdf`
- `plans/issue-opfs.md`

Important boundary conclusions:

- `oosync` must stay schema-agnostic. No TuneTrees or cubefsrs table names should be hard-coded into `oosync`.
- App-specific sync policy belongs in schema comments, `oosync.codegen.config.json`, generated artifacts, or app code.
- Generated files in TuneTrees and cubefsrs must not be hand-edited.
- TuneTrees uses the `public` schema; cubefsrs uses the `cubefsrs` schema; sibling apps must not import from or reference each other.
- Rhizome is the stable shared architecture and infrastructure authority for this workspace; keep shared decisions here, while still avoiding app-specific domain logic in Rhizome.

## Gemini Share Context

The public Gemini share is titled "Cloudflare Analytics Explained: Security & Performance" and is mainly about interpreting Cloudflare cache-rate analytics for a dynamic SPA.

Relevant conclusions for issue #683:

- A low Cloudflare cache rate is not automatically a problem for TuneTrees because most expensive interactions are authenticated SPA-to-Worker-to-Supabase calls, which should not be blindly edge-cached.
- The sync optimization work should stay focused on network/database round-trip reduction, batching, and hydration behavior rather than trying to raise Cloudflare cache-rate metrics for authenticated sync traffic.
- Caching remains useful for separate surfaces:
  - static SPA assets and R2/static media routing;
  - public/global reference data that is not user-specific;
  - expensive read-only aggregate responses where short TTL or stale-while-revalidate semantics are acceptable.
- Worker Cache API entries are local to the originating Cloudflare data center; they do not automatically replicate globally.
- `caches.default.put()` does not use Tiered Cache. Standard `fetch`/HTTP caching with `Cache-Control` is the path if tiered caching is required.

Plan implication: treat public/reference-data caching as a possible adjacent optimization, not as the primary implementation path for this issue's oosync batching acceptance criteria.

## OPFS And Local Persistence Context

The OPFS issue (`plans/issue-opfs.md`) tracks a separate follow-up migration from the current browser-local persistence model:

```text
SQLite in memory -> export bytes -> IndexedDB
IndexedDB bytes -> sqlite3_deserialize -> SQLite in memory
```

to OPFS-backed SQLite storage.

The Gemini PDF reinforces that OPFS is the correct long-term move for durability, lower memory pressure, crash safety, and avoiding whole-database export/import overhead. However, it also makes the important point that OPFS is not expected to solve the specific sync-latency problem in issue #683.

Current observed local footprint:

- User: `sboagy`
- IndexedDB-backed local database size: `6.92 MB`

Plan implications:

- A 6.92 MB local DB is small enough that raw local persistence size is unlikely to be the dominant cause of first-sync or update-sync waiting.
- This issue should stay focused on the oosync network path: browser-to-Worker request count, Worker-to-Supabase round trips, sequential database operations, JSON/protocol overhead, and query planning.
- OPFS should remain a separate migration after sync latency is improved, not a prerequisite or substitute for batching/hydration work.
- Instrumentation should still separate local apply/persistence time from network/Worker/database time so we can prove where the remaining wait lives.

## Decided Direction

Scott's answers refine the implementation direction:

- Start with generic worker-side batching for PUSH and evaluate whether that is enough before designing generated Postgres RPC delegation.
- Do not treat page-size increases as the real initial-sync solution. Prior experiments with page sizes were not enough, and the plan should not be timid about solving user-visible slowness.
- Optimize for user-perceived performance, especially initial hydration and rehydration. The data volume is relatively small; the problem is overhead and round-trip accumulation rather than enormous changed-row counts.
- Establish the baseline first in the full TuneTrees app against staging, not first in isolated `oosync` unit tests. Unit tests are still required before risky refactors, but they are not the primary baseline.
- If a clean TuneTrees login does not reach a usable updated state after multiple minutes, treat that as the first Phase 0 blocker. Diagnose and fix the stuck hydration/readiness path before judging batching improvements.
- Treat OPFS as a separate local-durability/storage migration; for the current `sboagy` local DB size of 6.92 MB, the sync path is the likely dominant bottleneck.
- Include a production-ready prepared-statement toggle, but keep it in a distinct phase.
- Test oosync changes with TuneTrees and cubefsrs from the feature branch/worktree before committing or merging oosync to `main`.

Initial performance target:

- Aim for initial hydration or rehydration to complete in under 5 seconds in representative local/staging conditions.
- Track network request count, worker/database round trips, and end-to-end elapsed time as diagnostics, but judge success primarily by the user's observed wait.
- Keep row-count stress tests as regression coverage, not as the main success metric.

## Issue Summary

The issue identifies three sync latency drains:

1. Worker PUSH currently applies incoming `SyncChange` rows sequentially inside a transaction, causing many edge-to-Postgres round trips.
2. Initial PULL is paginated through many discrete browser-to-worker requests.
3. `postgres-js` runs with `prepare: false`, so repeated SQL statements are parsed/planned repeatedly.

Acceptance criteria:

- PUSH handles multiple updates in a bulk database interaction rather than a row-by-row sequential loop.
- Initial hydration uses significantly fewer discrete HTTP round trips.
- Sync latency is decoupled from the number of changed items as much as practical.

## Current Implementation Notes

Observed in `oosync.worktrees/os-sync-batch-683`:

- Client outbox batch size defaults to `100` in `src/sync/service.ts` / `src/sync/engine.ts`.
- Initial sync client page size starts at `200` with fallback down to `25`.
- Worker initial sync clamps page size to `500` in `worker/src/index.ts`.
- Worker `processPushChanges(...)` loops changes sequentially and calls `applyChange(...)` per row.
- Worker `createDb(...)` uses `postgres(connectionString, { max: 1, prepare: false })`.
- Worker initial sync returns one page for one table at a time.
- Incremental sync also queries changed tables sequentially, but issue #683 is primarily about push batching and initial hydration.
- Current `sboagy` IndexedDB-backed local database size is 6.92 MB, which supports the view that sync latency is dominated by protocol/round-trip overhead rather than sheer local data size.
- `oosync` already has a generic dependency mechanism:
  - `src/codegen-schema.ts` introspects Postgres foreign keys.
  - `buildTableSyncOrder(...)` builds a parent-before-child topological order.
  - generated app metadata exposes this as `TABLE_SYNC_ORDER`.
  - the browser apply path uses `TABLE_SYNC_ORDER` to sort changes within each page.
- The current gap is that generated `SYNCABLE_TABLES` remains in the raw inferred/whitelist order, while the Worker initial-sync paginator walks `SYNCABLE_TABLES` directly. Therefore cold-start paging can fetch child tables before parent tables even though `TABLE_SYNC_ORDER` exists.

Observed in TuneTrees and cubefsrs:

- Both consume `oosync` from GitHub `main` and have worker packages that also depend on `oosync`.
- Both have `oosync.codegen.config.json` and generated worker/browser artifacts.
- TuneTrees has many RPC pull rules with `p_limit` / `p_offset` param mappings.
- cubefsrs has the younger oosync integration and should be treated as less battle-tested.

## Clarifying Questions For Scott

### 1. Gemini requirements

The private issue link was not accessible, but Scott provided the public share `https://share.gemini.google/ivxwGgXDgcCX`. I reviewed it and summarized it in "Gemini Share Context" above.

Please add anything from the Gemini conversation that is missing or incorrectly interpreted:

> Scott answer:
> https://share.gemini.google/ivxwGgXDgcCX

### 2. Preferred first implementation path

The issue says Postgres RPC delegate is preferred, but a generic RPC design has higher schema/codegen/migration complexity than a generic table-grouped worker batching design.

Recommendation: implement generic worker-side batching first, then add generated/RPC delegation only if benchmark data shows worker-side batching is not enough.

Do you agree?

> Scott answer:
> Ok, let's give that a try.

### 3. Initial sync response strategy

Recommendation: first raise initial page limits and return fuller pages across table boundaries in the existing JSON protocol. Treat streaming chunked JSON as a later phase because it changes client parsing, error handling, retry semantics, and Cloudflare behavior.

Do you agree?

> Scott answer:
> I don't think I agree with this.  I played with page sizes before.  I don't want to be timid about what needs to be done.  This needs to be solved, and I don't think changing page sizes will solve the giant problem of really slow sync.  Unless I'm misunderstanding your proposal.

Plan adjustment: agreed. Phase 2 is revised below from "larger pages" to "single/few-round-trip hydration." Larger limits may be a minor implementation detail, but they are not the strategy.

### 4. Benchmark target

What should count as success for issue #683?

Candidate metrics:

- Push 100 changed rows is at least 3x faster than baseline.
- Push 500 changed rows is at least 5x faster than baseline.
- Initial TuneTrees hydration uses at least 50% fewer `/api/sync` requests.
- No regressions in E2E sync correctness for TuneTrees or cubefsrs.

> Scott answer:
> I don't know.  The metrics have to be in terms of user-perceived performance.  For example, the initial hydration, or a re-hydration, is actually pretty small in terms of data.  Under 5 seconds?  I don't think that large numbers of changed rows is the problem here.

Plan adjustment: success metrics are now user-perceived hydration time first, with request/round-trip counts as supporting diagnostics. Large changed-row benchmarks stay useful only as regression/stress tests.

### 5. Prepared statements policy

Recommendation: do not enable `prepare: true` blindly in production. Add a config/env-controlled option or benchmark branch after confirming current Cloudflare Hyperdrive behavior.

Do you want this issue to include a production-ready prepared-statement toggle, or only a research note/benchmark result?

> Scott answer:
> Yes, include a production-ready prepared-statement toggle, so we can experiment with it.  But this work can go into a distinct phase.

Plan adjustment: prepared statements remain a separate phase and should produce an environment/config toggle suitable for staging/production experiments.

### 6. App dependency update sequencing

Recommendation: land and push `oosync` first, then update TuneTrees and cubefsrs to pin the resulting `oosync` commit and refresh lockfiles/generated artifacts only when needed.

Do you want both app repos updated in the same implementation pass after `oosync` is ready?

> Scott answer:
> Maybe it depends on what you mean by "implementation pass", but your recommendation here seems like what we've been doing with oosync changes.  It would be nice if we can avoid committing `oosync` to `main` until things are tested.

Plan adjustment: test TuneTrees and cubefsrs against the oosync feature branch/worktree first. Only after both consumers validate should oosync be committed/merged/pushed to the branch that app lockfiles will pin.

## Proposed Implementation Plan

### Phase 0: Full TuneTrees Staging Baseline And Guard Rails

Goal: measure the actual wait the user experiences in the full TuneTrees app against staging before changing sync behavior, while protecting generic boundaries.

The first baseline must be a clean TuneTrees login and hydration/rehydration run, not an isolated `oosync` microbenchmark. If that run never reaches a usable, updated app state after multiple minutes, the first implementation step is to add diagnostics that explain where it is stuck and then fix that blocker. Batching work should not hide or bypass a readiness bug.

Tasks:

- Add or use existing TuneTrees app, `oosync` client, and worker diagnostics to record a staging-runnable clean-login timeline:
  - auth/session ready;
  - local SQLite opened, migrated, and ready;
  - sync service started;
  - first `/api/sync` request sent and response received;
  - each hydration page/chunk requested, returned, and applied;
  - local apply and local persistence completed;
  - sync cursor/state updated;
  - app readiness signal reached;
  - repertoire list query issued, row count returned, and first render/update observed;
  - media/download jobs started, completed, failed, or timed out.
- Add diagnostics that distinguish the likely stuck states:
  - sync completed but the repertoire list did not re-query or render updated local rows;
  - sync is still paging/chunking remote data;
  - local apply/persistence is still running or failed;
  - media/download work is blocking or delaying app readiness;
  - local SQLite contains expected repertoire rows but UI state did not update;
  - local SQLite is missing expected repertoire rows after worker responses report changes;
  - outbox, pull cursor, or initial-sync state is wedged.
- Define the staging baseline runbook:
  - clear browser storage/local DB for the test user;
  - log in to staging;
  - wait until the app reaches usable repertoire-list state or a fixed timeout such as 5 minutes;
  - collect console, app diagnostics, worker diagnostics, `/api/sync` request counts, and elapsed timings;
  - repeat after a local reset/rehydration for the same account when practical.
- Treat a baseline as valid only if TuneTrees reaches a usable updated state. If it does not, Phase 0 becomes a stuck-hydration/readiness investigation before optimization.
- Record:
  - initial hydration elapsed time from auth/session-ready to local DB ready enough for the app to render useful data;
  - rehydration elapsed time after a cleared/reset local DB for an existing account;
  - number of `/api/sync` requests;
  - push change count;
  - push duration;
  - pull page count;
  - changes returned per page;
  - worker transaction duration;
  - database query/RPC duration when available;
  - total sync duration.
- Prefer a small reproducible staging measurement helper or E2E-style helper over ad hoc console timing, so Scott can run the same clean-login measurement and report comparable results.
- After the full-app baseline diagnostics are in place, create focused `oosync` unit tests around current push behavior before refactoring.
- Confirm no consumer-specific table names are introduced into `oosync`.
- Keep all generated consumer files untouched until the oosync changes are ready.

Likely validation:

- `npm run typecheck`
- `npm run lint`
- targeted `npm run test -- ...sync...` or equivalent Vitest filters.

Phase 0 findings from the first staging clean-login diagnostics:

- A clean TuneTrees staging login with baseline diagnostics enabled completed, but initial usable state arrived around `+112s`.
- The run made `55` sequential `/api/sync` POSTs, all HTTP 200.
- Observed request time totaled about `94s`, with roughly `1.7s` average per request.
- The browser logged `3,473` local `SQLITE_CONSTRAINT_FOREIGNKEY` failures during local apply:
  - `practice_record`: 1,722
  - `reference`: 567
  - `note`: 526
  - `repertoire_tune`: 521
  - `genre_tune_type`: 88
  - `rhythm_patterns`: 25
  - `media_asset`: 24
- The FK failures appear in page-sized blocks, which matches the current one-table-at-a-time initial paginator and the current generated `SYNCABLE_TABLES` order.
- `user_profile` being absent before first sync is a symptom of pre-hydration local state, not the main blocker; `user_profile` and repertoires are available immediately after initial sync completes.

### Phase 1: Dependency-Ordered Initial Pull

Goal: use the generic dependency information that oosync already computes so the Worker cold-start paginator pulls parent tables before child tables.

Concrete proposal:

- In `oosync/src/codegen-schema.ts`, compute `tableSyncOrder` before generating `table-meta.generated.ts`.
- Derive a stable `orderedSyncableTables` from `syncableTables` sorted by:
  - `tableSyncOrder[tableName]`;
  - table name as a deterministic tie-breaker.
- Pass `orderedSyncableTables` into `buildTableMetaTs(...)`, `buildAppTableMetaTs(...)`, `buildDefaultWorkerConfig(...)`, generated worker entrypoint inputs, and any other generated output that currently receives `syncableTables` as the iteration order.
- Keep `TABLE_SYNC_ORDER` generated as explicit metadata because browser apply, push ordering, and debugging still need the numeric order.
- Do not add TuneTrees-specific table names or config overrides. The order should continue to come from Postgres FK introspection plus existing optional `tableMeta.tableSyncOrderOverrides` in `oosync.codegen.config.json`.
- Regenerate TuneTrees and cubefsrs artifacts from the oosync change; do not hand-edit generated files.

Why this is Phase 1:

- It is smaller and safer than changing the sync protocol.
- It directly targets the observed FK storm.
- It preserves the current cursor format because the table index simply points into a better ordered `SYNCABLE_TABLES` list.
- It should reduce wasted local apply work even before larger/fewer hydration responses land.

Expected limitations:

- This will not by itself reduce the `55` serialized HTTP round trips when the total row count still spans many pages.
- Cycles or missing FK metadata can still leave some tables ordered by the append/tie-breaker path; the existing deferred-FK retry remains necessary.
- Existing generated order may be a visible diff for consumers, so tests should cover both TuneTrees and cubefsrs.

Expected tests:

- Unit-test codegen ordering with a small FK graph: parent table appears before child table in generated `SYNCABLE_TABLES`.
- Verify `TABLE_SYNC_ORDER` and `SYNCABLE_TABLES` are consistent for non-overridden tables.
- Verify `tableMeta.tableSyncOrderOverrides` still affects both numeric order and generated table iteration order.
- Verify a cycle/fallback case remains deterministic.
- Regenerate TuneTrees and cubefsrs and inspect generated diffs.
- Re-run the TuneTrees staging clean-login baseline and compare FK-error count, request count, and hydration elapsed time.

### Phase 2: Generic Batched PUSH In Worker

Goal: reduce edge-to-Postgres round trips for pushes while preserving existing per-table rules.

Design:

- Group incoming `SyncChange` entries by:
  - table;
  - operation: upsert vs delete;
  - push-rule compatibility, especially retry/minimal-payload rules.
- For compatible upserts, build one Drizzle `insert(table).values([...]).onConflictDoUpdate(...)` per table group.
- Keep row-level fallback for cases that cannot safely batch:
  - custom retry/minimal payload behavior;
  - malformed changes requiring precise error attribution;
  - tables whose generated metadata does not expose a safe conflict target.
- For soft deletes, batch `UPDATE ... WHERE key IN (...)` only where key shape is uniform and safe.
- For hard deletes, batch only where generated primary-key metadata supports it cleanly; otherwise use row-level fallback.
- Preserve dependency ordering by processing table groups in generated sync order.
- Preserve transaction semantics: all pushed changes in a request succeed or the request fails.

Key risk:

- Batched failures can make it harder to identify the bad row. The implementation should either split-and-retry on batch failure or report enough context to debug without corrupting state.

Expected tests:

- Multiple upserts for one table execute through the batched path.
- Mixed tables preserve generated dependency order.
- Deletes honor `denyDelete`.
- Push sanitization and auth-bound properties still apply before batching.
- Minimal-payload retry rules still work, even if they force fallback.
- Composite primary/conflict keys are covered.

### Phase 3: Single/Few-Round-Trip Hydration

Goal: make initial hydration and rehydration fast in user-perceived terms by eliminating protocol overhead and repeated request/transaction setup, not merely by nudging page sizes.

Design:

- Add an explicit hydration mode for initial sync / local rehydration that can return all required rows in one response when the estimated payload is safe.
- For larger accounts, return a small number of dense multi-table chunks rather than one table page per request.
- Make page/response sizing adaptive and based on approximate payload size or server limits, not only row count.
- Avoid a new browser-to-worker request for every table page when the total data is modest.
- Consider a streaming response only if a single JSON response is not robust enough; streaming is allowed in this phase if it is the right durable solution, but it must preserve retry and local apply semantics.
- Preserve the existing cursor concept for fallback/chunked hydration, but extend it if needed to represent table index, offset, and chunk budget after a partially filled multi-table response.
- Continue using `syncStartedAt` as the snapshot watermark.
- Respect `pullTables`, collections overrides, and RPC param overrides.
- Keep the current paginated path as a compatibility fallback until the new hydration path is proven.

Key risk:

- Very large JSON responses or streaming bodies can hit Worker CPU/memory/body-size limits or browser memory pressure, especially for TuneTrees catalog pulls. The fallback path should remain reliable.
- The local SQLite apply phase may become the visible bottleneck after network round trips are removed; Phase 0 instrumentation should separate network, worker, database, and local-apply time.

Expected tests:

- Initial hydration for a modest account can complete in one `/api/sync` request where payload limits allow.
- Initial sync advances across empty tables and multiple populated tables in one response/chunk.
- Cursor resumes correctly after a partially consumed table.
- RPC-backed pull rules receive correct `pageLimit` and `pageOffset`.
- `pullTables` still limits returned tables.
- Client fallback reduces response/chunk size after retriable failures.
- Existing clients can still use the old paginated request shape during deployment overlap.

### Phase 4: Production-Ready Prepared Statement Toggle

Goal: allow staging/production experiments with prepared statements without making them the default or risking an unguarded production rollout.

Design:

- Add an env/config switch such as `OOSYNC_POSTGRES_PREPARE=true` or `OOSYNC_POSTGRES_PREPARE=auto|true|false`.
- Default remains `prepare: false` until proven safe with Cloudflare Hyperdrive and request-scoped Worker clients.
- Emit diagnostics identifying whether prepared statements are enabled for a request.
- Benchmark both modes against local/direct Postgres and Hyperdrive/staging if available.
- Document operational guidance and rollback behavior.

Open question:

- Hyperdrive and Worker request-scoped I/O behavior may still make prepared statements risky or low-value compared with batching.

### Phase 5: Optional Postgres RPC Delegate

Goal: consider the issue's preferred RPC approach if generic batching is insufficient.

Possible architecture:

- Add codegen support that can emit per-consumer SQL function definitions or migration snippets for `sync_apply_changes(...)`.
- Keep the function schema-aware through generated metadata, not hard-coded in oosync runtime.
- Let the worker choose RPC delegation only when the consumer has installed the compatible function version.
- Preserve worker-side fallback for local development and older deployments.

Reasons to defer until after generic batching:

- It likely requires schema migration coordination in both TuneTrees and cubefsrs.
- It increases production compatibility risk because old workers and new database functions must overlap safely.
- It is harder to keep truly schema-agnostic unless the function is generated.

### Phase 6: Branch-Based Consumer Adoption

Goal: prove the generic `oosync` change works for both app repos before landing oosync to `main`.

Sequence:

1. Implement and validate in `oosync.worktrees/os-sync-batch-683`.
2. Link or pin TuneTrees and cubefsrs to the oosync feature branch/worktree for validation.
3. Run both consumer validation passes.
4. Only after consumer validation passes, commit/merge/push oosync to the branch or SHA that app repos will pin.
5. Refresh app lockfiles/pins to the final oosync SHA.
6. Before closing the plan, remove temporary `oosync#sync-batch-683` pins from TuneTrees and cubefsrs and re-reference `oosync#main`, unless the team explicitly chooses a release tag or immutable SHA as the final dependency policy.

TuneTrees:

- Validate against the oosync feature branch/worktree before oosync lands on `main`.
- Update the `oosync` dependency pin/lockfiles after the final oosync SHA is available.
- Closeout check: ensure TuneTrees no longer references temporary `oosync#sync-batch-683` pins before issue closure.
- Regenerate artifacts only if public generated output changes.
- Run relevant validation:
  - `npm run codegen:schema:check` if generated artifacts are involved;
  - `npm run typecheck`;
  - `npm run lint`;
  - targeted unit/E2E sync tests where practical.

cubefsrs:

- Validate against the oosync feature branch/worktree before oosync lands on `main`.
- Update the `oosync` dependency pin/lockfiles after the final oosync SHA is available.
- Closeout check: ensure cubefsrs no longer references temporary `oosync#sync-batch-683` pins before issue closure.
- Regenerate artifacts only if public generated output changes.
- Run relevant validation:
  - `npm run codegen:schema:check` if generated artifacts are involved;
  - `npm run typecheck`;
  - `npm run lint`;
  - `npm run build` or targeted E2E sync smoke tests where practical.

## Compatibility Review

Expected schema impact for Phases 1-4:

- No Supabase schema change.
- No generated consumer file change unless protocol/config surfaces are expanded.
- No destructive migration.
- Existing clients should continue to use the same `/api/sync` JSON contract if fields remain backward-compatible.

Potential compatibility issues:

- If the sync protocol adds fields, they must be optional and ignored by older workers/clients.
- If page cursors change shape, old cursors may fail during deployment overlap. Prefer versioned cursors and maintain decode compatibility where feasible.
- PWA/service-worker overlap means an old browser bundle may talk to a new worker. The worker must remain compatible with the current client request shape.
- A new app bundle may briefly talk to an old worker during deployment. Client changes should not require new worker behavior unless guarded.
- If hydration mode is added to the request protocol, it should be opt-in and old workers should either ignore it harmlessly or clients should detect capability/fallback.
- If prepared statements are enabled by env/config, rollback must be a config change rather than a code revert.

## Initial Recommendation

Proceed in this order after approval:

1. Add full TuneTrees staging diagnostics for clean login, hydration/rehydration, repertoire-list readiness, and download/media timing.
2. Run the clean-login baseline. If it does not reach a usable updated state, diagnose and fix that stuck hydration/readiness issue first.
3. Implement dependency-ordered initial pull by making generated `SYNCABLE_TABLES` follow the existing FK-derived `TABLE_SYNC_ORDER`.
4. Add focused `oosync` tests around current push behavior before refactoring the worker path.
5. Implement generic worker-side push batching in `oosync`.
6. Implement single/few-round-trip hydration for initial sync and rehydration, with compatibility fallback.
7. Add a production-ready prepared-statement toggle in a distinct phase, defaulting off.
8. Validate TuneTrees and cubefsrs against the oosync feature branch/worktree before oosync lands on `main`.
9. Update TuneTrees and cubefsrs to consume the final validated `oosync` commit.
10. Before closing, re-reference `oosync#main` in TuneTrees and cubefsrs, or document an explicit final release tag/SHA policy.
11. Revisit generated Postgres RPC delegation only if benchmarks show generic batching is not enough.
