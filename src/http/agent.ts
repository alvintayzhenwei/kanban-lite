import type { Store } from "../storage/database.js";
import { object, text } from "../domain/validation.js";
import { HttpError } from "../security/session.js";
import { route } from "./routes.js";
export async function agentOperation(
  store: Store,
  body: unknown,
): Promise<unknown> {
  const b = object(body, ["client", "operation", "arguments"]);
  if (b.client !== "claude" && b.client !== "codex")
    throw new HttpError(400, "Use client claude or codex.");
  const actor = { client: b.client, humanSession: false } as const;
  const operation = text(b.operation, "Operation", 100);
  const base = "http://127.0.0.1";
  const a = b.arguments;
  if (operation === "list_projects") {
    object(a, []);
    return route(
      store,
      "GET",
      new URL("/api/projects", base),
      undefined,
      actor,
    );
  }
  if (operation === "list_cards") {
    const args = object(a, ["projectId"]);
    const url = new URL("/api/cards", base);
    if (args.projectId !== undefined)
      url.searchParams.set(
        "projectId",
        text(args.projectId, "Project ID", 100),
      );
    return route(store, "GET", url, undefined, actor);
  }
  if (operation === "register_project" || operation === "create_card") {
    return route(
      store,
      "POST",
      new URL(
        operation === "register_project" ? "/api/projects" : "/api/cards",
        base,
      ),
      a,
      actor,
    );
  }
  if (operation === "get_card" || operation === "list_events") {
    const args = object(a, ["id"]);
    const id = encodeURIComponent(text(args.id, "Card ID", 100));
    return route(
      store,
      "GET",
      new URL(
        `/api/cards/${id}${operation === "list_events" ? "/events" : ""}`,
        base,
      ),
      undefined,
      actor,
    );
  }
  if (operation === "update_card" || operation === "update_project") {
    const args = object(a, ["id", "expectedRevision", "patch"]);
    const patch = object(
      args.patch,
      operation === "update_card"
        ? [
            "title",
            "description",
            "priority",
            "owner",
            "blockedReason",
            "phase",
            "artifacts",
          ]
        : ["name", "wipLimit"],
    );
    const id = encodeURIComponent(text(args.id, "Item ID", 100));
    return route(
      store,
      "PATCH",
      new URL(
        `/api/${operation === "update_card" ? "cards" : "projects"}/${id}`,
        base,
      ),
      { ...patch, expectedRevision: args.expectedRevision },
      actor,
    );
  }
  if (operation === "move_card" || operation === "record_evidence") {
    const args = object(
      a,
      operation === "move_card"
        ? ["id", "expectedRevision", "column"]
        : [
            "id",
            "expectedRevision",
            "name",
            "outcome",
            "summary",
            "sourceRevision",
          ],
    );
    const { id, ...input } = args;
    return route(
      store,
      "POST",
      new URL(
        `/api/cards/${encodeURIComponent(text(id, "Card ID", 100))}/${operation === "move_card" ? "move" : "evidence"}`,
        base,
      ),
      input,
      actor,
    );
  }
  throw new HttpError(400, "Unknown agent operation.");
}
