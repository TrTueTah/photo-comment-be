# Data Model: Photo Comment Platform

**Branch**: `001-photo-comment-platform` | **Date**: 2026-03-06

---

## Entities

### User

Represents a registered account. Supports both email/password and Google OAuth login.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `email` | String | Unique, NOT NULL | Used as identity key for account linking |
| `name` | String | NOT NULL | Display name; sourced from Google profile or user input |
| `passwordHash` | String? | Nullable | NULL for Google-only accounts |
| `googleId` | String? | Unique, Nullable | NULL for email/password-only accounts |
| `createdAt` | DateTime | NOT NULL, default now | |

**Relationships**:
- One User → Many Photos (uploader)
- One User → Many Comments (author)

**Validation rules**:
- `email`: valid email format, max 254 chars
- `name`: 1–100 chars
- `passwordHash`: derived from raw password (min 8 chars) before storage; never stored raw
- Either `passwordHash` or `googleId` MUST be non-null (enforced at service layer)

---

### Photo

Represents an uploaded image with optional caption.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `userId` | UUID | FK → User.id, NOT NULL | Uploader |
| `url` | String | NOT NULL | Public S3 URL |
| `caption` | String? | Nullable, max 500 chars | |
| `createdAt` | DateTime | NOT NULL, default now | Used for feed ordering (DESC) |

**Relationships**:
- Many Photos → One User
- One Photo → Many Comments

**Validation rules**:
- `url`: non-empty, valid URL (enforced by S3 service, not DTO)
- `caption`: optional, max 500 chars (enforced in DTO)

---

### Comment

Represents a text comment on a photo.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | UUID | PK, auto-generated | |
| `photoId` | UUID | FK → Photo.id, NOT NULL | Target photo |
| `userId` | UUID | FK → User.id, NOT NULL | Commenter |
| `content` | String | NOT NULL, 1–2000 chars | |
| `createdAt` | DateTime | NOT NULL, default now | Used for chronological ordering (ASC) |

**Relationships**:
- Many Comments → One Photo
- Many Comments → One User

**Validation rules**:
- `content`: 1–2000 chars, must not be whitespace-only (enforced in DTO + service)

---

## Entity Relationship Diagram

```
User (id, email, name, passwordHash?, googleId?, createdAt)
 │
 ├──< Photo (id, userId, url, caption?, createdAt)
 │         │
 │         └──< Comment (id, photoId, userId, content, createdAt)
 │
 └──< Comment
```

---

## Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  name         String
  passwordHash String?   @map("password_hash")
  googleId     String?   @unique @map("google_id")
  createdAt    DateTime  @default(now()) @map("created_at")
  photos       Photo[]
  comments     Comment[]

  @@map("users")
}

model Photo {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  url       String
  caption   String?
  createdAt DateTime  @default(now()) @map("created_at")
  user      User      @relation(fields: [userId], references: [id])
  comments  Comment[]

  @@map("photos")
}

model Comment {
  id        String   @id @default(uuid())
  photoId   String   @map("photo_id")
  userId    String   @map("user_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  photo     Photo    @relation(fields: [photoId], references: [id])
  user      User     @relation(fields: [userId], references: [id])

  @@map("comments")
}
```

---

## State Transitions

No explicit state machines required for v1. Entities are created and read only
(no delete or edit in scope).

---

## Query Patterns

| Query | Description |
|-------|-------------|
| Photo feed | `SELECT photos + user.name + COUNT(comments) ORDER BY createdAt DESC` |
| Comments for photo | `SELECT comments + user.name WHERE photoId = :id ORDER BY createdAt ASC` |
| User by email | Used during login and account linking |
| User by googleId | Used during Google OAuth callback |
