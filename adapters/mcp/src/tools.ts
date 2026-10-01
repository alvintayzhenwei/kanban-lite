import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BoardClient, BoardError } from "./client.js";
const text = (max: number) => z.string().trim().min(1).max(max);
const id = text(100);
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const column = z.enum(["Backlog", "Ready", "In Progress", "Review", "Done"]);
const phase = z.enum([
  "Discovery",
  "Design",
  "Planning",
  "Implementation",
  "Review",
  "Verification",
]);
const patch = z.strictObject({
  title: text(200).optional(),
  description: z.string().max(20000).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  owner: text(200).nullable().optional(),
  blockedReason: text(2000).nullable().optional(),
  phase: phase.optional(),
  artifacts: z
    .array(z.strictObject({ path: text(4096), label: text(200) }))
    .max(100)
    .optional(),
});
export function createMcpServer(board: BoardClient): McpServer {
  const server = new McpServer({ name: "kanban-lite", version: "0.2.0" });
  function add(
    name: string,
    description: string,
    schema: z.ZodType<Record<string, unknown>>,
    readOnly = false,
  ) {
    server.registerTool(
      `kanban_${name}`,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          const structuredContent = { result: await board.call(name, args) };
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(structuredContent),
              },
            ],
            structuredContent,
          };
        } catch (error) {
          const structuredContent =
            error instanceof BoardError
              ? {
                  code: error.code,
                  message: error.message,
                  ...(error.current === undefined
                    ? {}
                    : { current: error.current }),
                }
              : {
                  code: "SERVICE_ERROR",
                  message: "Board operation failed. Check the local service.",
                };
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(structuredContent),
              },
            ],
            structuredContent,
          };
        }
      },
    );
  }
  add(
    "list_projects",
    "List explicitly registered repositories. Does not scan files.",
    z.strictObject({}),
    true,
  );
  add(
    "register_project",
    "Register an explicitly authorized local Git repository root. No files are modified; use expectedRevision 0.",
    z.strictObject({
      name: text(200),
      root: text(4096),
      expectedRevision: z.literal(0),
    }),
  );
  add(
    "list_cards",
    "List cards, optionally for one project. Inspect before creating to avoid duplicates.",
    z.strictObject({ projectId: id.optional() }),
    true,
  );
  add(
    "get_card",
    "Read current card, evidence, and revision before editing.",
    z.strictObject({ id }),
    true,
  );
  add(
    "create_card",
    "Create an authorized task card in Backlog with expectedRevision 0. Criteria belong in its description, not passing evidence. Creation does not authorize implementation.",
    z.strictObject({
      projectId: id,
      title: text(200),
      description: z.string().max(20000).optional(),
      expectedRevision: z.literal(0),
    }),
  );
  add(
    "update_card",
    "Update card fields, owner, blocker, phase, and artifact metadata using its current expectedRevision. Material edits invalidate verification; reconcile conflicts instead of overwriting.",
    z.strictObject({ id, expectedRevision: revision, patch }),
  );
  add(
    "move_card",
    "Move authorized work using current expectedRevision. Done requires current passing evidence. Agents cannot submit human overrides; movement never approves merge/deployment.",
    z.strictObject({ id, expectedRevision: revision, column }),
  );
  add(
    "record_evidence",
    "Record actual executed verification, its outcome, summary, and optional tested source revision. Never treat proposed criteria as passing evidence.",
    z.strictObject({
      id,
      expectedRevision: revision,
      name: text(200),
      outcome: z.enum(["passed", "failed"]),
      summary: text(4000),
      sourceRevision: text(200).optional(),
    }),
  );
  add(
    "list_events",
    "Read append-only card activity with client attribution, not proof of human identity.",
    z.strictObject({ id }),
    true,
  );
  add(
    "update_project",
    "Update an authorized project name or WIP warning limit using its current expectedRevision.",
    z.strictObject({
      id,
      expectedRevision: revision,
      patch: z.strictObject({
        name: text(200).optional(),
        wipLimit: z.number().int().min(1).max(1000).nullable().optional(),
      }),
    }),
  );
  return server;
}
