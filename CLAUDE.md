# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # Install dependencies
pnpm run start:dev    # Run in watch mode (development)
pnpm run build        # Compile TypeScript to dist/
pnpm run start:prod   # Run compiled output
pnpm run lint         # ESLint with auto-fix
pnpm run test         # Run unit tests (Jest)
pnpm run test:e2e     # Run e2e tests
pnpm run test:cov     # Run tests with coverage
```

To run a single test file:
```bash
pnpm run test -- --testPathPattern=app.controller
```

## Architecture

This is a NestJS backend (photo commenting service) at early/scaffold stage. The app runs on port `3000` by default (overridable via `PORT` env var).

NestJS module structure: each feature lives in its own module with a `controller` (HTTP routing), `service` (business logic), and `module` (wires them together). The root `AppModule` (`src/app.module.ts`) imports all feature modules.

Unit tests (`*.spec.ts`) live alongside source files in `src/`. E2e tests live in `test/` and use `jest-e2e.json` config.

TypeScript is compiled to `dist/` with `noImplicitAny: false` and strict null checks enabled. Decorators (`emitDecoratorMetadata`, `experimentalDecorators`) are required for NestJS DI.

## Active Feature: 001-photo-comment-platform

**Language/Runtime**: TypeScript 5.x on Node.js 20 LTS
**Framework**: NestJS + Passport.js (local + google-oauth20 strategies) + @nestjs/jwt
**Database**: PostgreSQL via Prisma ORM
**Storage**: AWS S3 via @aws-sdk/client-s3
**Testing**: Jest (unit) + Jest/Supertest (e2e)

### Modules planned

- `PrismaModule` (global) — PrismaService wrapper
- `AuthModule` — register, login, Google OAuth, JWT, logout
- `PhotosModule` — upload (S3), feed
- `CommentsModule` — post comment, list comments
- `StorageModule` — S3 upload helper (no controller)

### Key spec artifacts

- `specs/001-photo-comment-platform/spec.md` — feature requirements
- `specs/001-photo-comment-platform/plan.md` — implementation plan
- `specs/001-photo-comment-platform/data-model.md` — Prisma schema + entities
- `specs/001-photo-comment-platform/contracts/` — REST API contracts
- `specs/001-photo-comment-platform/quickstart.md` — dev setup guide

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
