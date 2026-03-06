# API Handoff: Photo Comment Platform (v2)

## Business Context

A simple social photo-sharing platform where authenticated users can upload photos, browse a feed of all photos, view a single photo's full detail, and comment on photos. Authentication supports email/password and Google OAuth — users signing in via Google with a matching email are linked to their existing account (no duplicate accounts). Photos are stored in AWS S3; the backend never handles file bytes, only issues presigned upload URLs and confirms completed uploads.

**Base URL**: `http://localhost:3000` (dev). Override with `PORT` env var.

---

## Authentication Overview

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

- **Access token**: short-lived JWT (default `15m`)
- **Refresh token**: long-lived JWT (default `7d`)
- When the access token expires, call `POST /auth/refresh` to get a new pair
- Logout is client-side — discard both tokens from storage
- The server is stateless; no token blocklist exists

---

## Endpoints

### POST /auth/register
- **Purpose**: Create a new account with email + password
- **Auth**: Public
- **Request**:
  ```json
  { "email": "user@example.com", "name": "Jane Doe", "password": "secret1234" }
  ```
- **Response** `201`:
  ```json
  { "accessToken": "eyJhbGci...", "refreshToken": "eyJhbGci..." }
  ```
- **Errors**: `400` validation array, `409` email already registered
- **Notes**: Returns tokens immediately — no separate login step needed after registration.

---

### POST /auth/login
- **Purpose**: Authenticate with email + password
- **Auth**: Public
- **Request**:
  ```json
  { "email": "user@example.com", "password": "secret1234" }
  ```
- **Response** `200`:
  ```json
  { "accessToken": "eyJhbGci...", "refreshToken": "eyJhbGci..." }
  ```
- **Errors**: `401` — invalid credentials (vague by design — no hint which field is wrong)

---

### GET /auth/google
- **Purpose**: Initiate Google OAuth 2.0 flow
- **Auth**: Public
- **Notes**: Browser redirect only — do NOT call via `fetch`/`axios`. Navigate with `window.location.href = '/auth/google'` or open a popup.

---

### GET /auth/google/callback
- **Purpose**: OAuth callback — called by Google, not by the client directly
- **Auth**: Public (OAuth state)
- **Response** `200`:
  ```json
  { "accessToken": "eyJhbGci...", "refreshToken": "eyJhbGci..." }
  ```
- **Errors**: `401` — OAuth denied or failed
- **Notes**: For SPA flows, have this callback page post tokens to the opener via `window.opener.postMessage(...)` and close itself.

---

### POST /auth/refresh
- **Purpose**: Exchange a refresh token for a new access + refresh token pair
- **Auth**: Public (refresh token IS the credential — no `Authorization` header)
- **Request**:
  ```json
  { "refreshToken": "eyJhbGci..." }
  ```
- **Response** `200`:
  ```json
  { "accessToken": "eyJhbGci...", "refreshToken": "eyJhbGci..." }
  ```
- **Errors**: `401` — expired, malformed, or missing refresh token
- **Notes**: Always replace BOTH stored tokens with the new pair. Token rotation is applied.

---

### POST /auth/logout
- **Purpose**: End session (stateless — instructs client to discard tokens)
- **Auth**: Required (Bearer token)
- **Request**: No body.
- **Response** `200`:
  ```json
  { "message": "Logged out successfully" }
  ```
- **Errors**: `401` — missing or invalid token
- **Notes**: Server does NOT invalidate the token. Client MUST delete both `accessToken` and `refreshToken` from storage.

---

### POST /photos/presign
- **Purpose**: Get a presigned S3 URL for direct client-side upload (Step 1 of upload flow)
- **Auth**: Required (Bearer token)
- **Request**:
  ```json
  { "filename": "vacation.jpg", "contentType": "image/jpeg" }
  ```
- **Response** `201`:
  ```json
  {
    "presignedUrl": "https://photo-comment-bucket-test.s3.ap-southeast-1.amazonaws.com/photos/550e8400-....jpg?X-Amz-Algorithm=...",
    "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300
  }
  ```
- **Errors**: `400` missing fields, `401` unauthorized, `422` unsupported content type
- **Notes**: `expiresIn` = 300 seconds (5 min). Save the `key` — it is required by `POST /photos`.

---

### PUT `<presignedUrl>` *(direct to S3 — not a backend endpoint)*
- **Purpose**: Upload file bytes directly to S3 (Step 2 of upload flow)
- **Auth**: Embedded in the URL — do NOT include `Authorization` header
- **Request**:
  ```
  PUT <presignedUrl>
  Content-Type: image/jpeg    ← must exactly match the contentType sent to /photos/presign
  Body: <raw file bytes>
  ```
- **Response**: `200` empty body from S3
- **Notes**: `Content-Type` mismatch returns `403` from S3 (not the backend). Max file size: 10 MB (client-side enforcement only).

---

