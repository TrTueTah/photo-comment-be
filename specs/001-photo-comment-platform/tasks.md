---
description: "Task list for Photo Comment Platform backend implementation"
---

# Tasks: Photo Comment Platform

**Input**: Design documents from `specs/001-photo-comment-platform/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not included (not requested in spec).

**Organization**: Tasks are grouped by user story to enable independent implementation
and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1–US4), maps to spec.md priorities
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install all dependencies and prepare the development environment.

- [x] T001 Install runtime dependencies: `pnpm add @nestjs/passport passport passport-local passport-jwt passport-google-oauth20 @nestjs/jwt @aws-sdk/client-s3 @aws-sdk/s3-request-presigner @prisma/client class-validator class-transformer bcryptjs uuid`
- [x] T002 [P] Install dev/type dependencies: `pnpm add -D prisma @types/passport-local @types/passport-jwt @types/passport-google-oauth20 @types/bcryptjs @types/uuid`
- [x] T003 [P] Create `.env.example` at repo root with all variables from research.md §7: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, `PORT`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story can be
implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Configure global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) and enable CORS in `src/main.ts`
- [x] T005 Initialize Prisma (`pnpm exec prisma init`) and write `prisma/schema.prisma` with `User`, `Photo`, and `Comment` models exactly as specified in `specs/001-photo-comment-platform/data-model.md` (camelCase fields, `@map` for snake_case columns, `@@map` for table names)
- [ ] T006 Run initial database migration: `pnpm exec prisma migrate dev --name init` (requires `DATABASE_URL` set in `.env`)
- [x] T007 [P] Create `src/prisma/prisma.service.ts` — class that extends `PrismaClient` and calls `$connect()` in `onModuleInit()`
- [x] T008 [P] Create `src/prisma/prisma.module.ts` — decorated `@Global()`, provides and exports `PrismaService`
- [x] T009 Import `PrismaModule` in `src/app.module.ts` (first import — all feature modules will inherit it)
- [x] T010 [P] Create `src/storage/storage.service.ts` — injectable service with two methods: `generatePresignedUrl(filename: string, contentType: string): Promise<{ presignedUrl: string; key: string }>` (uses `PutObjectCommand` + `getSignedUrl`, 300 s expiry, key format `photos/<uuid>.<ext>`) and `getPublicUrl(key: string): string` (constructs `https://<bucket>.s3.<region>.amazonaws.com/<key>` from env vars)
- [x] T011 [P] Create `src/storage/storage.module.ts` — provides and exports `StorageService` (no controller)

**Checkpoint**: Prisma migrations applied, DB tables exist, PrismaModule global, StorageService ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — User Registration & Login (Priority: P1) 🎯 MVP

**Goal**: Users can register with email/password, log in, authenticate via Google OAuth,
and log out. All protected endpoints enforce JWT.

**Independent Test**: Register with `POST /auth/register` → receive JWT → call
`POST /auth/logout` → verify 200. Also: initiate Google OAuth at `GET /auth/google`
and complete the consent flow.

### Implementation for User Story 1

