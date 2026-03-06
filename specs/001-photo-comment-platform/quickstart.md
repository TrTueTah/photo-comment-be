# Quickstart: Photo Comment Platform Backend

**Branch**: `001-photo-comment-platform`

---

## Prerequisites

- Node.js 20 LTS + pnpm
- PostgreSQL 15+ (local or Docker)
- AWS account with S3 bucket (or LocalStack for local dev)
- Google Cloud Console project with OAuth 2.0 credentials

---

## 1. Install dependencies

```bash
pnpm install
```

---

## 2. Configure environment

Copy and fill in the required values:

```bash
cp .env.example .env
```

`.env` contents:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/photo_comment_dev
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=24h

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=photo-comment-dev

PORT=3000
```

---

## 3. Set up the database

```bash
# Run migrations
pnpm exec prisma migrate dev

# (Optional) Seed data
pnpm exec prisma db seed
```

---

## 4. Start the server

```bash
# Development (watch mode)
pnpm run start:dev

# Production
pnpm run build
pnpm run start:prod
```

Server listens on `http://localhost:3000`.

---

## 5. Validate the setup

### Register a user

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"password123"}'
```

Expected: `201` with `{ "accessToken": "..." }`.

### Upload a photo (3-step presigned URL flow)

**Step 1 — Request a presigned URL from the backend**

```bash
ACCESS_TOKEN="<token from register>"

PRESIGN=$(curl -s -X POST http://localhost:3000/photos/presign \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"photo.jpg","contentType":"image/jpeg"}')

echo $PRESIGN
# { "presignedUrl": "https://...", "key": "photos/<uuid>.jpg", "expiresIn": 300 }

PRESIGNED_URL=$(echo $PRESIGN | python3 -c "import sys,json; print(json.load(sys.stdin)['presignedUrl'])")
S3_KEY=$(echo $PRESIGN | python3 -c "import sys,json; print(json.load(sys.stdin)['key'])")
```

Expected: `201` with `presignedUrl`, `key`, and `expiresIn`.

**Step 2 — Upload the file directly to S3**

```bash
curl -X PUT "$PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/path/to/photo.jpg
```

Expected: `200` from S3 (empty body). The file is now stored in S3.

**Step 3 — Confirm the photo with the backend**

```bash
curl -X POST http://localhost:3000/photos \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"key\":\"$S3_KEY\",\"caption\":\"My first photo\"}"
```

Expected: `201` with photo object including the public S3 URL.

### Fetch the feed

```bash
curl http://localhost:3000/photos \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: `200` with array of photo objects (newest first, with commentCount).

### Post a comment

```bash
PHOTO_ID="<id from upload response>"

curl -X POST http://localhost:3000/photos/$PHOTO_ID/comments \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Great shot!"}'
```

Expected: `201` with comment object.

### Get comments

```bash
curl http://localhost:3000/photos/$PHOTO_ID/comments \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected: `200` with array of comments (oldest first).

---

## 6. Run tests

```bash
# Unit tests
pnpm run test

# E2e tests
pnpm run test:e2e

# Coverage report
pnpm run test:cov
```

All tests must pass before marking any task complete.

---

## 7. Google OAuth flow (browser)

1. Visit `http://localhost:3000/auth/google` in a browser.
2. Complete Google consent screen.
3. Receive `{ "accessToken": "..." }` in the callback response.
4. Use the token as `Authorization: Bearer <token>` for subsequent requests.

---

## Local S3 alternative (LocalStack)

For local development without AWS costs:

```bash
# Start LocalStack
docker run -d -p 4566:4566 localstack/localstack

# Create bucket
aws --endpoint-url=http://localhost:4566 s3 mb s3://photo-comment-dev

# Set env vars
AWS_ENDPOINT_URL=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

Update `StorageService` to pass `endpoint` and `forcePathStyle: true` to the S3 client
when `AWS_ENDPOINT_URL` is set. Presigned URLs will then point to `localhost:4566`
instead of `amazonaws.com`, so the client must also call LocalStack for the PUT step.
