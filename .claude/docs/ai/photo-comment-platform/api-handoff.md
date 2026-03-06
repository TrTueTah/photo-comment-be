# API Handoff: Photo Comment Platform

## Business Context

A simple social photo-sharing platform where authenticated users can upload photos, browse a feed of all photos, and comment on them. Authentication supports both email/password registration and Google OAuth — users logging in via Google with a matching email are automatically linked to their existing account (no duplicate accounts). Photos are stored in AWS S3; the backend never handles file bytes — it only issues presigned upload URLs and confirms completed uploads.

**Base URL**: `http://localhost:3000` (dev). Override with `PORT` env var.

---

## Authentication Overview

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

The access token is a short-lived JWT (default `15m`). When it expires, use `POST /auth/refresh` with the refresh token (valid `7d`) to get a new pair. Store both tokens client-side (memory or secure storage). The server is stateless — logout means discarding tokens client-side.

---

## Endpoints

### POST /auth/register
- **Purpose**: Create a new account with email + password
- **Auth**: Public
- **Request**:
  ```json
  {
    "email": "user@example.com",
    "name": "Jane Doe",
    "password": "secret1234"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
  ```
- **Errors**:
  - `400` — Validation failure (array of messages in `message` field)
  - `409` — Email already registered
- **Notes**: Immediately returns tokens — no separate login step needed after registration.

---

### POST /auth/login
- **Purpose**: Authenticate with email + password
- **Auth**: Public
- **Request**:
  ```json
  {
    "email": "user@example.com",
    "password": "secret1234"
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
  ```
- **Errors**:
  - `401` — Invalid credentials (intentionally vague — no hint whether email or password is wrong)

---

### GET /auth/google
- **Purpose**: Initiate Google OAuth 2.0 flow
- **Auth**: Public
- **Request**: No body. Navigate the browser (full-page redirect or popup) to this URL.
- **Response**: Browser redirect to Google's consent screen — no JSON response.
- **Notes**: Do NOT call this via `fetch`/`axios`. Open in browser window: `window.location.href = '/auth/google'` or use a popup.

---

### GET /auth/google/callback
- **Purpose**: Google OAuth callback — called by Google, not by the client directly
- **Auth**: Public (handled by OAuth state)
- **Response** `200 OK`:
  ```json
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
  ```
- **Errors**:
  - `401` — OAuth denied or failed
- **Notes**: After Google redirects here, the server returns JSON with the token pair. In a full SPA flow, consider having this callback page post the tokens to the opener window via `window.opener.postMessage(...)` and close itself.

---

### POST /auth/refresh
- **Purpose**: Exchange a refresh token for a new access + refresh token pair (rotation)
- **Auth**: Public (refresh token IS the credential — no `Authorization` header)
- **Request**:
  ```json
  {
    "refreshToken": "eyJhbGci..."
  }
  ```
- **Response** `200 OK`:
  ```json
  {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
  ```
- **Errors**:
  - `401` — Refresh token expired, malformed, or missing
- **Notes**: Always replace BOTH stored tokens with the new pair returned. The old refresh token is invalidated after use (token rotation).

---

### POST /auth/logout
- **Purpose**: Instruct client to end session
- **Auth**: Required (Bearer token)
- **Request**: No body. Only the `Authorization` header is needed.
- **Response** `200 OK`:
  ```json
  { "message": "Logged out successfully" }
  ```
- **Errors**:
  - `401` — Missing or invalid token
- **Notes**: The server is stateless — this endpoint does not blocklist the token. Client MUST discard both `accessToken` and `refreshToken` from storage upon receiving this response.

---

### POST /photos/presign
- **Purpose**: Request a presigned S3 URL for direct client-side upload (Step 1 of 2)
- **Auth**: Required (Bearer token)
- **Request**:
  ```json
  {
    "filename": "vacation.jpg",
    "contentType": "image/jpeg"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "presignedUrl": "https://photo-comment-dev.s3.ap-southeast-1.amazonaws.com/photos/550e8400-e29b-41d4-a716-446655440000.jpg?X-Amz-Algorithm=...",
    "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg",
    "expiresIn": 300
  }
  ```
