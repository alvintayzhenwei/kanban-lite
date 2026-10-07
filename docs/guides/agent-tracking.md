# Agent tracking and approval boundaries

Kanban Lite records project work alongside Agent Skills, Superpowers, and OpenSpec workflows. It does not read or modify their source documents. Keep those documents authoritative, attach their repository-relative paths as metadata, and follow each installed workflow's review and approval requirements.

Track card status separately from SDLC phase. Status moves through Backlog, Ready, In Progress, Review, and Done. Phases include Discovery, Design, Planning, Implementation, Review, and Verification. A Ready card can still be in Planning; an In Progress card can be in Implementation.

Record actual verification evidence on the card. Criteria belong in the description and do not count as passing evidence. Material edits invalidate old evidence; later failures supersede earlier success. Changed or failed completed work returns to Review. Card status, browser access, or artifact existence does not approve design, merge, deployment, or release. An explicit completion override needs a reason; browser-session access does not prove human identity.

## Project-chat tracking prompt

Use this in Codex's global instructions to offer tracking once in chats belonging to Codex projects:

```text
Offer Kanban Lite tracking once in new or existing chats belonging to a Codex
project: "Do you want to create this into Kanban Lite MCP?" Resolve membership
from explicit project context or the Codex app's current-chat projectId; check
list_threads/list_projects if available and needed. Do not infer membership
from a working directory or Git repository alone. If projectless or uncertain,
skip the automatic offer and continue work. Do not repeat the offer in the same
chat, and do not treat no answer as consent. Before confirmation, do not load
the Kanban workflow or call Kanban tools. After confirmation, inspect existing
projects/cards, verify the repository root, reuse matching cards, and record
only evidence that ran. Confirmation covers the identified task, not every
future request. Tracking must not block independently authorized work. A decline
or "Stop Kanban tracking" disables automatic tracking for that chat. This rule
creates no background monitor or automatic synchronization.
```

This prompt describes agent instruction behavior, not a guaranteed application event hook. MCP installation alone does not enable it. Project metadata and loaded host instructions determine whether the offer applies.

## Populate cards alongside existing workflows

After project setup, select **Add project** and enter the development repository's absolute path. Create one card per implementable task. Attach repository-relative specs and plans as metadata. Record only verification that ran, and do not mark work Done without current passing evidence.

The detailed [setup prompts](../setup-prompts.md) include browser setup, approved card entry, and recovery for a proposal-only chat. Card-entry approval authorizes only the proposed card changes; it does not authorize implementation, merge, or deployment.
