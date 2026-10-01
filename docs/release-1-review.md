# Release 1 review and decisions

A fresh independent reviewer inspected the foundation against the design and implementation plan. Two findings were reproduced in separate temporary copies:

1. Concurrent stale-lock reclamation admitted two live writers. Fixed by serializing acquisition/reclamation with an atomic directory guard and checking a unique ownership token before releasing a lock. The controlled two-process regression and replacement-owner cleanup regression failed before the fix and pass afterward.
2. Restore accepted SQLite-valid but unreadable application records. Fixed by validating all serialized cards, evidence, events, project metadata, relationships, and revisions before replacing the target. Malformed JSON and invalid shapes leave the existing board unchanged. Regressions failed before the fix and pass afterward.

The complete corrected suite passes: 28 Node tests and four Chromium scenarios. No minor findings were deferred. No merge was performed.

## Decisions made during execution

- Use the dedicated new checkout on feature/kanban-foundation for isolation; main is not edited. Concurrent additional development would need another checkout.
- Require fresh passing evidence after material card edits. Editorial edits to material fields can require recording evidence again.
- Validate automation through actual GitHub runs and a clean checkout instead of tests that inspect configuration source text. CI acceptance therefore depends on GitHub availability.
- Defer MCP adapters and actual Claude Code/Codex acceptance to Release 2. Foundation acceptance does not establish plugin compatibility.
- Defer OpenSpec reconciliation and workflow integration to Release 3. Foundation acceptance does not establish automated synchronization.
- After automatic approval review rejected a main push, wait for explicit approval. The user approved design-only main initialization at e1021b8; draft PR #5 now contains application changes. No merge occurred.
- Defer artifact-content TOCTOU review because this release serves no artifact content. A future reading endpoint needs its own containment review.
- Leave an interrupted acquisition guard for inspection rather than automatically reclaiming it. A crash during acquisition can require manual guard cleanup; this avoids repeating the stale-lock race.