- **Errors**:
  - `400` — Missing `filename` or `contentType`
  - `401` — Missing or invalid token
  - `422` — Unsupported content type
- **Notes**: `expiresIn` is 300 seconds (5 minutes). After receiving this response, the client must PUT the file to `presignedUrl` within that window. The `key` must be saved and passed to `POST /photos`.

---

### PUT `<presignedUrl>` (direct to S3 — not a backend endpoint)
- **Purpose**: Upload file bytes directly to S3 (Step 2 of 2 — backend not involved)
- **Auth**: Embedded in the presigned URL query params (no additional auth header needed)
- **Request**:
  ```
  PUT <presignedUrl>
  Content-Type: image/jpeg      ← MUST match the contentType sent to /photos/presign
  Body: <raw file bytes>
  ```
- **Response**: `200 OK` (empty body from S3)
- **Notes**:
  - The `Content-Type` header MUST exactly match the value used when calling `/photos/presign`. S3 validates this and returns `403` on mismatch.
  - Do NOT send the `Authorization: Bearer` header to the presigned URL — it will break the request.
  - Recommended client-side file size limit: 10 MB (not enforced server-side in v1).

---

### POST /photos
- **Purpose**: Confirm completed upload and create photo record (Step 3 of 2 — save to DB)
- **Auth**: Required (Bearer token)
- **Request**:
  ```json
  {
    "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg",
    "caption": "My first photo"
  }
  ```
- **Response** `201 Created`:
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://photo-comment-dev.s3.ap-southeast-1.amazonaws.com/photos/550e8400-e29b-41d4-a716-446655440000.jpg",
    "caption": "My first photo",
    "createdAt": "2026-03-06T10:00:00.000Z",
    "uploader": {
      "id": "a1b2c3d4-...",
      "name": "Jane Doe"
    }
  }
  ```
- **Errors**:
  - `400` — `key` missing or `caption` exceeds 500 chars
  - `401` — Missing or invalid token
- **Notes**: Call this ONLY after the S3 PUT succeeds. If the S3 PUT fails, do not call this endpoint (it would create a broken photo record pointing to a non-existent S3 object). `caption` is optional — omit the field or pass `null`.

---

### GET /photos
- **Purpose**: Retrieve all photos (feed), newest first, with comment counts
- **Auth**: Required (Bearer token)
- **Request**: No body, no query params.
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "url": "https://photo-comment-dev.s3.ap-southeast-1.amazonaws.com/photos/550e8400....jpg",
      "caption": "My first photo",
      "createdAt": "2026-03-06T10:00:00.000Z",
      "uploader": {
        "id": "a1b2c3d4-...",
        "name": "Jane Doe"
      },
      "commentCount": 3
    },
    {
      "id": "661f9511-...",
      "url": "https://...",
      "caption": null,
      "createdAt": "2026-03-06T09:00:00.000Z",
      "uploader": {
        "id": "b2c3d4e5-...",
        "name": "John Smith"
      },
      "commentCount": 0
    }
  ]
  ```
- **Errors**:
  - `401` — Missing or invalid token
- **Notes**: Returns `[]` when no photos exist. No pagination in v1 — all photos are returned. `commentCount` is a computed integer — use it for display only; fetch actual comments separately via `GET /photos/:photoId/comments`.

---

### POST /photos/:photoId/comments
- **Purpose**: Post a comment on a photo
- **Auth**: Required (Bearer token)
- **Request**:
  ```
  POST /photos/550e8400-e29b-41d4-a716-446655440000/comments
  ```
  ```json
  { "content": "Great shot!" }
  ```
- **Response** `201 Created`:
  ```json
  {
    "id": "770fa622-e29b-41d4-a716-446655441111",
    "content": "Great shot!",
    "createdAt": "2026-03-06T10:05:00.000Z",
    "author": {
      "id": "a1b2c3d4-...",
      "name": "Jane Doe"
    }
  }
  ```
- **Errors**:
  - `400` — `content` empty or exceeds 2000 chars
  - `401` — Missing or invalid token
  - `404` — `photoId` does not exist
