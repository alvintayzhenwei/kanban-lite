import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import type { IncomingMessage } from "node:http";
import { HttpError } from "./session.js";
export function authenticateAgent(req: IncomingMessage, dataDir: string): void {
  if (req.headers.origin !== undefined)
    throw new HttpError(403, "Browser origins cannot access agent operations.");
  if (!req.headers.authorization?.startsWith("Bearer "))
    throw new HttpError(403, "Invalid agent credential.");
  const credential = Buffer.from(
    readFileSync(join(dataDir, "credential"), "utf8"),
  );
  const provided = Buffer.from(
    req.headers.authorization?.replace(/^Bearer /, "") ?? "",
  );
  if (
    provided.length !== credential.length ||
    !timingSafeEqual(provided, credential)
  )
    throw new HttpError(403, "Invalid agent credential.");
}
