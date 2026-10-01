# Kanban Lite design

Date: 2026-10-01
Status: Approved design. Release 1 implementation is verified; its draft PR awaits base-branch approval. Releases 2 and 3 remain planned.
Repository: https://github.com/alvintayzhenwei/kanban-lite

## Purpose and agreed scope

Create a lightweight localhost Kanban application and plugin for Claude Code and Codex. One board manages multiple explicitly registered local repositories, with project filters. Both agents and the browser share the same project state. The application supports the user's OpenSpec, Superpowers, and Agent Skills SDLC workflows without replacing their specifications or approval rules.

The user requested GitHub CI, Dependabot, and dynamic status badges in the README. The repository was empty when inspected. Multi-repository support is confirmed; the technical choices below are proposed defaults.

## Three product acceptance criteria

1. **Lite:** One local service, SQLite, and a framework-free browser interface. No Docker, external database, hosted service, or model API is required to use the board. Use built-in runtime capabilities where practical; justify each runtime dependency. Record cold startup time, idle resident memory, installed package size, and runtime dependency count on the acceptance machine. Report the measurements and machine/runtime context; these are characterization results, not invented performance guarantees. Keep idle operation event-driven, without background repository scanning or agent polling.
2. **Claude Code and Codex:** Both hosts use the same engine, tool contracts, skills, and persistent board. Deliver separate validated installation packages without maintaining separate business logic. Release 2 must demonstrate actual tool discovery and shared-card read/update behavior in both hosts before claiming dual-host support. The foundation release alone does not satisfy this product criterion.
3. **Agent Skills, Superpowers, and OpenSpec:** The plugin coordinates work and records artifacts; the installed workflow plugins govern how development is performed, and OpenSpec governs specification/task content. Support selecting Agent Skills, Superpowers, or both for each project without assuming their approvals or phases are identical. Follow repository instructions when workflows conflict; surface unresolved conflicts rather than inventing precedence. Release 3 must verify OpenSpec import/reconciliation and a representative workflow in each plugin mode, preserving approval gates and source files. Do not bundle or fork those plugins, overwrite their skills, or require all three tools merely to use the board.

The complete product is accepted only when all three criteria pass. Phased releases remain useful milestones, not a claim that integration is complete.

## Architecture

Use a TypeScript/Node.js application with a small browser interface, a local HTTP service, a SQLite store, and a stdio MCP adapter. Select and pin supported runtime and library versions during implementation planning after consulting their official or Context7 documentation. Avoid a frontend framework unless the interface requires one.

The local service is the sole database writer. Browser requests and MCP requests use the same domain operations. Each host can start its own stdio adapter; adapters connect to one service using a configured endpoint and local credential. Service startup belongs to an explicit application start command, not implicit plugin loading. A health check identifies service version and protocol compatibility; incompatible adapters fail with a clear error.

The service binds to 127.0.0.1. The browser uses same-origin requests, authenticated local sessions, Origin checks, and CSRF protection for mutations. MCP adapters use a local credential kept outside repositories and plugin packages. Repository registration is explicit; paths are canonicalized and file reads are confined to registered roots. The plugin does not execute arbitrary commands or expose unrestricted filesystem access.

One source tree produces separate Claude Code and Codex plugin packages. Shared skills and server code have one source of truth. Host-specific manifests and MCP root substitutions are generated and validated separately. Document support for local Claude Code and Codex; web/mobile access and hosted Claude applications are outside scope.

## State and concurrency

SQLite stores projects, cards, artifact references, evidence, and an append-only event history in a user data directory outside plugin installation caches. Provide explicit backup/export and transactional migrations. OpenSpec files remain authoritative for specification and task content; the database owns Kanban position, ownership, priorities, and history.

Projects contain stable IDs, display names, canonical repository roots, and optional remote URLs. Cards contain stable IDs, project IDs, title, description, column, priority, blockers, owner, revision, and timestamps. Artifact references record repository-relative paths and source identifiers. Evidence records include check name, outcome, timestamp, source revision when available, and a bounded summary or reference.

Every mutation supplies the expected revision. Conflicts return current state and require reconciliation rather than overwriting. Ownership is explicit and informative; it does not claim to prevent agents from editing repository files. Events record whether an operation came from the browser, Claude, or Codex using client-supplied attribution, not authenticated human identity.

## Board behavior

Columns are Backlog, Ready, In Progress, Review, and Done. Blocked is a flag with a reason, not a separate workflow stage. Support project filters, priority, card editing, ownership, and configurable WIP limits. WIP limits warn by default; they do not silently discard changes. Provide keyboard-accessible movement controls alongside drag and drop.

Kanban column and SDLC phase are separate fields. A card can be In Progress while its phase is Design or Verification. The UI displays blockers, artifact links, and verification state. Cards cannot enter Done without recorded passing verification evidence, or an explicit human override with a reason recorded in history. MCP clients cannot submit human overrides. Passing evidence is an agent assertion with traceable context, not a guarantee of production readiness.