- **Notes**: `photoId` in the path must be a valid UUID — a non-UUID string returns `400` before hitting the database.

---

### GET /photos/:photoId/comments
- **Purpose**: Retrieve all comments for a photo, oldest first
- **Auth**: Required (Bearer token)
- **Request**:
  ```
  GET /photos/550e8400-e29b-41d4-a716-446655440000/comments
  ```
- **Response** `200 OK`:
  ```json
  [
    {
      "id": "770fa622-...",
      "content": "Great shot!",
      "createdAt": "2026-03-06T10:05:00.000Z",
      "author": {
        "id": "a1b2c3d4-...",
        "name": "Jane Doe"
      }
    }
  ]
  ```
- **Errors**:
  - `401` — Missing or invalid token
  - `404` — `photoId` does not exist
- **Notes**: Returns `[]` when the photo has no comments. Comments are ordered ASC by `createdAt` (oldest first — thread-style). No pagination in v1.

---

## Data Models / DTOs

```typescript
interface TokenPair {
  accessToken: string;   // JWT, short-lived (default 15m)
  refreshToken: string;  // JWT, long-lived (default 7d)
}

interface Uploader {
  id: string;    // UUID
  name: string;
}

interface Author {
  id: string;    // UUID
  name: string;
}

interface PhotoFeedItem {
  id: string;           // UUID
  url: string;          // Public S3 URL — ready to use in <img src>
  caption: string | null;
  createdAt: string;    // ISO 8601 UTC
  uploader: Uploader;
  commentCount: number; // Integer, >= 0
}

interface PhotoDetail {
  id: string;
  url: string;
  caption: string | null;
  createdAt: string;
  uploader: Uploader;
  // note: no commentCount on single-photo creation response
}

interface Comment {
  id: string;        // UUID
  content: string;
  createdAt: string; // ISO 8601 UTC
  author: Author;
}

interface PresignResponse {
  presignedUrl: string; // Signed S3 URL — PUT file here directly
  key: string;          // Save this; send to POST /photos after upload
  expiresIn: number;    // Seconds (300)
}
```

---

## Validation Rules

| Field | Rules |
|-------|-------|
| `email` | Valid email format, max 254 chars |
| `name` | 1–100 chars |
| `password` | Min 8 chars |
| `caption` | Optional, max 500 chars |
| `content` (comment) | Required, 1–2000 chars, not whitespace-only |
| `contentType` (presign) | Must be one of: `image/jpeg`, `image/png`, `image/gif`, `image/webp` |
| `key` (confirm photo) | Required, non-empty string |
| `photoId` (path param) | Must be a valid UUID |
| `refreshToken` | Required, non-empty string |

Validation errors return `400` with an array in `message`:
```json
{ "statusCode": 400, "message": ["email must be an email"], "error": "Bad Request" }
```

---

## Business Logic & Edge Cases

- **Google account linking**: If a user registers via email/password and later logs in with Google using the same email, the accounts are merged — no duplicate accounts are created. The existing account gets a `googleId` attached.
- **Google-only accounts**: Users who sign up via Google have `passwordHash = null`. They cannot log in via `POST /auth/login`.
- **Logout is client-side**: The server does not invalidate tokens on logout. The client must clear stored tokens. A stolen token remains valid until expiry.
- **Token expiry handling**: Access tokens expire after 15 minutes. Implement an interceptor/middleware that detects `401` responses and automatically calls `POST /auth/refresh` before retrying the original request.
- **S3 upload must precede DB confirmation**: There is no server-side check that the S3 key actually exists before creating the photo record. If the S3 upload is skipped but `POST /photos` is called, a broken photo record with an inaccessible URL will be created. Always complete the S3 PUT before calling `POST /photos`.
- **Content-Type mismatch on S3 PUT**: S3 validates the `Content-Type` header against the value embedded in the presigned URL. Mismatch returns `403` from S3 (not from the backend). Always pass the same `contentType` value to the S3 PUT that was used in `POST /photos/presign`.
- **File size**: No server-side enforcement in v1. Enforce 10 MB max client-side before calling `POST /photos/presign`.
- **No delete/edit**: Photos and comments cannot be deleted or edited in v1.
- **No pagination**: `GET /photos` and `GET /photos/:photoId/comments` return all records. Plan for potentially large responses as data grows.
- **Extra fields are rejected**: The server uses `forbidNonWhitelisted: true` — sending unknown fields in the request body returns `400`.

