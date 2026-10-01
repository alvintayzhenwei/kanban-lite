# Release 1 acceptance

Recorded on 2026-10-01. This evidence applies to the local foundation, not completed Claude Code/Codex or OpenSpec plugin integration.

## Behavior verified

- 28 Node tests cover persistence, transactional migrations, repository isolation and path containment, revisions, atomic activity history, verification rules, authenticated HTTP, one-writer startup, restart, live backup, and stopped-service restore.
- Four Chromium scenarios cover multi-project filtering, keyboard movement, owners/blockers/phase, WIP warnings, evidence and completion overrides, two-tab conflicts, stored HTML treated as text, and narrow-screen controls.
- Lint, type checks, and compilation pass locally. A separate pre-review clean checkout passed npm ci, 25 Node tests, and four Chromium scenarios. The corrected implementation passes 28 Node tests and four Chromium scenarios locally and on GitHub.
- Desktop and narrow-screen screenshots were inspected for layout and usable controls. Preview data is illustrative, not a record of completed integrations.

![Desktop board with illustrative sample data](assets/board-desktop.png)

[Narrow-screen preview](assets/board-mobile.png)

## Lightweight measurements

Measured with `npm run measure`: five fresh subprocesses, each with a new temporary data directory. Startup includes spawning Node and receiving a successful health response. Idle RSS is sampled 500 ms after startup and includes Node itself. Package measurements use `npm pack --dry-run`; they exclude the Node runtime and development dependencies.

Context reported by the acceptance environment: Node 24.21.0; darwin arm64; OS release 27.0.0; CPU identifier Apple M6.

| Metric                           | Observed value                   |
| -------------------------------- | -------------------------------- |
| Startup samples                  | 46.6, 92.8, 37.3, 44.1, 66.3 ms  |
| Median startup                   | 46.6 ms                          |
| Idle RSS samples                 | 62.4, 62.5, 62.5, 62.5, 62.5 MiB |
| Median idle RSS                  | 62.5 MiB                         |
| Compressed package               | 23,132 bytes                     |
| Unpacked package                 | 84,752 bytes                     |
| Third-party runtime dependencies | 0                                |

These are observations on one acceptance environment, not performance guarantees or browser-memory measurements. The board requires no Docker, hosted service, external database, or model API. It performs no idle polling or repository scanning.

## GitHub setup

GitHub Actions is enabled. Vulnerability alerts and automated security updates were verified enabled; security updates are not paused. Dependabot version updates are configured weekly for npm and GitHub Actions, with compatible development updates grouped and no auto-merge. The repository was initially empty with main configured. GitHub made feature/kanban-foundation the default when the approved feature branch was published first. Design-only main initialization remains pending user approval.

CI configuration covers lint, types, Node tests/build, dependency audit, and Chromium acceptance with immutable Action references. Initial feature CI passed on commit 9298cf8: https://github.com/alvintayzhenwei/kanban-lite/actions/runs/36884588054. Corrected implementation CI passed on commit 1335293: https://github.com/alvintayzhenwei/kanban-lite/actions/runs/36885076415. Both jobs passed, including fresh npm ci, 28 Node tests, dependency audit, and four Chromium scenarios. The README badge follows the actual default branch; no main-branch result is claimed.

## Local handoff

The app is running at http://127.0.0.1:4317 and was verified in the user's Chrome session. Current handoff data lives at `/Users/zhenweitay/skills/kanban-lite-runtime/`; this directory is outside the source repository. The board contains foundation review and remaining integration release cards. Start it again with `node dist/src/cli.js start --open --data-dir /Users/zhenweitay/skills/kanban-lite-runtime` from the source checkout.

## Remaining product acceptance

Release 2 must validate packages, MCP contracts, and actual tool discovery/shared state in both Claude Code and Codex. Release 3 must validate OpenSpec reconciliation and representative Agent Skills/Superpowers workflows. Source progress, workflow approval, verification, and release acceptance remain distinct.
