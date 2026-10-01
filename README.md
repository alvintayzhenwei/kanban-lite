# Kanban Lite

[![CI](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml/badge.svg?branch=feature%2Fkanban-foundation)](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml)

A lightweight localhost Kanban board for development across multiple repositories.

**Lite. Shared work for Claude Code and Codex. Built to coordinate Agent Skills, Superpowers, and OpenSpec.**

## Current scope

Release 1 provides a browser board with projects, priorities, owners, blockers, WIP warnings, artifact links, verification evidence, activity history, safe concurrent edits, and backups.

Claude Code/Codex plugin packages and MCP tools arrive in Release 2. OpenSpec import and workflow integration arrive in Release 3. These integrations are designed, not yet implemented or verified. The complete product requires all three releases.

![Kanban Lite board with illustrative sample data](docs/assets/board-desktop.png)

## Start locally

Use Node.js **24.21.0 or a newer Node 24 patch**. Development and CI pin 24.21.0. No Docker, external database, cloud account, or model API is required.

```sh
git clone https://github.com/alvintayzhenwei/kanban-lite.git
cd kanban-lite
npm ci
npm run build
npm start -- --open
```

The service binds to `127.0.0.1:4317`. `--open` opens your default browser with a one-time session link, then removes the credential from the address bar. The terminal prints a plain URL without credentials. Browser sessions last eight hours; restart with `--open` to create another authenticated session. Tabs in the same browser share the session. Stop the service with Ctrl+C.

To use another port or data directory:

```sh
npm start -- --open --port 4320 --data-dir /path/to/kanban-data
```

Register repository roots with **Add project**, then create cards. Select one project or view all projects. Repository registration supports Git worktrees and paths containing spaces.

## Track development without replacing it

- Move cards between Backlog, Ready, In Progress, Review, and Done. Keyboard-accessible move controls accompany drag and drop.
- Track SDLC phase separately: Discovery, Design, Planning, Implementation, Review, or Verification.
- Attach repository-relative spec, plan, or review paths. Artifact links are metadata in this release; the app does not read or rewrite those files.
- Record verification evidence before moving to Done. Material edits invalidate previous evidence; a later failed result supersedes earlier success. Changed or failed completed work returns to Review.
- Use an explicit completion override with a reason for manually accepted work. Browser-session access is not proof of human identity.
- Keep Agent Skills and Superpowers approval rules in their respective workflows. Card movements and artifact existence do not establish design approval, merge approval, deployment, or release acceptance.

Both tabs editing the same item receive revision conflicts instead of silently overwriting changes. Reload the card, then reapply edits you still need. Changes made elsewhere appear when you click **Refresh**; there is no idle polling or repository scan.

## Storage and recovery

Default state lives in `~/.kanban-lite/`, outside repositories and plugin caches. The directory contains `board.sqlite`, a private local credential, and an active service lock. Do not commit or share the credential or session links.

Create a backup while the service runs or while it is stopped:

```sh
node dist/src/cli.js backup --output /path/to/new-backup.sqlite
```

Existing output files are refused. Backups include cards, evidence, registered paths, and history; protect them as project data. Use the same `--data-dir` argument if you started with a custom directory.

Stop the service before restoring:

```sh
node dist/src/cli.js restore --input /path/to/backup.sqlite
```

Restore validates schema and database integrity, preserves existing state in a `pre-restore-*.sqlite` backup, and replaces the database atomically. Do not copy the live database manually. Port conflicts and active writer locks produce diagnostics instead of starting another writer. If an interrupted startup leaves `service.acquire`, ensure no Kanban startup or recovery process is running before removing that guard directory; automatic guard reclamation is deliberately avoided.

## Lightweight by design

The running application has **zero third-party runtime dependencies**. SQLite and HTTP use Node's built-in APIs; the browser uses native modules and controls. Development dependencies provide compilation, linting, formatting, and browser tests and are not needed to run the built application. Node 24 SQLite API maturity may vary by patch; this project verifies the pinned patch.

Observed startup, memory, and package measurements are recorded in [Release 1 acceptance](docs/release-1-acceptance.md). These measurements characterize one machine, not universal performance guarantees.

## Checks and dependency updates

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run format:check
```

CI runs lint, type checks, tests/build, dependency audit, and Chromium acceptance on pull requests, main pushes, and feature-branch pushes. Actions are pinned to immutable commits. The README badge reflects the foundation feature-branch workflow until the draft PR is merged; it does not claim unimplemented compatibility. On this private repository, badge/run access follows GitHub permissions.

Dependabot checks npm and GitHub Actions weekly, Monday at 09:00 Asia/Singapore. Compatible development updates are grouped; major updates remain separate. There is no automatic merge. Vulnerability alerts and automated security updates are separate repository settings and were verified enabled during setup.

## Delivery roadmap

1. **Local foundation:** persistent multi-repository board, verification, recovery, CI, Dependabot, and live badges.
2. **Claude Code and Codex:** one shared MCP adapter and skills source, separate validated plugin packages, actual host acceptance.
3. **Workflow integration:** read-only OpenSpec import/reconciliation and project workflow modes for Agent Skills, Superpowers, or both. Preserve source authority and approval gates.

See the [design](docs/superpowers/specs/2026-10-01-kanban-lite-design.md) and [Release 1 plan](docs/superpowers/plans/2026-10-01-release-1.md).
