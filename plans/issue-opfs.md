**Title**
Adopt OPFS persistence for browser SQLite

**Description**
TuneTrees currently uses `@sqlite.org/sqlite-wasm` with an in-memory SQLite database and IndexedDB blob persistence:

```text
SQLite in memory -> export bytes -> IndexedDB
IndexedDB bytes -> sqlite3_deserialize -> SQLite in memory
```

This preserved the previous `sql.js` architecture during the engine swap, but it does not take advantage of SQLite WASM’s OPFS-backed persistence model. This issue tracks a follow-up migration to use Origin Private File System storage for browser-local SQLite.

**Goals**
- Move browser SQLite persistence from exported IndexedDB blobs to OPFS-backed SQLite storage.
- Preserve TuneTrees’ offline-first data flow:
  1. user action writes to local SQLite,
  2. outbox records pending sync,
  3. sync pushes/pulls through oosync.
- Keep local DB per-user namespacing.
- Maintain safe reset/recovery behavior through Supabase sync.
- Improve durability and reduce whole-database export/import overhead.

**Key Design Questions**
- Should SQLite run in a dedicated worker, shared worker, or main thread?
- How should multi-tab access be handled?
- Should each user get a separate OPFS database file, or should OPFS store one database with logical user separation?
- What headers or deployment changes are required for the preferred SQLite WASM OPFS mode?
- How should existing IndexedDB-backed databases migrate or reset?
- What is the fallback behavior if OPFS is unavailable?
- How should tests reset OPFS state deterministically in Playwright?

**Implementation Sketch**
- Research official `@sqlite.org/sqlite-wasm` OPFS APIs and worker requirements.
- Add an oosync browser SQLite backend abstraction so persistence mode can be selected without changing app call sites.
- Implement an OPFS-backed runtime path in oosync.
- Decide and implement multi-tab locking/coordination behavior.
- Update TuneTrees generated SQLite client config to opt into OPFS.
- Add reset/clear helpers for OPFS databases.
- Update E2E setup to clear OPFS state between users/tests.
- Keep or remove IndexedDB blob persistence after validating OPFS behavior.

**Testing**
- Unit test OPFS initialization and reset behavior where feasible.
- Browser test:
  - initialize local DB,
  - write data,
  - reload,
  - verify data persists without IndexedDB blob export/import.
- Multi-tab test:
  - open two tabs for same user,
  - verify expected locking or coordination behavior.
- Offline test:
  - write while offline,
  - reload offline,
  - verify outbox and local data persist.
- Recovery test:
  - reset OPFS database,
  - verify Supabase sync repopulates local state.

**Non-Goals**
- Changing sync semantics.
- Replacing Drizzle call sites unless OPFS forces that decision.
- Preserving pending offline-only changes from old IndexedDB blobs unless a migration path is explicitly designed.

**Acceptance Criteria**
- TuneTrees can use OPFS-backed SQLite in supported browsers.
- Existing offline-first workflows still pass.
- Local reset and E2E cleanup handle OPFS reliably.
- Multi-tab behavior is documented and tested.
- Fallback/reset behavior is clear for browsers without OPFS support.