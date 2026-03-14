# Rhizome Architecture Guide

This is the top-level architecture guide for the **Rhizome** repository, which serves as the infrastructure backbone and shared core library for the entire ecosystem.

Rhizome enables a "Multi-Repo, Single-Instance" architecture, allowing multiple independent PWA applications (TuneTrees, cubefsrs) to share a single Supabase backend while maintaining strict logical isolation.

## Repo Topology

Rhizome sits at the center of the workspace and provides the following:

- **Shared Core Library (`@rhizome/core`)**: A versioned npm package (linked via `yalc` locally) containing cross-app logic like FSRS (Spaced Repetition) math, shared SolidJS/Shadcn UI components, and Auth wrappers.
- **Infrastructure Tooling**: Global Supabase CLI configuration and custom `psql` deployment scripts for multi-tenant schema management.
- **Design Authority**: Host of the master architectural specifications for the ecosystem.

## Macro-Architecture & Design

Rhizome is the source of truth for the **Shared PWA Architecture**.

**🔴 AI AGENT DIRECTIVE: REQUIRED READING 🔴**
Before suggesting architectural changes, writing database migrations, or altering sync rules, you MUST read the macro-architecture rules defined in our Shared PWA Architecture document.

**How to fetch this context:**

1. **Local Workspace:** Try to read the local file at `./design/shared_pwa_architecture.md`.
2. **Cloud/Fallback:** If the local path is unavailable or you are in an isolated environment, fetch the document directly from: https://github.com/sboagy/rhizome/blob/main/design/shared_pwa_architecture.md

## Multi-Tenant Database Strategy

To maintain a single Supabase instance while allowing independent app evolution, Rhizome enforces schema isolation:

- **`public` schema**: Owned by TuneTrees.
- **`cubefsrs` schema**: Owned by cubefsrs.
- **`auth` schema**: Shared identity layer across all apps.

Rhizome provides the deployment glue that allows `cubefsrs` to apply migrations to its designated schema without conflicting with the Supabase CLI's primary migration history (which is tracked in the `public` schema).

## Key Components

- `packages/core/src/fsrs`: Standardized wrappers around the `ts-fsrs` algorithm.
- `packages/core/src/ui/auth`: Shared Auth screens and logic ensuring a consistent login experience.
- `infra/scripts/deploy-db.sh`: Custom scripts for deploying secondary app schemas.

## Guidance For AI Agents

- **Modifying Shared Logic**: Changes to FSRS math or Auth UI belong here. Ensure that updates are backward compatible for all consuming apps.
- **Infrastructure Changes**: Updates to the Supabase environment or deployment flow happen here.
- **Documentation**: All global architectural principles must be documented in `design/shared_pwa_architecture.md`.
