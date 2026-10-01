import { randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { mkdirSync, writeFileSync, readFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const random = () => randomBytes(32).toString("hex");
export function createSessions(dataDir: string) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const credentialPath = join(dataDir, "credential");
  try {
    writeFileSync(credentialPath, random(), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  chmodSync(credentialPath, 0o600);
  if (!/^[a-f0-9]{64}$/.test(readFileSync(credentialPath, "utf8")))
    throw new Error("Invalid local credential file.");
  let bootstrapToken: string | null = random();
  const token = bootstrapToken;
  const sessions = new Map<string, { csrf: string; expires: number }>();
  function session(req: IncomingMessage) {
    const key = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("kanban_session="))
      ?.slice("kanban_session=".length);
    const found = key ? sessions.get(key) : undefined;
    if (!found || found.expires < Date.now()) {
      if (key) sessions.delete(key);
      throw new HttpError(401, "Open an authenticated board session.");
    }
    return found;
  }
  return {
    token,
    session,
    login(value: unknown) {
      if (
        typeof value !== "string" ||
        bootstrapToken === null ||
        value.length !== bootstrapToken.length ||
        !timingSafeEqual(Buffer.from(value), Buffer.from(bootstrapToken))
      )
        throw new HttpError(401, "Invalid or used session link.");
      bootstrapToken = null;
      for (const [key, s] of sessions)
        if (s.expires < Date.now()) sessions.delete(key);
      const id = random(),
        csrf = random();
      sessions.set(id, { csrf, expires: Date.now() + 8 * 60 * 60 * 1000 });
      return {
        csrf,
        cookie: `kanban_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
      };
    },
  };
}
