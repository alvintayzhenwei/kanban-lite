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
  const links = new Map<string, number>();
  function issue() {
    for (const [key, expires] of links)
      if (expires <= Date.now()) links.delete(key);
    if (links.size >= 20)
      throw new HttpError(
        429,
        "Too many unused session links. Retry in five minutes.",
      );
    const token = random();
    links.set(token, Date.now() + 5 * 60 * 1000);
    return token;
  }
  const token = issue();
  const sessions = new Map<
    string,
    { csrf: string; expires: number; verifiedAt: number; id: string }
  >();
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
  function issueSession(verifiedAt = Date.now()) {
    for (const [key, s] of sessions)
      if (s.expires < Date.now()) sessions.delete(key);
    if (sessions.size >= 100)
      throw new HttpError(429, "Too many browser sessions.");
    const id = random(),
      csrf = random();
    sessions.set(id, {
      id,
      csrf,
      verifiedAt,
      expires: Date.now() + 8 * 60 * 60 * 1000,
    });
    return {
      csrf,
      cookie: `kanban_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
    };
  }
  return {
    issueSession,
    logout(id: string) {
      sessions.delete(id);
    },
    invalidateAll() {
      sessions.clear();
    },
    valid(id: string) {
      const s = sessions.get(id);
      return (
        !!s && s.expires > Date.now() && Date.now() - s.verifiedAt < 300000
      );
    },
    token,
    issue,
    session,
    login(value: unknown) {
      if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
        throw new HttpError(401, "Invalid, expired or used session link.");
      const match = [...links].find(([key]) =>
        timingSafeEqual(Buffer.from(value), Buffer.from(key)),
      );
      if (!match || match[1] <= Date.now())
        throw new HttpError(401, "Invalid, expired or used session link.");
      links.delete(match[0]);
      return issueSession();
    },
  };
}