- [x] T012 [P] [US1] Create `src/auth/dto/register.dto.ts` — fields: `email` (`@IsEmail`), `name` (`@IsString`, `@MinLength(1)`, `@MaxLength(100)`), `password` (`@IsString`, `@MinLength(8)`)
- [x] T013 [P] [US1] Create `src/auth/dto/login.dto.ts` — fields: `email` (`@IsEmail`), `password` (`@IsString`, `@IsNotEmpty`)
- [x] T014 [P] [US1] Create `src/auth/strategies/local.strategy.ts` — `PassportStrategy(Strategy)` from `passport-local`; calls `AuthService.validateUser(email, password)`; throws `UnauthorizedException` on failure
- [x] T015 [P] [US1] Create `src/auth/strategies/jwt.strategy.ts` — `PassportStrategy(Strategy)` from `passport-jwt`; extracts `Bearer` token from header; validates payload `{ sub, email }`; returns user object
- [x] T016 [P] [US1] Create `src/auth/strategies/google.strategy.ts` — `PassportStrategy(Strategy)` from `passport-google-oauth20`; reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` from env; calls `AuthService.googleLogin(profile)`
- [x] T017 [P] [US1] Create `src/auth/guards/local-auth.guard.ts` — extends `AuthGuard('local')`
- [x] T018 [P] [US1] Create `src/auth/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`
- [x] T019 [P] [US1] Create `src/auth/guards/google-auth.guard.ts` — extends `AuthGuard('google')`
- [x] T020 [US1] Create `src/auth/auth.service.ts` with four methods: `register(dto)` — hash password with `bcryptjs`, throw `ConflictException` if email exists, create User via PrismaService, return JWT; `validateUser(email, password)` — find user, compare hash, return user or null; `login(user)` — sign JWT `{ sub: user.id, email }`; `googleLogin(profile)` — find user by googleId, link by email if exists, create new if not, return JWT
- [x] T021 [US1] Create `src/auth/auth.controller.ts` with five endpoints per `specs/001-photo-comment-platform/contracts/auth.md`: `POST /auth/register` (public, uses RegisterDto), `POST /auth/login` (uses LocalAuthGuard + LoginDto), `GET /auth/google` (uses GoogleAuthGuard), `GET /auth/google/callback` (uses GoogleAuthGuard, returns JWT), `POST /auth/logout` (uses JwtAuthGuard, returns success message)
- [x] T022 [US1] Create `src/auth/auth.module.ts` — imports `PassportModule`, `JwtModule.register({ secret, signOptions })` (reads env), declares controller, provides service and all three strategies and guards
- [x] T023 [US1] Register `AuthModule` in `src/app.module.ts`

**Checkpoint**: `POST /auth/register` and `POST /auth/login` return JWTs; `GET /auth/google` redirects to Google; `POST /auth/logout` returns 200. All other endpoints return 401 without a token.

---

## Phase 4: User Story 2 — Photo Upload (Priority: P1) 🎯 MVP

**Goal**: Authenticated users request a presigned S3 URL, upload directly to S3, then
confirm the upload to create a photo record. The backend never receives file bytes.

**Independent Test**: Call `POST /photos/presign` with valid `filename` and
`contentType` → receive `presignedUrl` + `key` → PUT file to `presignedUrl` using curl
→ call `POST /photos` with `key` → receive 201 with photo object including S3 URL.

### Implementation for User Story 2

- [x] T024 [P] [US2] Create `src/photos/dto/presign-photo.dto.ts` — fields: `filename` (`@IsString`, `@IsNotEmpty`), `contentType` (`@IsIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])`)
- [x] T025 [P] [US2] Create `src/photos/dto/confirm-photo.dto.ts` — fields: `key` (`@IsString`, `@IsNotEmpty`), `caption` (`@IsOptional`, `@IsString`, `@MaxLength(500)`)
- [x] T026 [US2] Create `src/photos/photos.service.ts` with two methods: `presignUpload(filename, contentType)` — delegates to `StorageService.generatePresignedUrl()`, returns `{ presignedUrl, key, expiresIn: 300 }`; `confirmUpload(userId, dto)` — calls `StorageService.getPublicUrl(key)`, creates Photo record via PrismaService with `userId`, `url`, `caption`, returns photo with uploader info
- [x] T027 [US2] Create `src/photos/photos.controller.ts` with two endpoints: `POST /photos/presign` (JwtAuthGuard, uses PresignPhotoDto, returns 201 with presigned URL response per contracts/photos.md) and `POST /photos` (JwtAuthGuard, uses ConfirmPhotoDto, returns 201 with photo object)
- [x] T028 [US2] Create `src/photos/photos.module.ts` — imports `StorageModule`, declares controller, provides service
- [x] T029 [US2] Register `PhotosModule` in `src/app.module.ts`

**Checkpoint**: Full presigned upload flow works end-to-end (presign → S3 PUT → confirm → photo appears in DB).

---

## Phase 5: User Story 3 — Browse Photos Feed (Priority: P2)

**Goal**: Authenticated users retrieve all photos newest-first, each with uploader name
and comment count.

**Independent Test**: After uploading at least one photo and posting at least one
comment, call `GET /photos` → verify array contains photo with `uploader.name` and
`commentCount` matching actual DB state.

### Implementation for User Story 3

- [x] T030 [US3] Implement `PhotosService.findAll()` in `src/photos/photos.service.ts` — Prisma query: `findMany({ include: { user: { select: { id, name } }, _count: { select: { comments: true } } }, orderBy: { createdAt: 'desc' } })`; map result to response shape `{ id, url, caption, createdAt, uploader: { id, name }, commentCount }`
- [x] T031 [US3] Add `GET /photos` endpoint to `src/photos/photos.controller.ts` — JwtAuthGuard, calls `PhotosService.findAll()`, returns 200 with array (empty array when no photos)

**Checkpoint**: `GET /photos` returns all photos newest-first with correct uploader and comment count.

---

## Phase 6: User Story 4 — Comment on a Photo (Priority: P2)

**Goal**: Authenticated users post text comments on any photo and retrieve comments for
a photo in chronological order.

**Independent Test**: `POST /photos/:id/comments` with valid content → 201; `GET /photos/:id/comments` → array with that comment, `author.name`, and timestamp. Non-existent photo ID → 404.

### Implementation for User Story 4

- [x] T032 [P] [US4] Create `src/comments/dto/create-comment.dto.ts` — field: `content` (`@IsString`, `@MinLength(1)`, `@MaxLength(2000)`, trim enforced in service)
- [x] T033 [US4] Create `src/comments/comments.service.ts` with two methods: `create(userId, photoId, dto)` — verify photo exists via PrismaService (throw `NotFoundException` if not), trim `content`, create Comment record, return comment with author info; `findByPhotoId(photoId)` — verify photo exists, return all comments for that photo ordered by `createdAt ASC` with author name
- [x] T034 [US4] Create `src/comments/comments.controller.ts` with two endpoints per `specs/001-photo-comment-platform/contracts/comments.md`: `POST /photos/:photoId/comments` (JwtAuthGuard, `ParseUUIDPipe` on photoId, uses CreateCommentDto, returns 201) and `GET /photos/:photoId/comments` (JwtAuthGuard, `ParseUUIDPipe` on photoId, returns 200 with array)
- [x] T035 [US4] Create `src/comments/comments.module.ts` — declares controller, provides service
- [x] T036 [US4] Register `CommentsModule` in `src/app.module.ts`

**Checkpoint**: All four user stories independently functional. Full platform demo possible.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, error shapes, and build verification.

- [x] T037 [P] Create `src/filters/http-exception.filter.ts` — implements `ExceptionFilter` for `HttpException`; returns `{ statusCode, message, error }` per contracts; register globally in `src/main.ts` via `app.useGlobalFilters()`
- [x] T038 Run `pnpm run lint` and fix all ESLint errors across `src/`
- [x] T039 Run `pnpm run build` and resolve any TypeScript compilation errors in `dist/`
- [ ] T040 Validate full setup using `specs/001-photo-comment-platform/quickstart.md` — execute all five curl flows: register, presign + S3 PUT + confirm, feed, post comment, get comments

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002 and T003 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 complete — BLOCKS all user stories
  - T007, T008, T010, T011 can run in parallel after T004
  - T005 must precede T006 (migration requires schema)
  - T009 must follow T008
- **US1 (Phase 3)**: Depends on Phase 2 — T012–T019 all parallel; T020 follows them; T021 follows T020; T022 follows T021; T023 follows T022
- **US2 (Phase 4)**: Depends on Phase 2 + Phase 3 (JWT guard needed); T024 and T025 parallel; T026 follows T024+T025; T027 follows T026; T028 follows T027; T029 follows T028
- **US3 (Phase 5)**: Depends on Phase 4 (PhotosService must exist)
- **US4 (Phase 6)**: Depends on Phase 3 (JWT guard) + Phase 4 (Photo entity must exist); T032 parallel; T033 follows T032; T034–T036 sequential
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Only needs Foundational — no story dependencies
- **US2 (P1)**: Needs US1 (JwtAuthGuard) — parallel with US1 after Phase 2 if team staffed
- **US3 (P2)**: Needs US2 (PhotosService must exist to extend `findAll`)
- **US4 (P2)**: Needs US1 (JwtAuthGuard) and US2 (Photo entity in DB) — can start in parallel with US3

### Parallel Opportunities Within Stories

```bash
# Phase 2 — after T004:
T007 (prisma.service.ts) || T008 (prisma.module.ts) || T010 (storage.service.ts) || T011 (storage.module.ts)

