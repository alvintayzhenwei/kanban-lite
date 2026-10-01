#!/usr/bin/env node
import { parseArgs } from "node:util";
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BoardClient } from "./client.js";
import { createMcpServer } from "./tools.js";
async function main(): Promise<void> {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major !== 24 || minor === undefined || minor < 21)
    throw new Error("Use Node.js 24.21.0 or a newer Node.js 24 patch.");
  const { values } = parseArgs({
    options: { client: { type: "string" }, "data-dir": { type: "string" } },
  });
  if (values.client !== "codex" && values.client !== "claude")
    throw new Error("Specify --client codex or --client claude.");
  const board = new BoardClient(
    values["data-dir"] ??
      process.env.KANBAN_DATA_DIR ??
      join(homedir(), ".kanban-lite"),
    values.client,
  );
  const server = createMcpServer(board);
  await server.connect(new StdioServerTransport());
  process.stdin.once("end", () => {
    void server.close();
  });
  const shutdown = () => {
    void server.close().then(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
main().catch(() => {
  console.error(
    "Kanban Lite MCP startup failed. Use Node 24.21+ (major 24), --client codex|claude, and a valid --data-dir. Reinstall adapter dependencies if needed.",
  );
  process.exitCode = 1;
});
