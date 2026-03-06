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
