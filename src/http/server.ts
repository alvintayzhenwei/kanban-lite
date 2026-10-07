import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createPasskeys } from "../security/passkeys.js";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { backupStore } from "../storage/backup.js";
import type { Store } from "../storage/database.js";
import type { Config } from "../config.js";
import { createSessions, HttpError } from "../security/session.js";
import { object } from "../domain/validation.js";
import { authenticateAgent } from "../security/agent.js";
import { agentOperation } from "./agent.js";
import { route } from "./routes.js";
import { errorResponse } from "./errors.js";
export interface RunningServer {
  url: string;
  bootstrapUrl: string;
  close(): Promise<void>;
}
async function jsonBody(req: IncomingMessage): Promise<unknown> {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new HttpError(400, "Use application/json.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const b = Buffer.from(chunk);
    size += b.length;
    if (size > 65536) throw new HttpError(413, "Request is too large.");
    chunks.push(b);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}
const sourceAssets = new URL("../../public/", import.meta.url);
const assets = existsSync(sourceAssets)
  ? sourceAssets
  : new URL("../../../public/", import.meta.url);
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", assets), "utf8"),
) as { version: string };
const files: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html" },
  "/app.js": { file: "app.js", type: "text/javascript" },
  "/passkeys.js": { file: "passkeys.js", type: "text/javascript" },
  "/api.js": { file: "api.js", type: "text/javascript" },
  "/styles.css": { file: "styles.css", type: "text/css" },
};
export async function startServer(
  store: Store,
  config: Config,
): Promise<RunningServer> {
  const sessions = createSessions(config.dataDir);
  let origin = "";
  let browserOrigin = "";
  const server = createServer((req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    void (async () => {
      if (
        ![new URL(origin).host, new URL(browserOrigin).host].includes(
          req.headers.host ?? "",
        )
      )
        throw new HttpError(403, "Invalid Host.");
      const requestOrigin =
        req.headers.host === new URL(browserOrigin).host
          ? browserOrigin
          : origin;
      const url = new URL(req.url ?? "/", requestOrigin);
      const method = req.method ?? "GET";
      if (method === "GET" && url.pathname === "/health")
        return send(res, 200, {
          name: "kanban-lite",
          version,
          protocolVersion: 1,
          agentProtocolVersion: 1,
        });
      if (method === "GET" && url.pathname === "/webauthn.js") {
        const data = await readFile(
          new URL(
            "../dist/bundle/index.umd.min.js",
            import.meta.resolve("@simplewebauthn/browser"),
          ),
        );
        res.writeHead(200, {
          "Content-Type": "text/javascript; charset=utf-8",
        });
        res.end(data);
        return;
      }
      if (method === "GET" && files[url.pathname]) {
        const asset = files[url.pathname]!;
        const data = await readFile(new URL(asset.file, assets));
        res.writeHead(200, { "Content-Type": `${asset.type}; charset=utf-8` });
        res.end(data);
        return;
      }
      if (url.pathname === "/agent/operation" && method === "POST") {
        authenticateAgent(req, config.dataDir);
        return send(res, 200, await agentOperation(store, await jsonBody(req)));
      }
      if (url.pathname === "/ops/session" && method === "POST") {
        authenticateAgent(req, config.dataDir);
        object(await jsonBody(req), []);
        return send(res, 200, {
          url: `${browserOrigin}/?login#${sessions.issue()}`,
        });
      }
      if (url.pathname === "/ops/backup" && method === "POST") {
        const credential = readFileSync(
          join(config.dataDir, "credential"),
          "utf8",
        );
        const provided =
          req.headers.authorization?.replace(/^Bearer /, "") ?? "";
        if (
          req.headers.origin ||
          provided.length !== credential.length ||
          !timingSafeEqual(Buffer.from(provided), Buffer.from(credential))
        )
          throw new HttpError(403, "Invalid operational credential.");
        const b = object(await jsonBody(req), ["output"]);
        if (typeof b.output !== "string" || !b.output || b.output.length > 4096)
          throw new HttpError(400, "Invalid backup output path.");
        await backupStore(store, b.output);
        return send(res, 200, { saved: true });
      }
      if (!url.pathname.startsWith("/api/"))
        throw new HttpError(404, "Not found.");
      const mutation = !["GET", "HEAD"].includes(method);
      if (
        (mutation || req.headers.origin) &&
        req.headers.origin !== requestOrigin
      )
        throw new HttpError(403, "Invalid Origin.");
      if (url.pathname === "/api/session" && method === "POST") {
        const b = object(await jsonBody(req), ["token"]);
        const result = sessions.login(b.token);
        res.setHeader("Set-Cookie", result.cookie);
        return send(res, 200, { csrf: result.csrf });
      }
      if (
        url.pathname.startsWith("/api/passkeys/") &&
        url.pathname.includes("/authenticate/")
      ) {
        if (method !== "POST" || req.headers.origin !== browserOrigin)
          throw new HttpError(403, "Use the localhost board for passkeys.");
        const b = await jsonBody(req);
        const cookie = req.headers.cookie
          ?.split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("kanban_preauth="))
          ?.slice(15);
        if (url.pathname === "/api/passkeys/authenticate/options") {
          object(b, []);
          const binding =
            cookie && /^[a-f0-9]{64}$/.test(cookie)
              ? cookie
              : randomBytes(32).toString("hex");
          // Global ceremony limits also bound clients which discard cookies.
          const options = await passkeys.authenticationOptions(binding);
          res.setHeader(
            "Set-Cookie",
            `kanban_preauth=${binding}; HttpOnly; SameSite=Strict; Path=/api/passkeys; Max-Age=300`,
          );
          return send(res, 200, options);
        }
        if (url.pathname === "/api/passkeys/authenticate/verify") {
          if (!cookie || !/^[a-f0-9]{64}$/.test(cookie))
            throw new HttpError(401, "Start passkey sign-in again.");
          await passkeys.verifyAuthentication(cookie, b);
          const result = sessions.issueSession(Date.now());
          res.setHeader("Set-Cookie", [
            result.cookie,
            "kanban_preauth=; HttpOnly; SameSite=Strict; Path=/api/passkeys; Max-Age=0",
          ]);
          return send(res, 200, { csrf: result.csrf });
        }
        throw new HttpError(404, "Not found.");
      }
      const session = sessions.session(req);
      if (mutation && req.headers["x-csrf-token"] !== session.csrf)
        throw new HttpError(403, "Invalid CSRF token.");
      if (url.pathname === "/api/session" && method === "GET")
        return send(res, 200, { csrf: session.csrf });
      if (url.pathname === "/api/passkeys" && method === "GET")
        return send(
          res,
          200,
          passkeys.keys
            .list()
            .map((k) => ({ id: k.id, createdAt: k.createdAt })),
        );
      if (url.pathname.startsWith("/api/passkeys")) {
        if (req.headers.origin !== browserOrigin)
          throw new HttpError(403, "Use the localhost board for passkeys.");
        if (!sessions.valid(session.id))
          throw new HttpError(401, "Sign in again before managing passkeys.");
        if (
          method === "POST" &&
          url.pathname === "/api/passkeys/register/options"
        ) {
          object(await jsonBody(req), []);
          return send(res, 200, await passkeys.registrationOptions(session.id));
        }
        if (
          method === "POST" &&
          url.pathname === "/api/passkeys/register/verify"
        ) {
          await passkeys.verifyRegistration(
            session.id,
            await jsonBody(req),
            () => sessions.valid(session.id),
          );
          return send(res, 200, { saved: true });
        }
        if (method === "DELETE" && url.pathname.startsWith("/api/passkeys/")) {
          const id = decodeURIComponent(
            url.pathname.slice("/api/passkeys/".length),
          );
          if (!passkeys.keys.remove(id))
            throw new HttpError(404, "Passkey not found.");
          passkeys.invalidate();
          sessions.invalidateAll();
          return send(res, 200, { removed: true });
        }
        throw new HttpError(404, "Not found.");
      }
      const body =
        mutation && method !== "DELETE" ? await jsonBody(req) : undefined;
      send(
        res,
        200,
        await route(store, method, url, body, {
          client: "browser",
          humanSession: true,
        }),
      );
    })().catch((error) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const result = errorResponse(error);
      send(res, result.status, result.body);
    });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  browserOrigin = origin.replace("127.0.0.1", "localhost");
  const passkeys = createPasskeys(store, browserOrigin);
  return {
    url: origin,
    bootstrapUrl: `${browserOrigin}/#${sessions.token}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
      }),
  };
}
