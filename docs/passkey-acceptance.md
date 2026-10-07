# Passkey acceptance evidence

Date: 2026-10-07
Branch: `feat/passkey-login`

Implemented local owner enrollment, browser authentication, key removal, fresh
verification, bounded single-use ceremonies, and schema-2 public credential
storage. MCP authorization remains separate.

## Automated evidence

- Lint, TypeScript, and 43 unit/HTTP/storage tests passed.
- Nine Chromium browser tests passed, including enrollment, sign-in after
  session loss and service restart, removal, signed-response rejection, replay,
  and unsupported-browser recovery.
- Eight MCP contracts and two plugin packaging tests passed.
- Installed npm tarball enrolled a virtual-authenticator passkey and signed in;
  local browser helper assets loaded from the installed package.
- Root and MCP dependency audits reported zero vulnerabilities.
- Independent review identified key/transport validation defects, then confirmed
  both fixes. Genuine signed zero-counter, replay, and concurrent-removal checks
  are retained in `tests/http/passkey-signatures.test.ts`.

Tests use isolated temporary databases and virtual credentials. They do not
exercise the live board's owner passkey. SimpleWebAuthn on Node 24 emits
experimental Web Crypto algorithm probe warnings; the application offers ES256.

## Pending human acceptance

- Actual Chrome/macOS enrollment and login using Touch ID or a device PIN.
- Codex embedded-browser WebAuthn support and fallback usability.
- Owner acceptance of the changed browser flow and restored-credential trust.

No live service upgrade, schema migration of the live board, package publication,
or release is claimed. The new application can restore schema-1 backups; old
binaries need a pre-upgrade backup to roll back from schema 2.
