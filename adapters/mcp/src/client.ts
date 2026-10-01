import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
export class BoardError extends Error {
  constructor(
    public code: string,
    message: string,
    public current?: unknown,
  ) {
    super(message);
  }
}
function validUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^http:\/\/127\.0\.0\.1:\d+\/?$/.test(value)
  )
    throw new BoardError(
      "CONFIGURATION",
      "Invalid loopback endpoint in service lock. Restart Kanban Lite.",
    );
  const url = new URL(value);
  const port = Number(url.port || 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new BoardError(
      "CONFIGURATION",
      "Invalid loopback endpoint in service lock. Restart Kanban Lite.",
    );
  return url.origin;
}
export class BoardClient {
  readonly dataDir: string;
  constructor(
    dataDir: string,
    readonly client: "claude" | "codex",
    readonly timeoutMs = 5000,
  ) {
    this.dataDir = resolve(dataDir);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000)
      throw new BoardError(
        "CONFIGURATION",
        "Use a timeout between 1 and 10000 ms.",
      );
  }
  private async settings(): Promise<{ url: string; credential: string }> {
    let lock: { pid?: unknown; url?: unknown };
    try {
      lock = JSON.parse(
        await readFile(
          join(this.dataDir, "service.lock", "owner.json"),
          "utf8",
        ),
      );
    } catch {
      throw new BoardError(
        "SERVICE_UNAVAILABLE",
        "Start Kanban Lite explicitly with the same --data-dir before using MCP tools.",
      );
    }
    if (!lock || !Number.isSafeInteger(lock.pid) || Number(lock.pid) < 1)
      throw new BoardError(
        "CONFIGURATION",
        "Invalid service lock. Restart Kanban Lite.",
      );
    try {
      process.kill(Number(lock.pid), 0);
    } catch {
      throw new BoardError(
        "SERVICE_UNAVAILABLE",
        "Start Kanban Lite explicitly with the same --data-dir before using MCP tools.",
      );
    }
    const url = validUrl(lock.url);
    let credential: string;
    try {
      credential = await readFile(join(this.dataDir, "credential"), "utf8");
    } catch {
      throw new BoardError(
        "CONFIGURATION",
        "Local credential is missing. Check --data-dir and start Kanban Lite.",
      );
    }
    if (!/^[a-f0-9]{64}$/.test(credential))
      throw new BoardError(
        "CONFIGURATION",
        "Invalid local credential. Check --data-dir.",
      );
    return { url, credential };
  }
  private async request(
    url: string,
    init?: RequestInit,
  ): Promise<{ status: number; data: Record<string, unknown> }> {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const reader = response.body?.getReader();
      let size = 0;
      const chunks: Uint8Array[] = [];
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4194304) {
              await reader.cancel();
              throw new Error("response limit");
            }
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<
        string,
        unknown
      >;
      return { status: response.status, data };
    } catch {
      throw new BoardError(
        "SERVICE_UNAVAILABLE",
        "Kanban Lite service is unavailable, redirected, timed out, or returned an invalid response. Check its terminal and --data-dir.",
      );
    }
  }
  async call(
    operation: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const { url, credential } = await this.settings();
    const health = await this.request(`${url}/health`);
    if (
      health.status !== 200 ||
      health.data?.name !== "kanban-lite" ||
      health.data.agentProtocolVersion !== 1
    )
      throw new BoardError(
        "INCOMPATIBLE_PROTOCOL",
        "Incompatible Kanban Lite agent protocol. Rebuild and restart the board service and adapter.",
      );
    const body = JSON.stringify({
      client: this.client,
      operation,
      arguments: args,
    });
    if (Buffer.byteLength(body) > 65536)
      throw new BoardError(
        "INVALID_INPUT",
        "Request exceeds the 64 KiB limit.",
      );
    const result = await this.request(`${url}/agent/operation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${credential}`,
      },
      body,
    });
    if (result.status === 200) return result.data;
    const codes: Record<number, string> = {
      400: "INVALID_INPUT",
      401: "UNAUTHORIZED",
      403: "UNAUTHORIZED",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "INVALID_INPUT",
      422: "POLICY",
    };
    const code = codes[result.status] ?? "SERVICE_ERROR";
    const message =
      typeof result.data?.error === "string"
        ? result.data.error.replaceAll(credential, "[redacted]")
        : "Board operation failed.";
    throw new BoardError(code, message, result.data?.current);
  }
}
