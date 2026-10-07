# Changelog

## Unreleased

### Added

- Guided browser onboarding with Copy setup prompt, verified service reuse, deferred enrollment, and credential-storage guidance.

- Browser logout revokes the current session while preserving enrolled keys and other browsers.
- README guides for logout/relogin, macOS auto-start, and project-chat confirmation prompts.

- Persistent local browser passkeys with authenticated enrollment, device verification, key removal, and CLI recovery.
- Canonical localhost browser login, with the existing IPv4-loopback MCP endpoint retained.

### Changed

- Database schema 2 stores public passkey credentials. Older backups remain restorable; restoring credentials also restores their access trust. Older binaries require a pre-upgrade backup for rollback.
- Passkey functionality adds pinned SimpleWebAuthn runtime dependencies served locally.

## 0.2.0

### Added

- Open a fresh authenticated browser session with `kanban-lite open` while the board stays running. Existing browser sessions remain active.
- Choose Chrome or another application on macOS with `--browser APP`.
- Find browser login, shared data directory, and upgrade instructions in the README and MCP setup guide.

### Fixed

- Show a clear browser login screen instead of a misleading empty board when a session is missing or expires.
- Expire unused login links after five minutes and reject reused links. Authenticated sessions continue to last eight hours.
- Improve login guidance and footer readability.

### Upgrade

Restart an older board service once after upgrading. Then use `kanban-lite open --data-dir /path/to/kanban-data` whenever another browser needs to log in. Browser login and MCP access remain separate; use the same data directory for both. No database migration is required.
