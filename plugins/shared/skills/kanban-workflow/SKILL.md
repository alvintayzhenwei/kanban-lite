---
name: kanban-workflow
description: Use when tracking repository work, entering approved task cards, recording blockers or verification, or handing work between Codex and Claude through Kanban Lite MCP tools.
---

# Kanban Lite workflow

Use the discovered `kanban_*` MCP tools; host prefixes may precede their names. If tools are missing, follow the plugin installation guide. Do not invent tools or write directly to SQLite. The board service must already be running with the adapter's data directory.

## Authorization and source authority

Read repository instructions and the relevant installed Agent Skills, Superpowers, or OpenSpec workflow before planning or implementing work. Keep source specs/plans authoritative; artifact links are metadata, not file access or automatic synchronization. Do not bundle or replace those workflows.

When proposing cards, state the offered action explicitly: “Reply Proceed to create these cards; implementation remains separate.” In that context, Proceed authorizes card entry. Create the approved cards without asking whether to implement them. If the earlier proposal did not identify the action, clarify only the unresolved scope. Card status, checked OpenSpec tasks, or an existing plan never establish approval, passing verification, merge, deployment, or production acceptance.

## Inspect and enter cards

1. Use `kanban_list_projects` and identify the requested repository. Register its explicit absolute Git root with `kanban_register_project` only when authorized; creation uses `expectedRevision: 0`.
2. Use `kanban_list_cards` for that project. Inspect likely matches before creating; do not duplicate approved work or silently overwrite another agent's card.
3. Create missing approved cards with `kanban_create_card`, including verification criteria in the description. Cards start in Backlog and Discovery. Apply requested phase, owner, priority, blockers, and repository-relative artifacts with `kanban_update_card`; move with `kanban_move_card`.
4. Use the revision returned by each operation for the next mutation. Verify saved cards with `kanban_get_card` or `kanban_list_cards`; report created/skipped counts and any incomplete actions. Do not claim an unsaved draft exists on the board.

## Select, execute, and reconcile

Inspect the current card and source documents before selecting a Ready task. Claim ownership and move it only within the authorized implementation scope. Keep SDLC phase separate from board column. Record concrete blockers and hand work back for review when appropriate.

A `CONFLICT` includes current state. Compare it with your intended change and preserve concurrent work. Do not blindly retry your old patch with a new revision. Reconcile compatible changes; surface incompatible ownership or scope changes before editing. There is no cross-operation transaction, automatic retry, or automatic rollback: after a partial workflow, inspect saved state and continue only the missing authorized actions.

## Verification and handoff

Record only executed checks with `kanban_record_evidence`: name, passed/failed outcome, factual summary, and tested source revision when available. Proposed test criteria and historical checkmarks are not passing evidence. Preserve failures; a later failed check supersedes earlier success.

Use `kanban_move_card` for Done only after current passing evidence exists and required workflow review is complete. Changes to title, description, or artifact links invalidate evidence. Required review means the review steps mandated by the active repository/workflow instructions. MCP cannot submit a human completion override; if manual acceptance is appropriate, the owner must use the browser and record the reason. Do not work around that restriction by recording fabricated passing evidence.

Use `kanban_list_events` to inspect history. Client labels identify the adapter, not authenticated human identity. Handoff states what changed, actual checks, remaining blockers, and whether implementation, merge, deployment, or owner acceptance is still pending.

## Diagnostics

`SERVICE_UNAVAILABLE`: start/reuse the explicit board service, matching `--data-dir`. `INCOMPATIBLE_PROTOCOL`: rebuild and restart matching board/adapter versions. `UNAUTHORIZED`: verify the data directory and local service configuration; never print credentials. `INVALID_INPUT`: correct bounded fields. `POLICY`: satisfy the completion requirements. Manual reconciliation with card tools is possible when authorized, but no automatic synchronization tool exists in this release; OpenSpec import/reconciliation is a later release.
