# Release 2 MCP and host packages implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let local Codex and Claude Code inspect and update the same Kanban board through real MCP tools, with shared workflow instructions and separately validated plugin packages.

**Architecture:** The existing HTTP service remains the sole SQLite writer. An optional stdio adapter uses a bearer-authenticated agent endpoint with the same domain operations as the browser. One adapter and skill source generate separate host packages; loading a plugin never starts the board service implicitly.

**Tech stack:** Node 24.21.0 or a newer Node 24 patch, TypeScript, built-in HTTP/SQLite; optional adapter package with the official MCP TypeScript SDK v1.29.0 and its supported Zod dependency, exact versions locked after registry verification. The browser application retains zero third-party runtime dependencies.

**Spec:** ../specs/2026-10-01-kanban-lite-design.md, especially Architecture, State and concurrency, Shared agent workflow, and Release 2. This plan does not implement Release 3 OpenSpec synchronization.

## Global constraints

- One service owns the database. Adapters never open SQLite or acquire its writer lock.
- Local service binds to 127.0.0.1; credentials live outside checkouts and plugin packages.
- Every mutation supplies expectedRevision; creation uses 0. Conflicts include current state and are never retried by overwriting automatically.
- MCP cannot submit a human completion override. Agent identity is client attribution, not proof of human identity.
- No arbitrary command execution, artifact file reads, cloud dependency, model API calls, automatic repository scanning, or idle polling.
- Service startup is explicit; missing/incompatible services return actionable diagnostics.
- Plugin setup must preserve existing host configuration. No account upload, public publication, merge, or deployment in this release.
- Installed workflow skills and repository instructions retain their approval gates. Card creation does not authorize implementation.

## Review focus

1. A forged browser request must not reach the agent bearer endpoint, even with a valid session cookie.
2. Non-loopback or redirected URLs must never receive the local credential.
3. Two host adapters must observe one board and receive revision conflicts on stale writes.
4. Missing runtime, credentials, service, or incompatible protocol must yield readable errors without leaked secrets.
5. Generated host packages must work from paths containing spaces and omit credentials, state databases, and unintended files.

## Task 1: Authenticated agent operations

**Files:** modify src/http/routes.ts and src/http/server.ts; create src/security/agent.ts; modify tests/http/server.test.ts; add tests/http/agent.test.ts.

**Interfaces:** Generalize route(store, method, url, body, actor) with an explicit Actor; browser calls use {client:"browser",humanSession:true}. POST /agent/operation accepts {client:"claude"|"codex",operation:string,arguments:object}; authentication uses the existing local credential. Dispatch only an explicit allowlist into domain operations, with {humanSession:false}; never accept an arbitrary URL, HTTP method, actor object, or humanSession value. Responses use existing errorResponse status/body, including conflict current state. GET /health retains protocolVersion 1 and adds agentProtocolVersion 1.

- [ ] Write failing endpoint tests: missing/wrong bearer rejected; any Origin header rejected; browser cookie alone rejected; malformed/oversized payload rejected; unknown fields/operations rejected; agent human override rejected; browser behavior unchanged.
- [ ] Run focused HTTP tests and confirm missing functionality failures.
- [ ] Implement constant-time credential validation using byte lengths and an explicit operation dispatcher. Keep Host checks and request limits. Expose list_projects, register_project, list_cards, get_card, create_card, update_card, move_card, record_evidence, list_events, and update_project. Reuse domain validation; do not expose delete, restore, backup, file reading, or synchronization tools.
- [ ] Run HTTP/domain tests; demonstrate attribution and current passing evidence required for agent Done.
- [ ] Commit the independently testable agent endpoint.

## Task 2: Optional stdio MCP adapter

**Files:** create adapters/mcp/package.json, package-lock.json, tsconfig.json, src/client.ts, src/tools.ts, src/stdio.ts, tests/contract.test.ts, tests/stdio.test.ts; modify root package.json scripts and CI to install/check this optional package.

**Interfaces:** BoardClient(dataDir, client) reads service.lock/owner.json and credential from the configured data directory. Validate owner PID is alive and URL is strictly http://127.0.0.1 with a valid port, no credentials/query/fragment/path beyond slash; redirects are rejected. Health check must confirm name kanban-lite and agentProtocolVersion 1 before forwarding credentials. Requests use finite timeouts and the 64 KiB service limit. CLI: node adapters/mcp/dist/stdio.js --client codex|claude [--data-dir PATH]. Environment KANBAN_DATA_DIR is the fallback, then ~/.kanban-lite. Node runtime floor matches the application.

Tool names are prefixed kanban_: list_projects, register_project, list_cards, get_card, create_card, update_card, move_card, record_evidence, list_events, update_project. Inputs mirror domain types with bounded strings and strict object schemas. update_card takes {id,expectedRevision,patch}; evidence takes {id,expectedRevision,name,outcome,summary,sourceRevision?}; move takes {id,expectedRevision,column} with no override field. Results contain a JSON text block and structuredContent; tool failures have isError:true and {code,message,current?}. Tool descriptions state authorization and verification limits. Read-only tools have accurate readOnlyHint; mutation tools do not claim idempotence. No security decision depends on annotations.

