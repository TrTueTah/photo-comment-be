# Implementation Plan: Photo Comment Platform

**Branch**: `001-photo-comment-platform` | **Date**: 2026-03-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-photo-comment-platform/spec.md`

## Summary

Build a NestJS REST API backend for a simple photo-comment platform. Users register or
sign in via email/password or Google OAuth 2.0. Photos are uploaded client-direct to AWS
S3 via presigned PUT URLs (the backend never handles file bytes). The API exposes a
global photo feed with comment counts and a per-photo comment list. Auth is enforced by
JWT bearer tokens; all DB access goes through Prisma on PostgreSQL.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS
**Primary Dependencies**: NestJS, Passport.js (local + google-oauth20 strategies),
@nestjs/jwt, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, Prisma,
class-validator, class-transformer
**Storage**: PostgreSQL (relational data) + AWS S3 (image files, client-direct upload)
**Testing**: Jest (unit, `pnpm run test`), Jest + Supertest (e2e, `pnpm run test:e2e`)
**Target Platform**: Linux server / local Docker (port 3000)
**Project Type**: REST web-service (single NestJS project)
**Performance Goals**: Support take-home demo traffic; no high-concurrency target
**Constraints**: File size max 10 MB (client-enforced); JWT access token (no refresh token);
presigned URL expiry 300 s
**Scale/Scope**: Single-tenant; all photos global; no pagination in v1

## Constitution Check

*Constitution v1.0.0 — GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Module-First Architecture | PASS | `AuthModule`, `PhotoModule`, `CommentModule`, `PrismaModule` — each with controller + service + module |
| II. API Contract Clarity | PASS | All 10 endpoints documented in `contracts/` before implementation |
| III. Test Coverage | PASS | Unit tests per service, e2e per controller endpoint — mandated in tasks |
| IV. Data Integrity via Prisma | PASS | All DB access through `PrismaService`; raw SQL prohibited |
| V. Input Validation at Boundaries | PASS | `ValidationPipe` global; all DTOs use class-validator |
| VI. Simplicity | JUSTIFIED VIOLATION — see Complexity Tracking | Auth + S3 explicitly requested by user after constitution ratification |

## Project Structure

### Documentation (this feature)

```text
specs/001-photo-comment-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── auth.md
│   ├── photos.md
│   └── comments.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app.module.ts                    # Root module — imports all feature modules
├── main.ts                          # Bootstrap, global pipes/cors
│
├── prisma/
│   ├── prisma.module.ts             # Global PrismaModule
│   └── prisma.service.ts            # PrismaClient wrapper
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts           # POST /auth/register, POST /auth/login,
│   │                                #   GET /auth/google, GET /auth/google/callback,
│   │                                #   POST /auth/logout
│   ├── auth.service.ts
│   ├── dto/
│   │   ├── register.dto.ts
│   │   └── login.dto.ts
│   ├── strategies/
│   │   ├── local.strategy.ts        # passport-local
│   │   ├── jwt.strategy.ts          # passport-jwt
│   │   └── google.strategy.ts       # passport-google-oauth20
│   └── guards/
│       ├── jwt-auth.guard.ts
│       ├── local-auth.guard.ts
│       └── google-auth.guard.ts
│
├── photos/
│   ├── photos.module.ts
│   ├── photos.controller.ts         # POST /photos/presign, POST /photos, GET /photos
│   ├── photos.service.ts
│   └── dto/
│       ├── presign-photo.dto.ts     # { filename, contentType }
│       └── confirm-photo.dto.ts     # { key, caption? }
│
├── comments/
│   ├── comments.module.ts
│   ├── comments.controller.ts       # POST /photos/:id/comments,
│   │                                #   GET /photos/:id/comments
│   ├── comments.service.ts
│   └── dto/
│       └── create-comment.dto.ts
│
└── storage/
    ├── storage.module.ts            # Presigned URL generator (no controller)
    └── storage.service.ts           # generatePresignedUrl(), getPublicUrl()

prisma/
├── schema.prisma
└── migrations/

test/                                # E2e tests
├── auth.e2e-spec.ts
├── photos.e2e-spec.ts
└── comments.e2e-spec.ts
```

**Structure Decision**: Single NestJS project (Option 1 variant). Feature modules follow
NestJS conventions. A shared `StorageModule` generates presigned S3 URLs and is imported
only by `PhotosModule` — it has no controller, making it a justified shared-service
module with a clear domain purpose (S3 presigning). No `multer` or file buffering on
the server.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Auth (Principle VI said out-of-scope) | User explicitly requested password-based + Google OAuth after constitution ratification | Skipping auth would not meet the stated spec requirements |
| S3 storage (Principle VI said demo-only) | User explicitly requested durable S3 storage | Local disk storage would not survive restarts or deployment |
| `StorageModule` (no controller, shared service) | Presigned URL generation is a distinct concern; extracting it keeps PhotosService focused | Embedding SDK calls directly in PhotosService would conflate HTTP handling and S3 concerns |
| Client-direct S3 upload (server never receives file) | User explicitly requested presigned URL approach; server-side streaming rejected | Server-side multer+S3 streaming would re-introduce file buffering on the server |
