# API Contracts: Photos

**Base path**: `/photos`
**Auth requirement**: All endpoints require `Authorization: Bearer <accessToken>`.

---

## Upload flow overview

Photos are uploaded in two steps. The backend never handles the file bytes.

```
Client                         Backend                        AWS S3
  │                               │                              │
  │  POST /photos/presign         │                              │
  │  { filename, contentType } ──►│                              │
  │                               │── generate presigned PUT URL─►│
  │◄── { presignedUrl, key } ─────│                              │
  │                               │                              │
  │  PUT <presignedUrl>           │                              │
  │  (binary file directly) ─────────────────────────────────────►│
  │◄─────────────────────────────────────────── 200 OK ───────────│
  │                               │                              │
  │  POST /photos                 │                              │
  │  { key, caption? } ──────────►│                              │
  │                               │── INSERT Photo record ──────►│ (DB)
  │◄── 201 { photo object } ──────│                              │
```

---

## POST /photos/presign

Request a presigned S3 URL for direct client upload. The backend validates the content
type and generates an S3 object key. No file data is sent to the backend.

### Request

```http
POST /photos/presign
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "filename": "vacation.jpg",
  "contentType": "image/jpeg"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `filename` | string | yes | Used to derive file extension for the S3 key |
| `contentType` | string | yes | Must be one of: `image/jpeg`, `image/png`, `image/gif`, `image/webp` |

### Responses

**201 Created** — Presigned URL generated.

```json
{
  "presignedUrl": "https://photo-comment-dev.s3.ap-southeast-1.amazonaws.com/photos/550e8400-e29b-41d4-a716-446655440000.jpg?X-Amz-Algorithm=...",
  "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg",
  "expiresIn": 300
}
```

| Field | Description |
|-------|-------------|
| `presignedUrl` | Signed S3 URL. Client must `PUT` the file to this URL within `expiresIn` seconds |
| `key` | S3 object key — pass this to `POST /photos` after upload |
| `expiresIn` | Seconds until the presigned URL expires (300 = 5 minutes) |

**The client MUST send** `Content-Type: <contentType>` when PUTting to the presigned URL.
S3 will reject the request if the Content-Type does not match the signed value.

**422 Unprocessable Entity** — Unsupported content type.

```json
{
  "statusCode": 422,
  "message": "contentType must be one of: image/jpeg, image/png, image/gif, image/webp",
  "error": "Unprocessable Entity"
}
```

**400 Bad Request** — Missing or invalid fields.

```json
{
  "statusCode": 400,
  "message": ["filename should not be empty", "contentType should not be empty"],
  "error": "Bad Request"
}
```

**401 Unauthorized** — Missing or invalid token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## POST /photos

Confirm a completed S3 upload and create the photo record in the database. Call this
**after** the client has successfully PUT the file to the presigned URL.

### Request

```http
POST /photos
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "key": "photos/550e8400-e29b-41d4-a716-446655440000.jpg",
  "caption": "My first photo"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `key` | string | yes | S3 object key returned by `POST /photos/presign` |
| `caption` | string | no | Max 500 chars |

### Responses

**201 Created** — Photo record created.

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

**400 Bad Request** — Validation failure (empty key, caption too long).

```json
{
  "statusCode": 400,
  "message": ["key should not be empty"],
  "error": "Bad Request"
}
```

**401 Unauthorized** — Missing or invalid token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

---

## GET /photos

Retrieve all photos ordered newest first. Includes uploader info and comment count.

### Request

```http
GET /photos
Authorization: Bearer <accessToken>
```

No query parameters in v1 (no pagination).

### Response

**200 OK**

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

Returns an empty array `[]` when no photos exist.

**401 Unauthorized** — Missing or invalid token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```
