# Rhizome Project AGENTS Instructions

Scope: repository-specific architecture, shared-boundary rules, and work-in-progress guidance for Rhizome.

Global execution guardrails live in `.github/copilot-instructions.md`. Treat this file as the canonical description of what Rhizome is today, what it is intended to become, and how agents should work safely inside that gap.

`ARCHITECTURE.md` is the repo-level architecture guide. `design/shared_pwa_architecture.md` is the cross-repo macro architecture guide. Read both before making changes that affect shared runtime boundaries, database deployment workflows, multi-repo responsibilities, or any migration toward the target shared-PWA design.

## Current Reality vs Target State

Rhizome is explicitly in transition.

- Today, this repo is primarily documentation and design material plus package metadata.
- The planned shared runtime/core package structure described in `ARCHITECTURE.md` is not fully present on disk yet.
- The macro-architecture in `design/shared_pwa_architecture.md` is the target direction, not a guarantee that every referenced folder or package already exists.

Default rule: unless the user explicitly asks you to build toward the target architecture, prefer changes that respect the current on-disk structure.

## What Rhizome Is For

Rhizome is intended to be the shared base repo for the broader workspace:

- Shared runtime/core logic that should be reused across apps rather than duplicated
- Shared infrastructure and deployment glue for a multi-app Supabase environment
- Design and architecture authority for the workspace as a whole

## Repo Status

Actual files currently present include:

- `.github/copilot-instructions.md`
- `ARCHITECTURE.md`
- `design/shared_pwa_architecture.md`
- `design/shared_pwa_architecture.drawio`
- `design/shared_pwa_architecture-multi-repo.drawio.svg`
- `package.json`

Important implication: if a doc references `packages/core/**`, `infra/**`, or other future layout, verify that those paths actually exist before coding against them.

## Tech Stack (Actual)

- Package/build metadata is present via `package.json`
- Build tooling currently points at `tsup` and TypeScript
- `solid-js` is listed as a peer/runtime-facing dependency for intended shared UI/runtime work
- The repo currently acts more like a shared-spec and scaffolding repo than a fully populated library package

## Design Authority Rules

- `design/shared_pwa_architecture.md` is the macro-architecture source for the multi-repo workspace.
- That document explicitly distinguishes current state from target state. Preserve that distinction in any new docs or code.
- If the Mermaid and draw.io diagrams diverge, treat the Mermaid architecture as authoritative when the document says so.

## Shared-Boundary Rules

- Rhizome should hold truly shared logic or infrastructure, not TuneTrees-only or cubefsrs-only behavior.
- Do not move app-specific features into Rhizome just because two repos happen to look similar.
- Shared auth UI, shared FSRS helpers, and shared infrastructure scripts belong here only when they are genuinely reusable.
- If a change would force Rhizome to import app repo code directly, stop and redesign.

## Documentation Expectations

- Architectural changes should update `ARCHITECTURE.md` and, when relevant, `design/shared_pwa_architecture.md` in the same change.
- If you create new shared directories or packages, document their purpose and intended consumers immediately.
- Avoid writing docs that present planned structure as already implemented.

## Work-In-Progress Guidance

- Be explicit about whether a path, package, or workflow is current, planned, or placeholder.
- Prefer additive scaffolding over speculative large-scale rewrites.
- If you need to introduce a new shared package or infra folder, keep it minimal and leave clear boundaries for future work.
- Do not assume local linking or publishing workflows such as `yalc` are fully wired end-to-end without verifying them.

## What To Read First For Changes

- Shared architecture or repo-responsibility changes: `ARCHITECTURE.md`, then `design/shared_pwa_architecture.md`
- Diagram/doc updates: `design/shared_pwa_architecture.md`, then the corresponding draw.io asset
- Package/build changes: `package.json`, then `ARCHITECTURE.md`
- Cross-repo database/deployment changes: `design/shared_pwa_architecture.md` first, then `ARCHITECTURE.md`

## Stop Signs

- A proposed change assumes folders or packages exist when they do not exist on disk.
- A proposed shared abstraction is still app-specific in naming or behavior.
- A doc update collapses the distinction between current state and target state.
- A change affects cross-repo boundaries but does not update the relevant architecture docs.