# Release 2 acceptance

Date: 2026-10-02 (Asia/Singapore). The shared MCP adapter and generated host packages are implemented. Actual Codex host discovery/call is verified; installed Claude Code acceptance remains pending because no Claude executable is available on this machine. OpenSpec import/reconciliation remains Release 3. No merge or public publication is performed by this work.

## Architecture and checks

The board service remains the sole SQLite writer. A bearer-protected `/agent/operation` endpoint rejects browser origins, forged identities, unknown fields/operations, missing credentials, wrong authentication schemes, and requests over 64 KiB. Agent completion cannot use human overrides. Browser sessions retain their Origin/CSRF checks.

The optional adapter uses the official MCP SDK 1.29.0 and Zod 4.6.5, exact versions pinned and dependencies locked separately. It discovers the matching explicit service via the selected data directory, validates loopback endpoints and protocol, rejects redirects, limits responses/timeouts, and produces structured errors without credentials. Its stdout is reserved for MCP. Closing an adapter leaves the board running.

Observed checks before independent review:

- 30 application Node tests, lint, types, and build passed.
- Eight adapter tests passed, including real stdio handshakes, two client processes sharing one card, stale-write conflicts, evidence-gated Done, no human override, missing-service diagnostics, invalid endpoints, redirects, and timeouts.
- Two package tests passed: schema/identity validation, build presence, archive exclusion, and safe failure without deleting existing output.
- Four Chromium scenarios passed for the existing browser workflows.
- Formatting passed; root and optional-adapter dependency audits reported zero vulnerabilities at installation.

Extracted Codex and Claude packages were installed with `npm ci --offline --omit=dev --ignore-scripts` using the populated npm cache. Both executed their declared built stdio entrypoints from paths containing spaces. They discovered ten tools and read/updated the same card; the stale client received the current state. This is SDK contract acceptance for both packages, not installed Claude host acceptance.

## Installed Codex evidence

Codex CLI 0.159.2 installed `kanban-lite-codex@kanban-lite-local` through its supported marketplace/plugin commands. An ephemeral app-server session, without model inference, reported the plugin's `kanban` server as connected and discovered all ten tools. `mcpServer/tool/call` successfully invoked `kanban_list_projects` against the actual local board and returned its two registered projects. No cards were changed for this check.

The first attempt discovered tools but returned `SERVICE_UNAVAILABLE`: the host did not forward `KANBAN_DATA_DIR` from its environment. Configuring an explicit nonsecret `--data-dir` in both local source MCP manifests before reinstalling resolved it. The local personal installation points to the preserved existing board directory. Portable archives contain no personal path or credential. A new Codex chat/session is required to load newly installed skill/tool definitions.

The old board process owned by this chat was restarted with the new endpoint while preserving its existing database and loopback URL `http://127.0.0.1:4317`. The service remains running for local use. This is a local feature build, not proof that GitHub main contains Release 2.

## Optional footprint

Measured with Node 24.21.0 on macOS arm64; five adapter subprocesses, idle RSS sampled 500 ms after initialization. The adapter's MCP initialization median was **82.3 ms**; idle RSS median was **75.1 MiB**, including Node and excluding the separate board/browser. Samples: initialization 71.7, 82.3, 81.5, 95.5, 84.3 ms; RSS 75.0, 75.3, 75.1, 74.8, 75.5 MiB.

The optional adapter has two direct runtime dependencies and 94 locked production packages including transitive dependencies. Installed production dependency files total **17,041,358 bytes** on this machine. Generated source/build archives measured 22,644 bytes (Codex) and 22,542 bytes (Claude), excluding installed dependencies. Archive compression/timestamps may vary; these are observed sizes, not universal guarantees. The standalone browser application still has zero third-party runtime dependencies. Running both hosts starts two adapters and therefore adds memory for each.

## Workflow verification and limits

The real earlier proposal-only chat stalled after Proceed, establishing the ambiguous authorization baseline. An isolated pressure exercise checked card approval, stale revisions, missing verification, and checked source tasks. After reading the shared skill, the agent correctly scoped card entry, preserved concurrent edits, required actual evidence, and distinguished manual reconciliation from an automatic sync tool. These are instruction checks, not a guarantee that every future agent will comply; the service separately enforces revisions and the no-override completion policy.

Claude Code loader validation/discovery and a real host operation remain pending. No dual-host compatibility badge is added. Source documents remain authoritative; the plugin does not synchronize or modify OpenSpec files. Passing evidence is an attributable agent assertion, not proof of production readiness or authorization to merge/deploy. Local credentials trust processes running as the owner; client labels do not authenticate a human.

## Execution decisions

- Reuse the dedicated clean feature checkout; concurrent edits need separate isolation.
- Keep SDK dependencies optional; this preserves browser simplicity but adds the measured adapter footprint.
- Keep package tests in separate commands/CI so browser-only development does not require the SDK.
- Canonicalize macOS temporary extraction paths after npm treated a `/var` alias as a local package absent from the lockfile; tests use the corresponding `/private` path.
- Use explicit personal plugin data-directory arguments after host environment forwarding failed; custom installations need that setup rather than relying on a shell export.
- Validate portable schemas plus real Codex loading; Claude host verification stays pending instead of fabricated acceptance.
- Package generation refuses existing output, protecting personal configuration/dependencies; rebuilding requires a new output directory.
- Keep existing source approval rules and defer OpenSpec synchronization; tracking capability does not implement Release 3.

Independent-review outcomes and final clean-install/CI results are recorded below when verified.