---

## Error Response Shape

All errors follow this consistent shape:

```typescript
interface ErrorResponse {
  statusCode: number;
  message: string | string[]; // array when multiple validation errors
  error: string;              // HTTP status text, e.g. "Bad Request"
}
```

---

## Integration Notes

- **Recommended auth flow**:
  1. Register (`POST /auth/register`) or login (`POST /auth/login` / Google OAuth)
  2. Store `accessToken` and `refreshToken`
  3. Attach `Authorization: Bearer <accessToken>` to every protected request
  4. On `401` from any protected endpoint: call `POST /auth/refresh`, update stored tokens, retry
  5. On `401` from `POST /auth/refresh`: session expired — redirect to login

- **Recommended photo upload flow**:
  1. User selects file → validate type (jpeg/png/gif/webp) and size (≤ 10 MB) client-side
  2. `POST /photos/presign` with `{ filename, contentType }`
  3. `PUT presignedUrl` with raw file bytes and `Content-Type` header — do NOT include `Authorization` header
  4. On S3 `200`: `POST /photos` with `{ key, caption? }`
  5. Prepend returned photo to the local feed state

- **Token storage**: Prefer `httpOnly` cookies if your frontend can configure the backend to set them. Otherwise use memory (not `localStorage`) for the access token and a secure cookie or `localStorage` for the refresh token.

- **Optimistic UI**: Safe for posting comments (low conflict risk). Not recommended for photo upload confirmation (depends on async S3 success).

- **Caching**: No cache headers set. Safe to cache `GET /photos` in-memory between navigations; invalidate on new photo upload or manual refresh.

- **Real-time**: No WebSocket or SSE in v1. Poll `GET /photos` and `GET /photos/:photoId/comments` manually if live updates are needed.

---

## Test Scenarios

1. **Register and access feed**: Register → receive tokens → `GET /photos` with access token → `200 []`
2. **Login with wrong password**: `POST /auth/login` with bad password → `401 Unauthorized`
3. **Duplicate email registration**: Register twice with same email → second call returns `409 Conflict`
4. **Token refresh**: Let access token expire → `GET /photos` → `401` → `POST /auth/refresh` → new tokens → retry `GET /photos` → `200`
5. **Expired refresh token**: Use an expired refresh token → `POST /auth/refresh` → `401 Invalid or expired refresh token`
6. **Full photo upload flow**: Presign → S3 PUT → confirm → `GET /photos` shows new photo with `commentCount: 0`
7. **Wrong Content-Type on S3 PUT**: Presign with `image/jpeg` but PUT with `Content-Type: image/png` → S3 returns `403`
8. **Unsupported content type**: `POST /photos/presign` with `contentType: "video/mp4"` → `422`
9. **Comment on non-existent photo**: `POST /photos/999/comments` → `400` (invalid UUID); `POST /photos/<valid-uuid>/comments` (non-existent) → `404`
10. **Empty comment**: `POST /photos/:id/comments` with `{ "content": "   " }` → `400`
11. **Access without token**: Any protected endpoint without `Authorization` header → `401`
12. **Google OAuth account linking**: Register with email `x@y.com` via password, then log in with Google using same email → same account returned (not a new one)

---

## Open Questions / TODOs

- **Google OAuth in SPA**: The current `GET /auth/google/callback` returns JSON directly. For a SPA, you'll need a strategy to pass tokens back to the opener window (e.g., `postMessage`) or redirect to a frontend URL with tokens in query params. Coordinate with backend on preferred approach.
- **Token storage recommendation**: Backend has no opinion on cookie vs. localStorage. Frontend team should decide based on XSS/CSRF tradeoffs.
- **Pagination**: `GET /photos` and comments endpoints return all records. If the dataset grows large, request pagination support from the backend team.
- **Photo deletion**: Not in v1 scope. Request if needed.