## Shared agent workflow

Provide shared skills for inspecting work, selecting a ready card, recording ownership and blockers, attaching artifacts, recording verification, and handing work back for review. Respect the active repository's instructions and installed workflow skills. Do not duplicate or bypass Superpowers approvals, auto-approve designs, merge pull requests, deploy, or claim release acceptance from card movement.

MCP operations cover project listing/registration, board inspection, card creation/update/movement, ownership, artifact links, evidence recording, and explicit synchronization. Return structured results with revision and conflict information. Host adapters provide the same tool contracts. Starting a work session does not modify project files automatically.

## OpenSpec and SDLC integration

OpenSpec integration starts with an explicit, read-only import. Detect supported project layouts and record the adapter/layout version. Unsupported layouts produce a diagnostic rather than guessed parsing. A change becomes a parent card; tasks become checklist items with stable mappings based on source IDs when available. Where tasks lack IDs, persist mappings and flag ambiguous edits instead of relying only on line numbers or silently duplicating cards.

Repeated import is idempotent. Source changes produce a reconciliation preview for title/task changes and removed items. Import never rewrites OpenSpec files, auto-archives changes, or automatically marks a card Done. Checked tasks are source progress; board completion also requires verification evidence.

Attach Superpowers specs and plans, Agent Skills artifacts, test evidence, and pull request URLs through references. Initial integration uses explicit links and conventional path discovery. Do not infer approval from artifact existence. Automated write-back and workflow hooks require a later design.

## Delivery phases

### Release 1: Local board foundation

Deliver multi-repository registration, project filters, card CRUD and movement, persistence, revision conflicts, blockers, ownership, WIP warnings, keyboard controls, history, backup/export, local service protection, and verification-aware completion. Include GitHub CI, Dependabot configuration, and an accurate README.

Acceptance: register two temporary repositories, manage cards independently, restart without data loss, reject stale writes, reject out-of-root reads and unauthenticated mutations, export a recoverable backup, and exercise board controls in a real browser. Tests cover these behaviors without requiring paid model calls.

### Release 2: Claude Code and Codex plugin

Deliver shared MCP adapter and skills, host-specific packages, installation/removal instructions, startup diagnostics, and compatibility tests.

Acceptance: validate both packages, complete an MCP handshake, inspect and update the same card through both adapters, reject stale concurrent changes, and verify actual tool discovery and a harmless operation in each installed host when available. If a host is unavailable, report that acceptance as pending rather than equating adapter tests with host acceptance.

### Release 3: OpenSpec and workflow integration

Deliver supported-layout OpenSpec import, reconciliation previews, task mappings, artifact discovery, SDLC phase display, and verification references.

Acceptance: import fixture projects repeatedly without duplicates; reconcile renames/removals and ambiguous task edits; leave source files byte-for-byte unchanged; distinguish task completion, design approval, verification, and release acceptance.

Each release receives its own implementation plan and verification evidence. Build Release 1 first; later releases remain separately reviewable.

## GitHub automation and documentation

CI runs on pull requests and default-branch pushes with minimal permissions. Required jobs cover lint, type checks, domain tests, build, and meaningful browser smoke tests. Add package validation and adapter contract tests when Release 2 exists. Pin third-party Actions to immutable commits and use lockfile-based dependency installation. Avoid paid model calls and unnecessary secrets in CI.

Configure Dependabot for the selected package ecosystem and github-actions on a weekly schedule. Group compatible development updates, retain breaking updates for separate review, and do not auto-merge by default. Verify vulnerability alerts and security-update repository settings separately; a dependabot.yml file does not establish those settings.

Place live workflow badges directly below the README heading. Link each badge to its workflow run page and use the actual default branch. Introduce a compatibility badge only when that workflow exists. Add coverage only after publishing a coverage result; do not use static passing/security claims or a fabricated Dependabot health badge. GitHub repository titles remain plain text.

README includes purpose, supported hosts, prerequisites, local startup, plugin installation, storage/backup location, workflow examples, release scope, and any unverified host acceptance.

## Non-goals and risks

No cloud hosting, authentication accounts, real-time team collaboration over a network, sprint analytics, billing, autonomous code execution, automatic merges, or two-way specification editing in the first three releases.

Primary risks are plugin host differences, OpenSpec layout drift, concurrent edits, and confusing evidence with approval. Separate adapters, versioned parsers, revision checks, and explicit approval/evidence distinctions address these risks. Browser and host validation remain necessary before claiming the plugin works end to end.

## Review checklist

- One shared local service and store for browser, Claude Code, and Codex.
- Separate Kanban position, SDLC phase, source progress, and approval evidence.
- Explicit repository registration and read-only OpenSpec synchronization.
- Independently usable releases with CI and dynamic badges from the foundation release.
- Actual host acceptance recorded separately from automated adapter checks.

Next step after this written specification is approved: prepare the Release 1 implementation plan and present its execution method for review.