### POST /photos
- **Purpose**: Confirm completed S3 upload and persist the photo record (Step 3 of upload flow)
- **Auth**: Required (Bearer token)
- **Request**:
  ```json
  { "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg", "caption": "My first photo" }
  ```
- **Response** `201`:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://photo-comment-bucket-test.s3.ap-southeast-1.amazonaws.com/photos/550e8400-....jpg",
    "caption": "My first photo",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "uploader": { "id": "a1b2c3d4-...", "name": "Jane Doe" }
  }
  ```
- **Errors**: `400` missing/invalid fields, `401` unauthorized
- **Notes**: Only call this after a successful S3 PUT. No S3 existence check is done server-side — calling this without a successful upload creates a broken record.

---

### GET /photos
- **Purpose**: Retrieve all photos (feed), newest first, with comment counts
- **Auth**: Required (Bearer token)
- **Response** `200`:
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://...amazonaws.com/photos/550e8400-....jpg",
      "caption": "My first photo",
      "createdAt": "2026-03-06T10:00:00.000Z",
      "uploader": { "id": "a1b2c3d4-...", "name": "Jane Doe" },
      "commentCount": 3
    }
  ]
  ```
- **Errors**: `401` unauthorized
- **Notes**: Returns `[]` when no photos exist. No pagination in v1. Use `commentCount` for display only; fetch full comments via `GET /photos/:id/comments`.

---

### GET /photos/:id
- **Purpose**: Get a single photo's full detail including uploader metadata and comment count
- **Auth**: Required (Bearer token)
- **Response** `200`:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://...amazonaws.com/photos/550e8400-....jpg",
    "caption": "My first photo",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "uploader": { "id": "a1b2c3d4-...", "name": "Jane Doe" },
    "commentCount": 3
  }
  ```
- **Errors**: `400` invalid UUID, `401` unauthorized, `404` photo not found
- **Notes**: Always use this endpoint to display photo detail — do NOT reuse data passed from the feed. Navigating to a detail view must trigger a fresh `GET /photos/:id` call regardless of what is already in local state.

---

### POST /photos/:photoId/comments
- **Purpose**: Post a comment on a photo
- **Auth**: Required (Bearer token)
- **Request**:
  ```json
  { "content": "Great shot!" }
  ```
- **Response** `201`:
  ```json
  {
    "id": "770fa622-e29b-41d4-a716-446655441111",
    "content": "Great shot!",
    "createdAt": "2026-03-06T10:05:00.000Z",
    "author": { "id": "a1b2c3d4-...", "name": "Jane Doe" }
  }
  ```
- **Errors**: `400` content empty or > 2000 chars, `401` unauthorized, `404` photo not found
- **Notes**: `photoId` path param must be a valid UUID — a non-UUID string returns `400` before hitting the database.

---

### GET /photos/:photoId/comments
- **Purpose**: Retrieve all comments for a photo, oldest first
- **Auth**: Required (Bearer token)
- **Response** `200`:
  ```json
  [
    {
      "id": "770fa622-...",
      "content": "Great shot!",
      "createdAt": "2026-03-06T10:05:00.000Z",
      "author": { "id": "a1b2c3d4-...", "name": "Jane Doe" }
    }
  ]
  ```
- **Errors**: `401` unauthorized, `404` photo not found
- **Notes**: Returns `[]` when no comments exist. Ordered ASC by `createdAt` (oldest first — thread-style). No pagination in v1.

---

## Data Models / DTOs

```typescript
interface TokenPair {
  accessToken: string;   // JWT, short-lived (default 15m)
  refreshToken: string;  // JWT, long-lived (default 7d)
}

interface Uploader {
  id: string;   // UUID
  name: string;
}

interface Author {
  id: string;   // UUID
  name: string;
}

// Returned by GET /photos, GET /photos/:id, POST /photos
interface PhotoItem {
  id: string;           // UUID
  url: string;          // Public S3 URL — use directly in <img src>
  caption: string | null;
  createdAt: string;    // ISO 8601 UTC
  uploader: Uploader;
  commentCount: number; // integer >= 0 (absent on POST /photos response)
}

interface Comment {
  id: string;        // UUID
  content: string;
  createdAt: string; // ISO 8601 UTC
  author: Author;
}

interface PresignResponse {
  presignedUrl: string; // Signed S3 URL — PUT file here
  key: string;          // Pass to POST /photos after successful upload
  expiresIn: number;    // Seconds until presignedUrl expires (300)
}
```

> **Note**: `POST /photos` response does not include `commentCount` (it is always 0 at creation time — infer it client-side rather than making an extra request).

---

## Validation Rules

| Field | Rules |
|-------|-------|
| `email` | Valid email format, max 254 chars |
| `name` | 1–100 chars |
| `password` | Min 8 chars |
| `caption` | Optional, max 500 chars |
| `content` (comment) | Required, 1–2000 chars, not whitespace-only |
| `contentType` (presign) | One of: `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| `key` (confirm upload) | Required, non-empty string |
| `photoId` / `id` (path) | Must be a valid UUID |
| `refreshToken` | Required, non-empty string |

