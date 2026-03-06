# Feature Specification: Photo Comment Platform

**Feature Branch**: `001-photo-comment-platform`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "i want to build photo comment platform (just simple). For authentication, use password-based and oauth (google). to store image, using S3 storage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - User Registration & Login (Priority: P1)

A new visitor can create an account using an email address and password, or sign in with
their existing Google account. Once authenticated, the user stays logged in across page
visits. An existing user can log out at any time.

**Why this priority**: Authentication is the gateway to all other features. Without it,
no photo or comment action can be attributed to a user. All other stories depend on a
logged-in user.

**Independent Test**: Can be fully tested by registering a new account (email/password),
logging out, then logging back in — and by initiating Google OAuth and completing the
consent flow. Delivers a verified session with a user identity.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they submit a valid email and password,
   **Then** an account is created and they receive an authenticated session.
2. **Given** a visitor, **When** they choose "Continue with Google" and complete the
   Google consent screen, **Then** an account is created (or matched to an existing one)
   and they receive an authenticated session.
3. **Given** a user with an email/password account, **When** they attempt to register
   with the same email again, **Then** the system rejects the request with a clear error.
4. **Given** an authenticated user, **When** they log out, **Then** their session is
   invalidated and they can no longer access protected resources.
5. **Given** an unauthenticated visitor, **When** they attempt to access a protected
   resource, **Then** they receive an "unauthorized" response.

---

### User Story 2 - Photo Upload (Priority: P1)

An authenticated user can upload a photo from their device. The photo is stored
persistently and associated with the uploader. The user may optionally provide a caption.

**Why this priority**: Photo upload is the core action of the platform. Without it there
is no content for anyone to view or comment on. It is a P1 alongside authentication
because together they form the complete MVP.

**Independent Test**: Can be fully tested by uploading a valid image file as an
authenticated user and verifying the photo appears in the user's uploaded photos list
with its stored URL and optional caption.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they submit a valid image file (JPEG, PNG,
   GIF, WebP), **Then** the image is stored persistently and a photo record is created
   with a public-accessible URL and the uploader's identity.
2. **Given** an authenticated user, **When** they submit an image with an optional
   caption, **Then** the caption is stored alongside the photo.
3. **Given** an authenticated user, **When** they submit a file that is not an image,
   **Then** the system rejects the upload with a clear error message.
4. **Given** an authenticated user, **When** they submit a file exceeding the maximum
   allowed size (10 MB), **Then** the system rejects the upload with a clear error.
5. **Given** an unauthenticated visitor, **When** they attempt to upload a photo,
   **Then** the system rejects the request with an "unauthorized" response.

---

### User Story 3 - Browse Photos Feed (Priority: P2)

Any authenticated user can view all uploaded photos in a feed ordered from newest to
oldest. Each photo displays its image, uploader's name, caption (if any), upload time,
and total comment count.

**Why this priority**: Browsing the feed is the core consumption experience. It depends
on photos existing (User Story 2) and a logged-in user identity (User Story 1).

**Independent Test**: Can be fully tested by uploading at least one photo and then
fetching the photo feed — verifying the photo appears with correct metadata and comment
count.

**Acceptance Scenarios**:

1. **Given** at least one photo exists, **When** an authenticated user requests the
   photo feed, **Then** all photos are returned ordered newest-first with image URL,
   uploader name, caption, upload timestamp, and comment count.
2. **Given** no photos have been uploaded, **When** an authenticated user requests the
   feed, **Then** an empty list is returned (not an error).
3. **Given** an unauthenticated visitor, **When** they request the photo feed,
   **Then** the system rejects the request with an "unauthorized" response.

---

### User Story 4 - Comment on a Photo (Priority: P2)

An authenticated user can add a text comment to any photo. All comments on a photo are
visible to any authenticated user, displayed in chronological order with the commenter's
name and timestamp.

**Why this priority**: Commenting is the social layer of the platform. It requires
photos to exist and users to be authenticated, making it naturally a P2 after the P1
foundations.

**Independent Test**: Can be fully tested by posting a comment on an existing photo and
then fetching that photo's comments — verifying the comment appears with correct author
and timestamp.

**Acceptance Scenarios**:

1. **Given** a photo exists and the user is authenticated, **When** they submit a
   non-empty comment, **Then** the comment is saved and associated with the photo and
   the commenter.
2. **Given** a photo with comments, **When** an authenticated user requests its
   comments, **Then** all comments are returned in chronological order (oldest first)
   with commenter name and timestamp.
3. **Given** an authenticated user, **When** they submit an empty or whitespace-only
   comment, **Then** the system rejects it with a clear validation error.
