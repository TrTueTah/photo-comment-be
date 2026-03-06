# API Contracts: Authentication

**Base path**: `/auth`
**Auth requirement**: Endpoints in this file are public (no JWT required) unless noted.

---

## POST /auth/register

Register a new account with email and password.

### Request

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "secret1234"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | yes | Valid email format, max 254 chars |
| `name` | string | yes | 1–100 chars |
| `password` | string | yes | Min 8 chars |

### Responses

**201 Created** — Account created, tokens issued.

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**400 Bad Request** — Validation failure.

```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

**409 Conflict** — Email already registered.

```json
{
  "statusCode": 409,
  "message": "Email already registered",
  "error": "Conflict"
}
```

---

## POST /auth/login

Authenticate with email and password.

### Request

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret1234"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string | yes |
| `password` | string | yes |

### Responses

**200 OK** — Login successful.

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**401 Unauthorized** — Invalid credentials.

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

---

## GET /auth/google

Initiate Google OAuth 2.0 flow. Redirects the browser to Google's consent screen.
No request body. No JSON response — browser redirect only.

```http
GET /auth/google
```

---

## GET /auth/google/callback

Google OAuth callback. Called by Google after user grants consent.
Redirects are handled by Passport; on success a JWT is returned as JSON.

```http
GET /auth/google/callback?code=...&state=...
```

### Responses

**200 OK** — OAuth success, tokens issued.

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**401 Unauthorized** — OAuth flow failed or was denied.

```json
{
  "statusCode": 401,
  "message": "Google authentication failed",
  "error": "Unauthorized"
}
```

---

## POST /auth/refresh

Exchange a valid refresh token for a new access token and a new refresh token
(token rotation). No authorization header required — the refresh token is the credential.

### Request

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

| Field | Type | Required |
|-------|------|----------|
| `refreshToken` | string | yes |

### Responses

**200 OK** — New token pair issued.

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci..."
}
```

**401 Unauthorized** — Refresh token is missing, expired, or malformed.

```json
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "error": "Unauthorized"
}
```

---

## POST /auth/logout

Invalidate the current session. Stateless: server instructs client to discard token.
Requires a valid JWT bearer token.

### Request

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

### Responses

**200 OK**

```json
{
  "message": "Logged out successfully"
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