- [ ] Verify exact SDK/Zod releases and peer requirements against registry plus official docs; pin compatible versions in the optional package only.
- [ ] Write failing client tests for missing service/credential, invalid/redirected URL, wrong protocol, timeout, conflict preservation, and secret-free diagnostics.
- [ ] Implement the constrained HTTP client, explicit tool schemas, and official SDK stdio transport. Keep stdout exclusively protocol messages; diagnostics go to stderr. Handle stdin EOF and shutdown without stopping the board service.
- [ ] Write/run SDK client handshake and tools/list/call tests against a temporary board: two independent stdio processes register one repository, create/read/update the same card, receive a stale-write conflict, record evidence, and move to Done. Malformed inputs and attempted override fail. Confirm persisted attribution is codex/claude respectively.
- [ ] Run all adapter and existing application checks; record runtime dependency/installed-size changes separately for the optional adapter.
- [ ] Commit the adapter and contract tests.

## Task 3: Shared skill and generated host packages

**Files:** create plugins/shared/skills/kanban-workflow/SKILL.md, scripts/package-plugins.mjs, scripts/validate-plugins.mjs, tests/plugins/package.test.ts; generate ignored artifacts under artifacts/plugins/; modify .gitignore and package scripts.

**Interfaces:** npm run package:plugins generates self-contained kanban-lite-codex and kanban-lite-claude directories and archives from the same adapter build and skill. Include adapter runtime source/build and package lock; install its locked runtime dependencies through the documented setup before host launch. Never depend on a developer checkout path or fetch code implicitly during plugin loading. Generate portable plugin.json/mcp.json plus verified host compatibility manifests: Codex .codex-plugin/plugin.json and Claude .claude-plugin/plugin.json/.mcp.json only where required by current installed host/docs. Match identities/versions, use actual supported root substitutions, and invoke node with argument arrays. Do not invent host schema fields. Packaging fails if the build is missing or manifests cannot be validated.

Shared skill describes inspect/select/claim/update/block/artifact/evidence/review handoff using implemented tools. When proposals await approval, Proceed authorizes the offered card-entry action only; it does not bypass repository or workflow approvals. Criteria belong in descriptions until actual execution supplies evidence. Refresh on conflicts and compare before applying a new revision. Skills must not fork Agent Skills/Superpowers or claim automatic OpenSpec integration.

- [ ] Read current host plugin format docs and installed CLI help. Record supported manifest fields and substitutions; use the target validator when available, otherwise record schema validation and its limits.
- [ ] Write failing package tests for skill/manifests, built entrypoints, exact shared tool contracts, paths with spaces, missing build, secret/state exclusion, and normal package install/start from an extracted archive.
- [ ] Implement deterministic generation/validation from shared sources and the skill; provide host-specific startup attribution.
- [ ] Run package tests and SDK handshake against each generated package, including shared-card update/conflict acceptance. Do not equate these tests with installed-host discovery.
- [ ] Commit sources and validation; do not commit generated node_modules, archives, or credentials.

## Task 4: Installation and real host acceptance

**Files:** modify README.md, docs/setup-prompts.md, .github/workflows/ci.yml; create docs/mcp-setup.md and docs/release-2-acceptance.md.

- [ ] Document explicit board start and adapter setup, custom data directories, direct MCP configuration, plugin install/reload/removal, runtime diagnostics, and optional dependency footprint. Replace browser-only instructions with tool instructions only after tools exist. Preserve browser fallback and Release 3 limitations.
- [ ] Enable CI adapter contract/package tests with locked installation. Keep browser and existing application checks; add no paid model calls or fake compatibility badge.
- [ ] Inspect existing host setup before installation. Install/configure locally through supported host flows without overwriting unrelated entries. Verify actual tool discovery and one harmless operation in available local Codex and Claude Code hosts. Claude executable was not found during planning; if unavailable, report that host acceptance as pending instead of claiming dual-host verification. Avoid installing a new host or purchasing access merely to clear the gate.
- [ ] Run clean installation, full application/adapter/package checks and relevant browser scenarios; record exact commits, service config without credentials, measurements, host evidence, and remaining acceptance limits.
- [ ] Obtain one independent whole-branch review, reproduce/fix meaningful findings, and rerun affected checks.
- [ ] Publish a reviewable feature PR and attach it. No merge. Report all release limits and review decisions.

## Documentation grounding and self-review

Context7 resolved /modelcontextprotocol/typescript-sdk and queried /modelcontextprotocol/typescript-sdk/v1.29.0 for registerTool, Zod input schemas, StdioClientTransport, handshake/listTools/callTool, structured errors, and cleanup. Registry compatibility and current host formats remain task checks before dependency installation and packaging. Plugin Creator local-plugin/package guides require real entrypoints, stdout protocol discipline, shared manifest identity, package validation, and installed-host verification.

Coverage check: endpoint authentication/concurrency in Task 1; adapter diagnostics and protocol in Task 2; shared sources and portable packages in Task 3; install/removal, actual host discovery, CI, and footprint in Task 4. OpenSpec synchronization is intentionally excluded by the Release 2 boundary. All five review-focus risks have an owning test task.

## Execution handoff

Recommended method: native execution in this chat, followed by one independent review. These tasks share the endpoint/tool contracts, so one implementer avoids repeated interface handoffs. This continues the execution method selected for Release 1. Implementation awaits review of this written Release 2 plan.
