# API Contracts: Comments

**Base path**: `/photos/:photoId/comments`
**Auth requirement**: All endpoints require `Authorization: Bearer <accessToken>`.

---

## POST /photos/:photoId/comments

Post a new comment on a photo.

### Request

```http
POST /photos/550e8400-e29b-41d4-a716-446655440000/comments
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "content": "Great shot!"
}
```

| Param | Location | Type | Required | Constraints |
|-------|----------|------|----------|-------------|
| `photoId` | path | UUID | yes | Must be a valid UUID |
| `content` | body | string | yes | 1–2000 chars, not whitespace-only |

### Responses

**201 Created** — Comment saved.

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

**400 Bad Request** — Validation failure (empty content, too long).

```json
{
  "statusCode": 400,
  "message": ["content must be longer than or equal to 1 characters"],
  "error": "Bad Request"
}
```

**404 Not Found** — Photo does not exist.

```json
{
  "statusCode": 404,
  "message": "Photo not found",
  "error": "Not Found"
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

## GET /photos/:photoId/comments

Retrieve all comments for a photo, ordered oldest first.

### Request

```http
GET /photos/550e8400-e29b-41d4-a716-446655440000/comments
Authorization: Bearer <accessToken>
```

| Param | Location | Type | Required |
|-------|----------|------|----------|
| `photoId` | path | UUID | yes |

### Responses

**200 OK**

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
  },
  {
    "id": "881gb733-...",
    "content": "Love the colors.",
    "createdAt": "2026-03-06T10:10:00.000Z",
    "author": {
      "id": "b2c3d4e5-...",
      "name": "John Smith"
    }
  }
]
```

Returns an empty array `[]` when no comments exist for the photo.

**404 Not Found** — Photo does not exist.

```json
{
  "statusCode": 404,
  "message": "Photo not found",
  "error": "Not Found"
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
