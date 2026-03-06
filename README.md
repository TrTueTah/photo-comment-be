# Photo Comment Platform — Backend

A REST API backend for a simple social photo-sharing platform. Users can register or sign in (email/password or Google OAuth), upload photos directly to AWS S3, browse a global photo feed, view photo detail, and comment on photos. Built with NestJS, Prisma, and PostgreSQL.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [API Overview](#api-overview)
- [Photo Upload Flow](#photo-upload-flow)
- [Authentication Flow](#authentication-flow)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [AI-Assisted Development Workflow](#ai-assisted-development-workflow)

---

## Features

- **Email/Password Authentication** — register, login, logout with JWT access + refresh tokens
- **Google OAuth 2.0** — sign in with Google; auto-links to existing account if email matches
- **JWT Token Rotation** — short-lived access tokens (15m) + long-lived refresh tokens (7d)
- **Client-Direct S3 Upload** — backend issues presigned PUT URLs; file bytes never touch the server
- **Presigned GET URLs** — all image URLs returned to clients are time-limited signed S3 URLs (1hr)
- **Photo Feed** — global feed ordered newest first with comment counts per photo
- **Photo Detail** — single photo endpoint with uploader metadata and comment count
- **Comments** — post and list comments per photo (ordered oldest first)
- **Global Validation** — strict DTO validation on all request bodies via `class-validator`
- **Consistent Error Responses** — uniform `{ statusCode, message, error }` shape across all errors

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 LTS, TypeScript 5.x |
| Framework | NestJS 11 |
| ORM | Prisma 7 (adapter-pg) |
| Database | PostgreSQL |
| Auth | Passport.js — local, JWT, Google OAuth 2.0 strategies |
| Token signing | `@nestjs/jwt` (HS256) |
| File storage | AWS S3 via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` |
| Validation | `class-validator` + `class-transformer` |
| Password hashing | `bcryptjs` |
| Package manager | pnpm |

---

## Architecture

### Module Graph

```
AppModule
├── PrismaModule (global)        — database client, injected everywhere
├── AuthModule                   — registration, login, Google OAuth, token refresh
│   └── uses: PrismaService, JwtModule, PassportModule
│       strategies: local, jwt, google
├── PhotosModule                 — presign, confirm upload, feed, detail
│   └── uses: PrismaService, StorageModule
└── CommentsModule               — create and list comments per photo
    └── uses: PrismaService

StorageModule (shared)           — S3 presigned URL generation (no HTTP routes)
    └── imported by: PhotosModule
```

### Key Design Decisions

**1. Client-Direct S3 Upload**

The server never buffers image bytes. The upload flow is three steps:

```
Client → POST /photos/presign  → Backend generates presigned PUT URL
Client → PUT <presignedUrl>    → Client uploads directly to S3 (backend not involved)
Client → POST /photos          → Client confirms with S3 key; backend creates DB record
```

This keeps memory usage flat regardless of file size and eliminates upload timeout risk on the backend.

**2. Presigned GET URLs**

Photos are stored in a private S3 bucket. When returning photo data, the backend signs each object key with a `GetObjectCommand` (1-hour expiry). Clients receive a time-limited URL — never a permanent public link. The `url` column in the database stores the S3 object key, not a URL.

**3. JWT Dual-Token Strategy**

- Access token: signed via `JwtModule` defaults, short-lived (`JWT_EXPIRES_IN`, default `15m`)
- Refresh token: signed with a separate secret (`REFRESH_TOKEN_SECRET`), long-lived (default `7d`)
- Token rotation: `POST /auth/refresh` issues a new pair on every call
- Logout is stateless — the server has no blocklist; clients must discard both tokens

**4. Google OAuth Account Linking**

If a user registers with email/password and later signs in with Google using the same email, the accounts are merged — no duplicate accounts. The `googleId` is attached to the existing user record. After OAuth completes, the backend redirects to `<FRONTEND_URL>/auth/callback?accessToken=...&refreshToken=...`.

**5. Prisma 7 Adapter Pattern**

Prisma 7 removed the datasource URL from `schema.prisma`. The runtime client connects via `@prisma/adapter-pg`:

```ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
super({ adapter });
```

---

## API Overview

All protected endpoints require `Authorization: Bearer <accessToken>`.

### Auth — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | Public | Register with email + password → returns token pair |
| POST | `/auth/login` | Public | Login with email + password → returns token pair |
| GET | `/auth/google` | Public | Initiate Google OAuth (browser redirect) |
| GET | `/auth/google/callback` | Public | OAuth callback → redirects to frontend with tokens |
| POST | `/auth/refresh` | Public | Exchange refresh token for new token pair |
| POST | `/auth/logout` | Required | Stateless logout (client discards tokens) |

### Photos — `/photos`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/photos/presign` | Required | Get presigned S3 PUT URL for direct upload |
| POST | `/photos` | Required | Confirm completed upload, create photo record |
| GET | `/photos` | Required | Feed — all photos newest first with comment counts |
| GET | `/photos/:id` | Required | Single photo detail with uploader + comment count |

### Comments — `/photos/:photoId/comments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/photos/:photoId/comments` | Required | Post a comment on a photo |
| GET | `/photos/:photoId/comments` | Required | List all comments for a photo (oldest first) |

Full request/response contracts: [`specs/001-photo-comment-platform/contracts/`](specs/001-photo-comment-platform/contracts/)

Frontend integration guide: [`.claude/docs/ai/photo-comment-platform/api-handoff-v2.md`](.claude/docs/ai/photo-comment-platform/api-handoff-v2.md)

---

## Photo Upload Flow

```
1. Client selects file (validate: jpeg/png/gif/webp, ≤10 MB)

2. POST /photos/presign
   Body:     { filename: "photo.jpg", contentType: "image/jpeg" }
   Response: { presignedUrl, key, expiresIn: 300 }

3. PUT <presignedUrl>                    ← directly to S3, backend not involved
   Headers:  Content-Type: image/jpeg   ← must match step 2 exactly
   Body:     <raw file bytes>
   Response: 200 OK (from S3)

4. POST /photos
   Body:     { key: "photos/<uuid>.jpg", caption?: "optional" }
   Response: 201 { id, url (presigned 1hr), caption, createdAt, uploader }
```

---

## Authentication Flow

```
Register / Login
  └─ POST /auth/register  or  POST /auth/login
  └─ Receive { accessToken (15m), refreshToken (7d) }

Authenticated Request
  └─ Authorization: Bearer <accessToken>

Access Token Expired → 401
  └─ POST /auth/refresh { refreshToken }
  └─ Receive new { accessToken, refreshToken }
  └─ Retry original request

Refresh Token Expired → 401 on /auth/refresh
  └─ Redirect to login

Google OAuth
  └─ Navigate browser to GET /auth/google
  └─ User completes Google consent screen
  └─ Backend redirects to <FRONTEND_URL>/auth/callback?accessToken=...&refreshToken=...
  └─ Frontend reads query params, stores tokens, navigates to feed
```

---

## Project Structure

```
photo-comment-be/
├── src/
│   ├── app.module.ts                    # Root module
│   ├── main.ts                          # Bootstrap (global pipes, CORS, filter)
│   │
│   ├── auth/
│   │   ├── auth.controller.ts           # Auth HTTP routes
│   │   ├── auth.service.ts              # Business logic, token signing
│   │   ├── auth.module.ts
│   │   ├── dto/                         # register.dto, login.dto, refresh-token.dto
│   │   ├── strategies/                  # local.strategy, jwt.strategy, google.strategy
│   │   └── guards/                      # jwt-auth.guard, local-auth.guard, google-auth.guard
│   │
│   ├── photos/
│   │   ├── photos.controller.ts         # presign, confirm, findAll, findOne
│   │   ├── photos.service.ts
│   │   ├── photos.module.ts
│   │   └── dto/                         # presign-photo.dto, confirm-photo.dto
│   │
│   ├── comments/
│   │   ├── comments.controller.ts       # create, findByPhotoId
│   │   ├── comments.service.ts
│   │   ├── comments.module.ts
│   │   └── dto/                         # create-comment.dto
│   │
│   ├── storage/
│   │   ├── storage.service.ts           # S3 presigned PUT + GET URL generation
│   │   └── storage.module.ts
│   │
│   ├── prisma/
│   │   ├── prisma.service.ts            # PrismaClient wrapper using adapter-pg
│   │   └── prisma.module.ts             # @Global() module
│   │
│   └── filters/
│       └── http-exception.filter.ts     # Uniform error response shape
│
├── prisma/
│   ├── schema.prisma                    # User, Photo, Comment models
│   └── migrations/                      # Migration history
│
├── specs/001-photo-comment-platform/    # Design artifacts (see AI Workflow below)
│   ├── spec.md                          # User stories + acceptance criteria
│   ├── plan.md                          # Technical plan + constitution check
│   ├── research.md                      # Technical decisions with rationale
│   ├── data-model.md                    # Entity definitions + Prisma schema
│   ├── tasks.md                         # Ordered implementation task list
│   ├── quickstart.md                    # Integration test scenarios
│   └── contracts/
│       ├── auth.md                      # Auth endpoint contracts
│       ├── photos.md                    # Photo endpoint contracts
│       └── comments.md                  # Comment endpoint contracts
│
├── .claude/docs/ai/                     # AI-generated frontend handoff docs
├── prisma.config.ts                     # Prisma 7 CLI datasource config
├── .env.example                         # All required environment variables
└── CLAUDE.md                            # AI agent instructions for this repo
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PostgreSQL database (local or hosted, e.g. Supabase)
- AWS S3 bucket

### Installation

```bash
# Install dependencies
pnpm install

# Copy and fill environment variables
cp .env.example .env
# Edit .env — see Environment Variables section below

# Run database migrations
pnpm exec prisma migrate deploy

# Start development server (watch mode)
pnpm run start:dev
```

The API will be available at `http://localhost:8080` (or the `PORT` you set).

### Other Commands

```bash
pnpm run build        # Compile TypeScript to dist/
pnpm run start:prod   # Run compiled output
pnpm run lint         # ESLint with auto-fix
pnpm run test         # Unit tests (Jest)
pnpm run test:e2e     # End-to-end tests
pnpm run test:cov     # Tests with coverage report
```

---

## Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Yes | Access token signing secret | long random string |
| `JWT_EXPIRES_IN` | No | Access token lifetime (default `15m`) | `15m` |
| `REFRESH_TOKEN_SECRET` | Yes | Refresh token signing secret | long random string |
| `REFRESH_TOKEN_EXPIRES_IN` | No | Refresh token lifetime (default `7d`) | `7d` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth app client ID | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth app secret | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Yes | OAuth redirect URI (must match Google Console) | `http://localhost:8080/auth/google/callback` |
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key | — |
| `AWS_REGION` | Yes | S3 bucket region | `ap-southeast-1` |
| `AWS_S3_BUCKET` | Yes | S3 bucket name | `photo-comment-bucket` |
| `FRONTEND_URL` | No | Frontend origin for OAuth redirect (default `http://localhost:3001`) | `http://localhost:3001` |
| `PORT` | No | Server port (default `3000`) | `8080` |

---

## Database

### Data Model

```
User
  id           UUID (PK)
  email        String (unique)
  name         String
  passwordHash String?   — null for Google-only accounts
  googleId     String?   — null for password-only accounts
  createdAt    DateTime

Photo
  id        UUID (PK)
  userId    UUID (FK → User)
  url       String    — stores the S3 object key, e.g. "photos/<uuid>.jpg"
  caption   String?
  createdAt DateTime

Comment
  id        UUID (PK)
  photoId   UUID (FK → Photo)
  userId    UUID (FK → User)
  content   String
  createdAt DateTime
```

> The `url` column in `Photo` stores the **S3 object key**, not a URL. Presigned GET URLs (1-hour expiry) are generated at request time and returned to clients. Clients must not cache the `url` value beyond the expiry window.

### Migrations

```bash
# Create and apply a new migration (dev)
pnpm exec prisma migrate dev --name <description>

# Apply existing migrations (production / CI)
pnpm exec prisma migrate deploy
```

---

## AI-Assisted Development Workflow

This project was built end-to-end using **speckit** — an AI-driven specification and implementation workflow powered by Claude Code. The entire backend was designed, planned, and implemented through a structured series of AI slash commands, with all design artifacts committed alongside the code.

### The Pipeline

```
/speckit.constitution
        │
        ▼
/speckit.specify  ──────────────────────────────► spec.md
        │                                         (user stories, acceptance criteria)
        ▼
/speckit.plan  ──────────────────────────────────► research.md
        │                                          data-model.md
        │                                          contracts/
        │                                          quickstart.md
        ▼
/speckit.tasks  ─────────────────────────────────► tasks.md
        │                                          (40 ordered, dependency-aware tasks)
        ▼
/speckit.implement  ─────────────────────────────► source code
        │
        ▼
/backend-to-frontend-handoff-docs  ──────────────► api-handoff-v2.md
```

### Phase Details

#### `/speckit.constitution`
Establishes non-negotiable engineering principles before any code is written. Acts as a gate that every implementation plan must pass. For this project, the constitution defined six principles:

- **Module-First Architecture** — every feature in its own NestJS module
- **API Contract Clarity** — all endpoints documented in `contracts/` before implementation begins
- **Test Coverage** — unit and e2e tests mandated (not bypassed)
- **Data Integrity via Prisma** — no raw SQL; all DB access through `PrismaService`
- **Input Validation at Boundaries** — global `ValidationPipe`; all DTOs annotated with `class-validator`
- **Simplicity** — complexity requires justification (auth and S3 were explicitly requested by the user, so they were justified violations)

Stored at `.specify/memory/constitution.md`.

#### `/speckit.specify`
Converts a plain-English description into a structured specification — user stories, acceptance criteria, functional requirements, success metrics — with zero implementation details.

> Input: *"I want to build a photo comment platform. For authentication, use password-based and OAuth (Google). To store images, use S3 storage."*

Output: [`specs/001-photo-comment-platform/spec.md`](specs/001-photo-comment-platform/spec.md) — four user stories (US1: Auth, US2: Upload, US3: Feed, US4: Comments).

#### `/speckit.plan`
Translates the specification into a technical implementation plan. Runs a research phase to resolve unknowns, then produces:

- [`research.md`](specs/001-photo-comment-platform/research.md) — technical decisions with rationale (JWT strategy, Google OAuth approach, presigned S3 URLs vs server-side upload, Prisma global module)
- [`data-model.md`](specs/001-photo-comment-platform/data-model.md) — entity definitions, field constraints, relationships, Prisma schema
- [`contracts/`](specs/001-photo-comment-platform/contracts/) — full API contracts (request/response shapes, validation rules, error codes) for all endpoints **before a single line of code was written**
- [`quickstart.md`](specs/001-photo-comment-platform/quickstart.md) — end-to-end integration test scenarios
- [`plan.md`](specs/001-photo-comment-platform/plan.md) — constitution check gate, project structure decision, complexity tracking table

#### `/speckit.tasks`
Breaks the plan into an ordered, dependency-aware task list. Each task has:
- A sequential ID (`T001`–`T040`)
- A parallelization marker (`[P]`) where tasks can run concurrently
- A user story label (`[US1]`–`[US4]`) for traceability
- An exact file path — tasks are executable without additional context

Output: [`tasks.md`](specs/001-photo-comment-platform/tasks.md) — 40 tasks across 6 phases (Setup → Foundational → US1 → US2 → US3 → US4 → Polish).

#### `/speckit.implement`
Executes the task list phase by phase, reading all design artifacts before writing code, marking tasks complete as it goes, and halting on failures. Respects task dependencies and parallelization markers.

#### `/backend-to-frontend-handoff-docs`
After implementation, generates a frontend integration document from contracts, data model, and implemented code. Covers all endpoints, TypeScript interfaces, validation rules, integration flows, edge cases, and test scenarios — so the frontend team can build without asking backend questions.

Output: [`.claude/docs/ai/photo-comment-platform/api-handoff-v2.md`](.claude/docs/ai/photo-comment-platform/api-handoff-v2.md)

### Why This Matters

| Without speckit | With speckit |
|----------------|--------------|
| Code first, document later (or never) | Spec and contracts written before any code |
| Architecture decisions made ad-hoc during coding | Research phase resolves unknowns upfront |
| AI makes unconstrained choices | Constitution gates every plan against project principles |
| Tasks are implicit in the developer's head | Tasks are explicit, ordered, traceable to user stories |
| Frontend discovers API shape after backend ships | Handoff doc generated as a first-class artifact |
| No audit trail from requirement to implementation | Full traceability: description → spec → contracts → tasks → code |

All artifacts in `specs/` are source-controlled alongside the code, providing a complete history from the original feature description to the shipped implementation.