Validation errors shape:
```json
{ "statusCode": 400, "message": ["field must be ..."], "error": "Bad Request" }
```

---

## Error Response Shape

All errors follow this consistent structure:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[]; // array for validation errors, string for others
  error: string;              // HTTP status text e.g. "Not Found"
}
```

---

## Business Logic & Edge Cases

- **Google account linking**: Registering via email first, then signing in with Google using the same email merges both — no duplicate accounts. The existing account gets a `googleId` attached.
- **Google-only accounts**: Have `passwordHash = null` — they cannot use `POST /auth/login`.
- **Stateless logout**: Server does not blocklist tokens. A stolen access token remains valid until expiry (15m). Client must clear storage.
- **S3 upload order is mandatory**: Always `POST /photos/presign` → PUT to S3 → `POST /photos`. Skipping the S3 PUT and calling `POST /photos` directly creates a broken record with an inaccessible URL.
- **Content-Type must match**: The `Content-Type` header on the S3 PUT must exactly match the `contentType` sent to `/photos/presign`. S3 returns `403` on mismatch (not the backend).
- **File size**: 10 MB limit is client-side only — backend does not enforce it in v1.
- **No delete/edit in v1**: Photos and comments cannot be modified or deleted.
- **No pagination in v1**: Both `GET /photos` and `GET /photos/:id/comments` return all records.
- **Extra fields rejected**: Server uses strict validation (`forbidNonWhitelisted: true`) — unknown fields in request body return `400`.

---

## Integration Notes

- **Auth flow**:
  1. Register or login → store `accessToken` + `refreshToken`
  2. Attach `Authorization: Bearer <accessToken>` to every protected request
  3. On `401` from protected endpoint → `POST /auth/refresh` → update stored tokens → retry
  4. On `401` from `POST /auth/refresh` → session expired → redirect to login

- **Photo upload flow**:
  1. Validate file type + size client-side
  2. `POST /photos/presign` → get `{ presignedUrl, key }`
  3. `PUT presignedUrl` with raw bytes + correct `Content-Type` (no `Authorization` header)
  4. On S3 `200` → `POST /photos` with `{ key, caption? }`
  5. Prepend returned photo to local feed state (set `commentCount: 0`)

- **Photo detail page flow**:
  1. On navigation to detail view (e.g. clicking a feed item), always call `GET /photos/:id` — do NOT reuse the object from the feed list
  2. In parallel, call `GET /photos/:id/comments` to load the comment thread
  3. After posting a comment, re-fetch `GET /photos/:id` to get the updated `commentCount`

- **Optimistic UI**: Safe for posting comments. Not recommended for photo upload confirmation (depends on async S3 result).

- **Caching**: No cache headers set. Safe to cache `GET /photos` in-memory; invalidate on new photo upload. Invalidate `GET /photos/:id` after posting a comment.

- **Real-time**: No WebSocket or SSE in v1. Poll as needed.

---

## Test Scenarios

1. **Register + browse feed**: Register → receive tokens → `GET /photos` → `200 []`
2. **Login with wrong password**: `POST /auth/login` bad password → `401`
3. **Duplicate email**: Register same email twice → `409 Conflict`
4. **Token refresh**: Access token expired → `GET /photos` → `401` → `POST /auth/refresh` → retry → `200`
5. **Expired refresh token**: `POST /auth/refresh` with stale token → `401 Invalid or expired refresh token`
6. **Full upload flow**: Presign → S3 PUT → confirm → `GET /photos` shows new item with `commentCount: 0`
7. **Content-Type mismatch on S3**: Presign with `image/jpeg`, PUT with `image/png` → S3 `403`
8. **Unsupported file type**: `POST /photos/presign` with `contentType: "video/mp4"` → `422`
9. **Get photo detail**: `GET /photos/:id` → `200` with uploader + commentCount
10. **Get non-existent photo**: `GET /photos/<valid-uuid-not-in-db>` → `404 Photo not found`
11. **Invalid UUID in path**: `GET /photos/not-a-uuid` → `400`
12. **Comment on non-existent photo**: `POST /photos/<valid-uuid>/comments` → `404`
13. **Empty comment**: `{ "content": "   " }` → `400`
14. **No auth header**: Any protected endpoint without `Authorization` → `401`
15. **Google account linking**: Register `x@y.com` via password, sign in with Google same email → same account returned

---

## Open Questions / TODOs

- **Google OAuth SPA callback**: Current `GET /auth/google/callback` returns JSON. For SPA flows, coordinate with backend on whether to redirect to a frontend URL with tokens in query params or use `postMessage`.
- **Pagination**: No pagination in v1. Request from backend if dataset grows.
- **Photo deletion**: Not in scope for v1.
- **`commentCount` on `POST /photos` response**: Currently absent — infer as `0` client-side or request backend to include it.
