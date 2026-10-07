# Passkey Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let the local board owner sign in with a persistent passkey after one-time authenticated enrollment.

**Architecture:** Reuse SQLite storage, the single board writer, and browser session issuance. Add SimpleWebAuthn verification and bounded in-memory ceremony state; expose a small browser authentication API and locally served browser helper.

**Tech Stack:** Node.js 24.21.0 or newer Node.js 24 patch, TypeScript 6, node:sqlite, SimpleWebAuthn, vanilla browser JavaScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-07-passkey-login-design.md`

## Global Constraints

- Canonical passkey origin: `http://localhost:<configured-port>`; RP ID: `localhost`.
- Keep IPv4-loopback binding, `127.0.0.1` MCP access, and eight-hour browser sessions.
- Require user verification; five-minute, single-use, purpose/origin-bound challenges.
- Enrollment/removal requires session, CSRF, and fresh verification or CLI-link login within five minutes.
- Private keys and biometrics never enter application storage. No CDN, remote access, TLS setup, merge, publication, or live-service changes.
- Credentials survive restarts; pending challenges and sessions do not. Preserve old-backup restore and CLI recovery.

## Review Focus

- Two tabs verify/remove the same credential concurrently: no revoked credential may issue a session (Task 2).
- Synced credentials return a zero counter: use library semantics, not a blanket monotonic-counter rule (Task 2).
- A stale browser returns an invalidated enrollment response: no credential inserted (Task 2).
- An old backup has no credential tables: restore succeeds and offers enrollment again (Task 1).
- Localhost resolves to IPv6 first, or embedded WebAuthn is unavailable: actionable fallback, no public listener (Task 3).

## Execution preparation

- [ ] Read spec and inspect current PR/base state; preserve all uncommitted work. Create an isolated worktree/feature branch from the reviewed browser-login implementation, without rebuilding the running service checkout.
- [ ] Resolve SimpleWebAuthn through Context7, check current official versioned APIs, select compatible Node-24 server/browser versions and pin both. Inspect browser ESM artifact availability before choosing its local packaging path.

### Task 1: Persistent credentials and recoverable storage

**Files:** `src/storage/migrations.ts`, `src/storage/database.ts`, `src/storage/backup.ts`, `src/storage/validate-records.ts`; create `src/security/passkey-store.ts` and `tests/storage/passkeys.test.ts`; extend `tests/storage/backup.test.ts`.

**Interfaces:** Export `PasskeyRecord` with `id: string`, `publicKey: Uint8Array`, `counter: number`, `transports: string[]`, `createdAt: string`, `deviceType: string`, `backedUp: boolean`. Export `createPasskeyStore(store: Store)` returning `ownerId(): string`, `list(): PasskeyRecord[]`, `get(id: string): PasskeyRecord | undefined`, `insert(record: PasskeyRecord): void`, `updateCounter(id: string, expected: number, next: number): boolean`, and `remove(id: string): boolean`. All mutation methods are synchronous and transactional.

- [ ] Write failing tests named `credentialsPersistAfterReopen`, `migrationPreservesCards`, `oldBackupRestoresWithoutPasskeys`, and `malformedCredentialBackupLeavesDatabaseUnchanged`. Assert owner ID and public-key bytes survive reopen; existing card revisions stay unchanged; invalid credential ID/key/counter/metadata fails restore before replacing the database.
- [ ] Run `npm run build && node --test dist/tests/storage/*.test.js`; confirm failures concern missing credential functionality.
- [ ] Add schema version 2: singleton owner identity and credential table. Raise the application's supported-version ceiling to 2; accept backup schema versions 1 and 2, validate credential records only for version 2, and migrate version 1 when opened. Generate stable random owner identity once, not at every start. Use existing SQLite backup and permissions.
- [ ] Run the storage tests; expect all passing. Commit storage and migration changes.

### Task 2: Verified ceremonies and browser API

**Files:** create `src/security/passkeys.ts`, `tests/http/passkeys.test.ts`; modify `src/security/session.ts`, `src/http/server.ts`, root `package.json` and lockfile.

**Interfaces:** Extend session objects with `verifiedAt: number`; expose `issueSession(verifiedAt: number): {csrf: string; cookie: string}` and `invalidateAll(): void`. Existing link login calls this issuer. Export `createPasskeys(store: Store, origin: string)` with async `registrationOptions(sessionKey: string)`, `verifyRegistration(sessionKey: string, response: unknown): Promise<void>`, `authenticationOptions(preauthKey: string)`, and `verifyAuthentication(preauthKey: string, response: unknown): Promise<void>`. Options return library JSON types; verifier methods throw `HttpError` on failure. Session keys are opaque server-side identifiers, never CSRF tokens.

