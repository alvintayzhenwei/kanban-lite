# Kanban Lite

[![CI](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/ci.yml)

[![Security checks](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/alvintayzhenwei/kanban-lite/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/alvintayzhenwei/kanban-lite/blob/main/LICENSE)

A local Kanban board for developers and coding agents working across multiple repositories. Keep cards, blockers, artifact links, and verification evidence in one place, with a browser interface and optional Claude Code/Codex tools.

Runs on your machine with SQLite storage and **zero third-party runtime dependencies**. No Docker, external database, cloud account, or model API is required.

## What you can do

- Organize multiple repositories into projects with priorities, owners, blockers, and WIP warnings.
- Track cards through Backlog, Ready, In Progress, Review, and Done, with a separate development phase.
- Attach plans, reviews, and test evidence. Material edits invalidate old evidence; failed completed work returns to Review.
- Work across browser tabs with revision conflicts, activity history, and SQLite backups.
- Connect optional MCP tools and generated plugins for Claude Code and Codex. OpenSpec import remains planned.

![Kanban Lite board with illustrative sample data](https://raw.githubusercontent.com/alvintayzhenwei/kanban-lite/main/docs/assets/board-desktop.png)

## Copy-paste setup with Codex or Claude

Use the [setup prompts](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/setup-prompts.md) to install, start, and verify the local board with either assistant. The guide also covers manual tracking alongside Agent Skills, Superpowers, and OpenSpec.

## Run with npm / npx

The prepared package name is `@alvintayzhenwei/kanban-lite`; the unscoped `kanban-lite` package is a different project. These commands require the first public npm release. Until then, use the source setup below.

Use Node.js **24.21.0 or a newer Node 24 patch** (Node 25+ is not supported).

```sh
npx --yes @alvintayzhenwei/kanban-lite start --open
```

`npx` runs the package without installing a permanent command on your PATH. For a permanent installation:

```sh
npm install --global @alvintayzhenwei/kanban-lite
kanban-lite start --open
```

For reproducible runs, append an explicit published version to the package name. See the [publishing guide](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/publishing.md) for the GitHub tag → checks → trusted npm publishing workflow and first-release setup.

## Start locally

Use Node.js **24.21.0 or a newer Node 24 patch**. Development and CI pin 24.21.0.

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

## Agent tools and plugins

Use the [MCP setup guide](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/mcp-setup.md) to build the optional adapter and install either host package. Ten tools inspect projects/cards and record authorized card changes, blockers, artifacts, and actual verification evidence. Both adapters connect to the same explicit board service. The shared workflow skill preserves repository and installed workflow approval gates.

Codex tool discovery and a read-only operation have been verified locally. Installed Claude Code acceptance remains pending; see [Release 2 acceptance](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/release-2-acceptance.md) for evidence and limits.

For an existing service, rebuild and restart it before using the new agent endpoint. Plugin loading does not start the service. Use the same data directory for the browser and adapters.

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

After npm publication, create a backup while the service runs or while it is stopped. For source installs, replace the `npx` package invocation with `node dist/src/cli.js`:

```sh
npx --yes @alvintayzhenwei/kanban-lite backup --output /path/to/new-backup.sqlite
```

Existing output files are refused. Backups include cards, evidence, registered paths, and history; protect them as project data. Use the same `--data-dir` argument if you started with a custom directory.

Stop the service before restoring:

```sh
npx --yes @alvintayzhenwei/kanban-lite restore --input /path/to/backup.sqlite
```

Restore validates schema and database integrity, preserves existing state in a `pre-restore-*.sqlite` backup, and replaces the database atomically. Do not copy the live database manually. Port conflicts and active writer locks produce diagnostics instead of starting another writer. If an interrupted startup leaves `service.acquire`, ensure no Kanban startup or recovery process is running before removing that guard directory; automatic guard reclamation is deliberately avoided.

## Lightweight by design

The running application has **zero third-party runtime dependencies**. SQLite and HTTP use Node's built-in APIs; the browser uses native modules and controls. The optional MCP adapter has separate locked SDK/schema dependencies; they are not required for the browser board. Development dependencies provide compilation, linting, formatting, and browser tests and are not needed to run the built application. Node 24 SQLite API maturity may vary by patch; this project verifies the pinned patch.

Observed startup, memory, and package measurements are recorded in [Release 1 acceptance](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/release-1-acceptance.md). These measurements characterize one machine, not universal performance guarantees.

## Checks and dependency updates

```sh
npm run check
npx playwright install chromium
npm run test:browser
npm run format:check
```

CI runs lint, type checks, application tests, MCP contracts, plugin installation checks, package installation/startup checks, and Chromium acceptance. Actions are pinned to immutable commits. The separate Security workflow audits main and adapter dependencies for known vulnerabilities on pull requests, main pushes, and weekly runs; high or critical findings fail the check.

The Security badge reflects the latest main-branch workflow result. It is not a security certification or a guarantee that the application has no vulnerabilities. See [SECURITY.md](https://github.com/alvintayzhenwei/kanban-lite/blob/main/SECURITY.md) for the local trust boundary and private reporting route.

Dependabot checks npm and GitHub Actions weekly, Monday at 09:00 Asia/Singapore. There is no automatic merge. Repository security alerts and private reporting require separate GitHub settings.

## License and disclaimer

Kanban Lite is licensed under the [MIT License](https://github.com/alvintayzhenwei/kanban-lite/blob/main/LICENSE). You may use, modify, and redistribute it, including commercially, while retaining the copyright and license notice. The software is provided **as is, without warranty**; the full license includes the warranty and liability disclaimer. Keep backups and verify changes before relying on the board for project records.

## Delivery roadmap

1. **Local foundation:** persistent multi-repository board, verification, recovery, CI, Dependabot, and live badges.
2. **Claude Code and Codex:** one shared MCP adapter and skills source, separate validated plugin packages, actual host acceptance.
3. **Workflow integration:** read-only OpenSpec import/reconciliation and project workflow modes for Agent Skills, Superpowers, or both. Preserve source authority and approval gates.

See the [design](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/superpowers/specs/2026-10-01-kanban-lite-design.md) and [Release 1 plan](https://github.com/alvintayzhenwei/kanban-lite/blob/main/docs/superpowers/plans/2026-10-01-release-1.md).
