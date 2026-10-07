# Passkey browser login

Date: 2026-10-07
Status: Proposed for user review

## Objective and approved direction

The user finds repeated terminal commands for browser login too manual. On
2026-10-07, the user approved preparing this design: enroll a passkey from an
authenticated session once, then sign in directly from the board using device
verification. Retain the existing CLI login as recovery. This approval does not
authorize merge, package publication, or changing the running service.

Success means a registered owner can open the board after session expiration or
service restart and sign in without a terminal command. Passkey enrollment must
survive restarts. Browser login remains separate from MCP authentication.

## Scope and architecture

Keep the local, single-owner board and existing eight-hour browser sessions.
Add WebAuthn registration and authentication using SimpleWebAuthn server and
browser libraries. Select a mutually compatible supported version pair during
implementation and pin them. Do not implement signature or attestation parsing
by hand. Serve browser dependencies locally under the existing CSP; no CDN.

Use `http://localhost:<configured-port>` as the canonical passkey browser origin
and `localhost` as RP ID. Preserve IPv4-loopback service binding and the existing
`127.0.0.1` MCP endpoint. Validate Host against only the configured localhost and
IPv4-loopback authorities; validate Origin against the exact browser origin for
each browser operation. Existing IP-address login continues as recovery, but
passkey controls direct the owner to localhost. No remote access or TLS setup is
included. Test localhost resolution on the supported host before claiming it
works; never expand the listener to public interfaces to solve resolution.

Add an additive SQLite migration for a stable random owner WebAuthn user ID and
credentials: credential ID, public key, signature counter, transports, creation
time, and backup/device metadata. Store no private key or biometric data. Use
the established single writer, prepared statements, and transactions. Include
these records in existing backup/restore validation; older backups remain valid
and may require enrollment again. Restoring credentials restores browser access
trust, which the recovery documentation must explain.

## Owner flows

1. First use: existing CLI login opens an authenticated localhost session. The
   board offers **Create passkey**. Enrollment requires the session and its CSRF
   token, followed by authenticator user verification. An unauthenticated visitor
   cannot enroll the first key or claim ownership.
2. Returning use: logged-out UI offers **Sign in with passkey**. The browser
   invokes WebAuthn on an explicit click. A verified response issues the existing
   HttpOnly, SameSite=Strict session cookie and CSRF token.
3. Cancellation, unavailable credentials, or unsupported browsers: show a concise
   actionable message and retain CLI recovery guidance. Never log the owner in
   on an error. Embedded Codex browser support is an acceptance check, not an
   assumption.
4. Recovery and management: CLI login can create another passkey. List enrolled
   credential creation dates and allow removal within an authenticated session
   with CSRF protection. Require fresh passkey verification or a fresh CLI-link
   login within five minutes for enrollment/removal. Explain CLI recovery before
   removing the final key; removal also invalidates existing browser sessions.

## Protocol and security

Add browser routes for registration options/verification, authentication
options/verification, and credential management. Registration and management
remain behind authentication. Authentication options and verification are
available without a board session but reveal no projects, cards, public keys,
or credential inventory. Use discoverable credentials and require user
verification for enrollment and sign-in.

Create cryptographically random, single-use challenges with five-minute expiry,
bound to purpose and exact origin. Bind registration to the authenticated owner
session; bind login to an opaque HttpOnly pre-authentication cookie. Consume
challenges on verification attempts, including failures. Limit pending
challenges and ceremony request rates; expire stale entries. Enforce request
size bounds and existing Origin checks before processing responses.

Verify challenge, origin, RP ID, signature, user verification, credential
ownership, and discoverable user handle. Persist the verified signature counter
according to the library's synced-passkey semantics; reject replay and revoked
credentials. Authentication and credential state updates must remain safe
against concurrent verification/removal. Require a fresh credential read before
issuing a session after asynchronous verification. Service restart clears
challenges and sessions but preserves enrolled credentials.

Retain the local operational credential and MCP authorization boundaries.
Passkeys protect browser access; they do not add human approval requirements to
MCP operations or change the board's existing completion policy.

## Validation and acceptance

- Existing lint, typecheck, unit, MCP, plugin, packaging, and browser checks pass.
- HTTP tests cover enrollment authorization/CSRF, challenge expiry/reuse,
  malformed responses, wrong origin/RP ID/user handle, missing verification,
  unrecognized/revoked credentials, concurrent removal, and request bounds.
- Browser tests use a virtual authenticator to enroll, end a session, sign in,
  restart the service, and sign in again with persistent credentials. Confirm
  failed ceremonies keep board data inaccessible and CLI recovery still works.
- Backup/restore tests cover new credential records and older backup recovery.
- Human acceptance on Chrome/macOS verifies actual Touch ID or device-PIN
  enrollment and sign-in. Separately test Codex's embedded browser; document a
  fallback if it lacks usable WebAuthn. Automated virtual-authenticator checks
  do not substitute for either result.
- Update README and logged-out guidance with the exact localhost destination,
  one-time setup, recovery, and browser support limitations.

## Sources

- Existing implementation: `src/security/session.ts`, `src/http/server.ts`,
  `src/storage/migrations.ts`, and `src/config.ts`.
- SimpleWebAuthn server documentation:
  https://simplewebauthn.dev/docs/packages/server
- Passkey configuration and verification:
  https://simplewebauthn.dev/docs/advanced/passkeys
- Context7 lookup: `/websites/simplewebauthn_dev`, 2026-10-07. Recheck versioned
  APIs before implementation.

## Next gate

User reviews this written design. After approval, prepare the implementation
plan and agree on execution. This document contains no claim that passkey login
has been implemented or tested.
