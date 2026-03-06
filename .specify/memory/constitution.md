<!--
## Sync Impact Report

**Version change**: (unversioned template) → 1.0.0
**Modified principles**: N/A (initial ratification, all principles are new)

### Added sections
- Core Principles (6 principles: Module-First, API Contract Clarity, Test Coverage,
  Data Integrity via Prisma, Input Validation, Simplicity)
- Technology Stack & Constraints
- Development Workflow
- Governance

### Removed sections
- N/A (initial constitution)

### Templates requiring updates
- `.specify/templates/plan-template.md` ✅ — Constitution Check section present; gates
  align with principles (module structure, Prisma, validation, tests).
- `.specify/templates/spec-template.md` ✅ — User stories, functional requirements, and
  success criteria sections align with BE-only scope and acceptance criteria expectations.
- `.specify/templates/tasks-template.md` ✅ — Task phases (setup, foundational, per-story)
  align with NestJS module-per-feature pattern and test-before-implement workflow.

### Follow-up TODOs
- None. All placeholders resolved.
-->

# Photo Comment Backend Constitution

## Core Principles

### I. Module-First Architecture

Every feature MUST be implemented as a dedicated NestJS module containing exactly one
controller (HTTP routing), one service (business logic), and one module file (wiring).
The root `AppModule` MUST import all feature modules and nothing else.

- Modules MUST be self-contained: no cross-service direct imports; communicate via
  injected services only.
- File naming convention: `<feature>.controller.ts`, `<feature>.service.ts`,
  `<feature>.module.ts`.
- No "utility-only" or "organizational-only" modules without a clear domain purpose.

**Rationale**: NestJS DI and the project's scaffold convention enforce this pattern.
Consistency across modules keeps the codebase navigable and testable at scale.

### II. API Contract Clarity

Every HTTP endpoint MUST have an explicit, documented contract before implementation
begins.

- HTTP verbs MUST be semantically correct (`GET` read-only, `POST` create, `PATCH`
  partial update, `DELETE` remove).
- Response shapes MUST be consistent: success returns the resource or a list; errors
  return `{ statusCode, message, error }`.
- HTTP status codes MUST be semantically accurate (200, 201, 400, 404, 422, 500).
- Breaking changes to an existing endpoint MUST be discussed before implementation.

**Rationale**: The backend serves a frontend (Next.js/Ant Design). Stable, documented
contracts prevent integration churn and miscommunication.

### III. Test Coverage (NON-NEGOTIABLE)

Unit tests MUST be written for every service method. E2e tests MUST cover every
controller endpoint.

- Unit tests (`*.spec.ts`) live alongside source files in `src/`.
- E2e tests live in `test/` and use the `jest-e2e.json` config.
- Tests MUST be written before (or concurrently with) implementation — never after the
  fact as an afterthought.
- All tests MUST pass before a feature is considered complete (`pnpm run test` and
  `pnpm run test:e2e` both green).
- Minimum coverage target: 80% line coverage on service files.

**Rationale**: The assignment explicitly assesses coding quality. Test coverage is a
direct signal of production-readiness and design clarity.

### IV. Data Integrity via Prisma

All database access MUST go through the Prisma ORM client. Raw SQL queries are
prohibited except for Prisma migrations.

- The schema of record is `prisma/schema.prisma`. No ad-hoc table changes.
- Every schema change MUST be accompanied by a migration (`prisma migrate dev`).
- The `PrismaService` MUST be the single injectable wrapper around `PrismaClient` and
  MUST be provided at the `AppModule` level (global or re-exported).
- Prisma schema field names MUST use camelCase; database column names use snake_case
  via `@map`.

**Rationale**: Prisma provides type-safe queries, migration history, and prevents schema
drift — critical for a PostgreSQL-backed service.

### V. Input Validation at Boundaries

All incoming request data (body, params, query) MUST be validated at the controller
boundary using NestJS `ValidationPipe` with `class-validator` DTOs.

- Every DTO MUST use `class-validator` decorators (`@IsString`, `@IsUUID`, etc.).
- `whitelist: true` and `forbidNonWhitelisted: true` MUST be enabled globally.
- Validation failures MUST return HTTP 400/422 with descriptive messages.
- No manual `if (!x) throw` style validation inside services — delegate to DTOs.

**Rationale**: Input validation at the boundary prevents invalid state from ever
reaching business logic or the database, and produces clear API error responses.

### VI. Simplicity — No Over-Engineering

Implement only what the requirements specify. Do not add features, abstractions, or
patterns not demanded by the current task.

- Authentication/authorization is NOT required for this assignment — do not add it.
- Image persistence does not need to be durable (demo upload only) — do not implement
  cloud storage unless explicitly requested.
- Repository pattern, CQRS, event sourcing, and similar patterns are PROHIBITED unless
  a clear, present need is demonstrated and documented in the Complexity Tracking table
  of the plan.
- Three similar lines of code is better than a premature abstraction.

**Rationale**: The take-home assignment is time-boxed to approximately one day. Scope
control is part of the assessment.

## Technology Stack & Constraints

- **Runtime**: Node.js (LTS) with TypeScript
- **Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Port**: 3000 (overridable via `PORT` env var)
- **Package manager**: pnpm
- **Testing**: Jest (unit), Jest + Supertest (e2e)
- **TypeScript config**: `noImplicitAny: false`, strict null checks enabled,
  `emitDecoratorMetadata: true`, `experimentalDecorators: true`
- **Source output**: compiled to `dist/`

### Out of Scope (this project)

- Authentication or user accounts
- Durable image storage (S3, GCS, etc.) — file upload demo only
- Pagination beyond basic offset/limit
- Real-time features (WebSockets, SSE)
- Multi-tenancy

## Development Workflow

1. **Spec first**: A `spec.md` MUST exist before implementation starts.
2. **Plan before code**: A `plan.md` with a Constitution Check MUST be approved before
   writing production code.
3. **Tests concurrent**: Write (or sketch) tests alongside implementation; never skip.
4. **Lint before commit**: `pnpm run lint` MUST pass with zero errors.
5. **Build verification**: `pnpm run build` MUST succeed before marking a task done.
6. **Single responsibility per PR**: Each PR addresses one user story or one foundational
   concern — no bundled unrelated changes.

## Governance

This constitution supersedes all other practices and informal agreements for the
`photo-comment-be` repository.

- **Amendment procedure**: Any principle change MUST be proposed as a diff to this file,
  reviewed, and ratified before the change takes effect. Rationale MUST be documented.
- **Versioning policy**:
  - MAJOR bump: principle removed, redefined, or governance rule changed in a
    backward-incompatible way.
  - MINOR bump: new principle or section added, or material guidance expanded.
  - PATCH bump: clarifications, wording, or typo fixes with no semantic change.
- **Compliance review**: Every plan's "Constitution Check" gate MUST reference the
  current version of this document and confirm no violations (or document justified
  exceptions in the Complexity Tracking table).
- **Violations**: Any code that violates a principle MUST be flagged during code review
  and MUST NOT be merged until resolved or formally exempted via the amendment procedure.

**Version**: 1.0.0 | **Ratified**: 2026-03-06 | **Last Amended**: 2026-03-06