- [ ] Write failing HTTP tests for unauthenticated enrollment, CSRF failures, five-minute freshness/expiry, wrong purpose/origin/RP ID/user handle, missing user verification, malformed signatures, challenge replay, unknown credentials, and body size over 65536 bytes. Assert failures cannot read board data or create credentials/sessions.
- [ ] Add tests for concurrent duplicate verification, removal during asynchronous verification, stale enrollment after session invalidation, and synced zero counters. Use authentic signed virtual-authenticator responses for success paths rather than mocking verification success.
- [ ] Run `npm run build && node --test dist/tests/http/passkeys.test.js`; confirm missing routes fail.
- [ ] Add `/api/passkeys/register/options`, `/api/passkeys/register/verify`, `/api/passkeys/authenticate/options`, `/api/passkeys/authenticate/verify` POST routes and authenticated `/api/passkeys` GET, `/api/passkeys/:id` DELETE routes. Public authentication routes bypass board-session lookup only after exact Origin validation. Authentication options sets a random HttpOnly, SameSite=Strict pre-auth cookie scoped to passkey routes. Never disclose credential inventory publicly.
- [ ] Implement pending-ceremony map: maximum 100 entries, five-minute expiry, one pending ceremony per opaque binding/purpose. Apply 20 ceremony requests per minute per session/pre-auth binding plus 200 per minute globally; bound limiter storage and reject excess with 429. Consume a challenge before invoking async verification. Bind registration to a still-valid, recently verified owner session. Recheck session and credential existence/counter after verification, then synchronously persist and issue the session with no intervening await. On concurrent counter changes, reject and require a fresh ceremony.
- [ ] Use library validation for signatures and authenticator counters; enforce discoverable user handle and user verification. Removal requires fresh verification and invalidates all sessions. Enrollment after old-session login uses a fresh authentication ceremony or CLI recovery.
- [ ] Accept Host only for configured localhost/127.0.0.1 authorities; derive allowed Origin from validated Host, not arbitrary request input. Passkey ceremonies accept canonical localhost Origin only. CLI-generated browser links use localhost; existing IP sessions and MCP requests retain their intended access paths. Port 0 tests use actual allocated port.
- [ ] Run `npm run check && npm run check:mcp`; expect all passing. Commit protocol and session changes.

### Task 3: Browser enrollment, login, recovery, and package acceptance

**Files:** `public/index.html`, `public/app.js`, `public/api.js`, `public/styles.css`, `src/http/server.ts`, `src/cli.ts`, `README.md`, `docs/mcp-setup.md`, `scripts/verify-npm-package.mjs`; create `public/passkeys.js` and `tests/browser/passkeys.spec.ts`. Update packaging scripts only if required to copy the pinned local browser helper.

**Interfaces:** `public/passkeys.js` exports `registerPasskey(): Promise<void>` and `signInWithPasskey(): Promise<void>` using the Task 2 endpoints and locally served SimpleWebAuthn browser helper. Session issuance returns `{csrf}` through existing browser API session handling. Keep ceremony logic out of card editing handlers.

- [ ] Write failing Playwright tests with Chromium CDP WebAuthn virtual authenticator: enroll from fresh CLI session, clear browser cookies, sign in, restart server on the same port/data directory, and sign in again. Assert cards remain inaccessible before verified login; verify enrollment survived restart.
- [ ] Add cancellation/unsupported-WebAuthn tests, final-key removal/recovery tests, expired-freshness tests, IP-address guidance tests, and unknown Host/Origin tests. Validate localhost access with IPv4-only service binding on the test host; fallback guidance must not alter listener exposure.
- [ ] Run `npm run test:browser`; confirm the missing passkey controls fail.
- [ ] Add accessible **Create passkey** and **Sign in with passkey** buttons, credential creation-date list/removal controls, busy/error states, and final-key recovery explanation. Detect unsupported WebAuthn and retain CLI guidance. Trigger authenticator prompts only on user actions; offer localhost navigation on IP-origin visits. Serve the pinned helper locally and include it in npm/plugin packaging where needed.
- [ ] Update README with exact localhost destination, one-time CLI enrollment, returning login, removal, backup trust implications, CLI recovery, and unverified embedded-browser status. Do not claim Touch ID acceptance from virtual tests.
- [ ] Run `npm run check`, `npm run check:mcp`, `npm run test:plugins`, `npm run test:browser`, `npm run test:package`, and root/adapter dependency audits. Verify packed artifact can perform passkey ceremonies without source checkout or CDN.
- [ ] Request a whole-branch security/code review covering origin trust, first enrollment, async races, revocation, and recovery. Fix findings and rerun affected checks.
- [ ] Commit verified UI/documentation/package changes. Present a reviewable PR; obtain separate authorization for merge, release, or installing into the active board service.
- [ ] Human acceptance: owner enrolls and signs in with real Chrome/macOS Touch ID or device PIN, then separately tries the Codex embedded browser. Record actual results and fallback limitations; never automate biometric confirmation or claim those checks ran when unavailable.

## Plan self-review

Spec sections map to Tasks 1–3. Storage version ceilings, old backups, packaged browser assets, session freshness, counter semantics, revocation races, and human acceptance are explicit. No production credentials or running board data are needed for automated checks.

## Execution choice

Recommend native execution in this chat with a final independent review: the three tasks share storage/session interfaces, so sequential implementation avoids parallel integration overhead. Subagent-driven execution is available if the user prefers per-task independent review. Await plan review and execution-method selection before product changes.