4. **Given** an unauthenticated visitor, **When** they attempt to post a comment,
   **Then** the system rejects the request with an "unauthorized" response.
5. **Given** a non-existent photo ID, **When** an authenticated user attempts to comment
   on it, **Then** the system returns a "not found" error.

---

### Edge Cases

- What happens when a user uploads a valid file type but the file is actually corrupt?
  The system rejects the upload after failing to process it and returns a clear error.
- What happens when a Google account email matches an existing email/password account?
  The accounts are linked and the user is logged in to the existing account.
- What happens when a comment text exceeds a reasonable length (e.g., 2000 characters)?
  The system rejects the comment with a validation error citing the length limit.
- What happens when the photo storage service is temporarily unavailable during upload?
  The system returns a server error; the photo record is NOT created (no orphan records).
- What happens when a user's session token expires mid-session?
  The system returns an "unauthorized" response, prompting the client to re-authenticate.

## Requirements *(mandatory)*

### Functional Requirements

**Authentication**

- **FR-001**: System MUST allow users to register with a unique email address and a
  password.
- **FR-002**: System MUST validate that passwords meet a minimum security standard
  (at least 8 characters).
- **FR-003**: System MUST allow users to authenticate via Google OAuth 2.0.
- **FR-004**: System MUST issue a session token (JWT) upon successful authentication
  that can be used to access protected resources.
- **FR-005**: System MUST link Google OAuth accounts to existing email/password accounts
  that share the same email address.
- **FR-006**: System MUST allow authenticated users to log out, invalidating their
  session.
- **FR-007**: System MUST reject unauthenticated requests to all protected endpoints.
- **FR-019**: System MUST issue a short-lived access token and a long-lived refresh token
  upon successful authentication (register, login, Google OAuth).
- **FR-020**: System MUST provide an endpoint to exchange a valid refresh token for a
  new access token and a new refresh token (token rotation).
- **FR-021**: System MUST reject expired or malformed refresh tokens with an
  "unauthorized" error.

**Photo Management**

- **FR-008**: System MUST accept image file uploads in JPEG, PNG, GIF, and WebP formats.
- **FR-009**: System MUST reject image uploads exceeding 10 MB.
- **FR-010**: System MUST store uploaded images in persistent, publicly accessible
  remote storage.
- **FR-011**: System MUST associate each uploaded photo with the authenticated uploader.
- **FR-012**: System MUST allow an optional caption (max 500 characters) per photo.
- **FR-013**: System MUST expose a feed endpoint returning all photos ordered newest
  first, including image URL, uploader name, caption, upload timestamp, and comment
  count.

**Comments**

- **FR-014**: System MUST allow authenticated users to post a text comment on any
  existing photo.
- **FR-015**: System MUST reject empty or whitespace-only comments.
- **FR-016**: System MUST enforce a maximum comment length of 2000 characters.
- **FR-017**: System MUST expose an endpoint returning all comments for a given photo,
  ordered oldest first, with commenter name and timestamp.
- **FR-018**: System MUST return a "not found" error when commenting on a non-existent
  photo.

### Key Entities

- **User**: Represents an account on the platform. Has a unique identity, display name,
  email address, optional password (for email/password auth), and optional Google
  identity (for OAuth). A user can upload many photos and write many comments.
- **Photo**: Represents an uploaded image. Belongs to one user. Has a persistent storage
  URL, an optional caption, and an upload timestamp. A photo can have many comments.
- **Comment**: Represents a text response to a photo. Belongs to one user and one photo.
  Has text content and a creation timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can complete registration (email/password) and be ready to
  upload photos in under 60 seconds.
- **SC-002**: A user can complete a Google OAuth sign-in flow in under 30 seconds.
- **SC-003**: An authenticated user can upload a 5 MB photo and receive a success
  response within 10 seconds under normal network conditions.
- **SC-004**: The photo feed returns all photos with correct metadata and comment counts
  with no missing or incorrect entries.
- **SC-005**: A comment posted by a user appears in the photo's comment list immediately
  (within the same request-response cycle) with the correct author and timestamp.
- **SC-006**: All protected endpoints consistently reject unauthenticated requests —
  zero unauthorized data exposures.
- **SC-007**: Invalid uploads (wrong format, oversized) are rejected with a descriptive
  error message 100% of the time.

## Assumptions

- A single user feed shows all photos from all users (no per-user filtering required).
- No pagination is required for the initial version (all photos/comments returned in a
  single response).
- Users do not need to delete or edit photos or comments in this initial version.
- No email verification step is required after registration.
- Password reset / "forgot password" flow is out of scope for this version.
- Uploaded image files are stored as-is; no resizing or thumbnail generation is needed.
- Comment counts on the feed are derived at query time; no separate counter is maintained.