# Phase 3 — after foundational:
T012 (register.dto) || T013 (login.dto) || T014 (local.strategy) || T015 (jwt.strategy) ||
T016 (google.strategy) || T017 (local.guard) || T018 (jwt.guard) || T019 (google.guard)

# Phase 4:
T024 (presign.dto) || T025 (confirm.dto)

# Phase 6:
T032 (create-comment.dto) [parallel, then T033 depends on it]
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational — **CRITICAL, blocks everything**
3. Complete Phase 3: US1 (auth)
4. Complete Phase 4: US2 (photo upload)
5. **STOP and VALIDATE**: register → presign → S3 PUT → confirm → verify photo in DB
6. Deploy/demo minimal viable product

### Incremental Delivery

1. Setup + Foundational → infrastructure ready
2. Add US1 → auth works independently
3. Add US2 → photo upload works (presigned URL flow)
4. Add US3 → feed visible (extends existing PhotosService)
5. Add US4 → comments work independently
6. Polish → consistent errors, lint clean, build passes

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies — safe to run in parallel
- `[Story]` label maps each task to a specific user story for traceability
- All service methods must validate at the DB boundary, not just the DTO boundary
  (e.g., photo existence check in CommentsService before creating a comment)
- `bcryptjs` is used (pure JS, no native build step) — use `bcryptjs.hash(password, 10)`
- `uuid` package provides `v4()` for S3 object key generation in StorageService
- JWT secret and Google credentials must be in `.env` before running any auth endpoints
- `pnpm exec prisma generate` must be run after any `schema.prisma` change to update
  the Prisma client types
