# Agent Instructions

## Goal Authority

- Read `docs/goals/README.md` and the active Goal before starting work.
- Keep exactly one active Goal. Ask first: “¿Este trabajo acerca el proyecto al Goal activo?”
- A blocked implementation path does not by itself block the active Goal. Record separately `GOAL ACTIVO`, `IMPLEMENTACIÓN BLOQUEADA` and `ARQUITECTURA DISPONIBLE`.
- Mark a Goal `BLOQUEADO` only after verifying that no useful architecture, planning, research, preparation, or implementation activity remains, or that an external dependency prevents all of them.
- If not, record it in the Backlog and continue with the next unblocked in-scope item.
- A Goal may be redefined only when product strategy changes, never because of new ideas, modules, or improvements.
- Work without subagents. Act as Lead Engineer until the PR is ready for merge and its functional capability is verified.

## Evidence

- Treat documentation, ADRs, merged PRs, and project-state files as hypotheses until verified against code.
- Verify every Epic end-to-end: frontend, backend, persistence, integrations, security, tests, and expected user result.
- Classify findings as planned work, bug, technical debt, pending decision, roadmap limitation, or documentation divergence.
- Update divergent documentation in the same PR when in scope; otherwise record the finding.

## Delivery

- Inspect architecture, domain, documentation, code, migrations, and technical dependencies before an Epic.
- Resolve missing in-scope dependencies first. For a new product or architecture decision, write an ADR and wait only for that approval.
- Keep PRs small, reversible, and tied to one Epic. Perform a merge if everything is green on GitHub.
- Audit the complete PR yourself. Fix blockers, update the PR, and repeat until the verdict is `APROBADO PARA MERGE`.
- `APROBADO PARA MERGE` closes only the audit of the current PR/Epic; it does not complete its Milestone or the active Goal. A Goal may be marked `COMPLETADO` only under the Goal closure rules in `docs/goals/README.md`.

## Package Manager

- Use **pnpm**: `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm build`.

## File-Scoped Commands

| Task          | Command                                                            |
| ------------- | ------------------------------------------------------------------ |
| API test      | `pnpm --filter @saas/api test -- --runInBand path/to/file.spec.ts` |
| API lint      | `pnpm --filter @saas/api exec eslint path/to/file.ts`              |
| Web lint      | `pnpm --filter @saas/web exec eslint path/to/file.tsx`             |
| API typecheck | `pnpm --filter @saas/api typecheck`                                |
| Web typecheck | `pnpm --filter @saas/web typecheck`                                |

## Key Conventions

- Preserve tenant isolation and immutable historical snapshots.
- Do not modify architecture or domain behavior without an approved decision.
- Preserve unrelated user changes in a dirty worktree.
- Completion means client usability, not compilation or a merged PR.

## Commit Attribution

AI commits must include `Co-Authored-By: Codex <noreply@openai.com>`.
