import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createServer, request } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fixture } from "../helpers.js";
import { startServer } from "../../src/http/server.js";
async function setup(t: TestContext) {
  const f = fixture(t);
  const server = await startServer(f.store, { dataDir: f.dir, port: 0 });
  t.after(() => server.close());
  const token = new URL(server.bootstrapUrl).hash.slice(1);
  const login = await fetch(`${server.url}/api/session`, {
    method: "POST",
    headers: { Origin: server.url, "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const { csrf } = (await login.json()) as { csrf: string };
  const headers = {
    Origin: server.url,
    "Content-Type": "application/json",
    Cookie: cookie,
    "X-CSRF-Token": csrf,
  };
  return { ...f, server, headers, token };
}
test("HTTP session protects reads and cross-site mutations", async (t) => {
  const { server, headers, token } = await setup(t);
  assert.equal((await fetch(`${server.url}/api/projects`)).status, 401);
  assert.equal(
    (await fetch(`${server.url}/api/projects`, { headers })).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${server.url}/api/cards`, {
        method: "POST",
        headers: { ...headers, Origin: "https://hostile.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${server.url}/api/cards`, {
        method: "POST",
        headers: {
          Origin: server.url,
          Cookie: headers.Cookie,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(`${server.url}/api/session`, {
        method: "POST",
        headers: { Origin: server.url, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
    ).status,
    401,
  );
});
test("fresh browser links preserve sessions and require local credentials", async (t) => {
  const { server, headers, dir } = await setup(t);
  const authorization = `Bearer ${readFileSync(join(dir, "credential"), "utf8")}`;
  const rejectedHeaders: Record<string, string>[] = [
    {},
    { Authorization: "Bearer wrong" },
    { Authorization: authorization, Origin: server.url },
    { Authorization: authorization, Origin: "https://hostile.example" },
  ];
  for (const extra of rejectedHeaders) {
    const rejected = await fetch(`${server.url}/ops/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extra },
      body: "{}",
    });
    assert.equal(rejected.status, 403);
  }
  const links: string[] = [];
  for (let i = 0; i < 2; i++) {
    const response = await fetch(`${server.url}/ops/session`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(response.status, 200);
    links.push(((await response.json()) as { url: string }).url);
  }
  assert.notEqual(links[0], links[1]);
  for (const link of links) {
    assert.equal(new URL(link).origin, server.url);
    const login = () =>
      fetch(`${server.url}/api/session`, {
        method: "POST",
        headers: { Origin: server.url, "Content-Type": "application/json" },
        body: JSON.stringify({ token: new URL(link).hash.slice(1) }),
      });
    const response = await login();
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    assert.equal(
      (
        await fetch(`${server.url}/api/projects`, {
          headers: { Cookie: cookie },
        })
      ).status,
      200,
    );
    assert.equal((await login()).status, 401);
  }
  assert.equal(
    (await fetch(`${server.url}/api/projects`, { headers })).status,
    200,
  );
});
test("unused browser links expire without ending existing sessions", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  const { server, headers, dir } = await setup(t);
  const response = await fetch(`${server.url}/ops/session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readFileSync(join(dir, "credential"), "utf8")}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(response.status, 200);
  const { url } = (await response.json()) as { url: string };
  t.mock.timers.tick(5 * 60 * 1000);
  const login = await fetch(`${server.url}/api/session`, {
    method: "POST",
    headers: { Origin: server.url, "Content-Type": "application/json" },
    body: JSON.stringify({ token: new URL(url).hash.slice(1) }),
  });
  assert.equal(login.status, 401);
  assert.equal(
    (await fetch(`${server.url}/api/projects`, { headers })).status,
    200,
  );
});
test("HTTP validates payloads, bounds and forged identity", async (t) => {
  const { server, headers } = await setup(t);
  for (const body of [
    "{bad",
    JSON.stringify({ expectedRevision: 0, humanSession: true }),
    JSON.stringify({ expectedRevision: 0, title: 123 }),
  ])
    assert.equal(
      (
        await fetch(`${server.url}/api/cards`, {
          method: "POST",
          headers,
          body,
        })
      ).status,
      400,
    );
  assert.equal(
    (
      await fetch(`${server.url}/api/cards`, {
        method: "POST",
        headers,
        body: "x".repeat(66000),
      })
    ).status,
    413,
  );
  assert.equal(
    (await fetch(`${server.url}/api/absent`, { headers })).status,
    404,
  );
  const result = await fetch(`${server.url}/api/cards`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const error = await result.json();
  assert.equal("stack" in error, false);
});
test("HTTP create list move and revision conflict", async (t) => {
  const { server, headers, repo } = await setup(t);
  const project = await (
    await fetch(`${server.url}/api/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: "First",
        root: repo(),
        expectedRevision: 0,
      }),
    })
  ).json();
  assert.ok(project.id);
  const card = await (
    await fetch(`${server.url}/api/cards`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: project.id,
        title: "Build board",
        expectedRevision: 0,
      }),
    })
  ).json();
  assert.ok(card.id);
  const moved = await fetch(`${server.url}/api/cards/${card.id}/move`, {
    method: "POST",
    headers,
    body: JSON.stringify({ column: "Ready", expectedRevision: 1 }),
  });
  assert.equal(moved.status, 200);
  const conflict = await fetch(`${server.url}/api/cards/${card.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ title: "Lost", expectedRevision: 1 }),
  });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).current.column, "Ready");
  assert.equal(
    (
      await (
        await fetch(`${server.url}/api/cards?projectId=${project.id}`, {
          headers,
        })
      ).json()
    ).length,
    1,
  );
});
test("HTTP rejects hostile Host header", async (t) => {
  const { server } = await setup(t);
  const url = new URL(server.url);
  const status = await new Promise<number>((resolve) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: url.port,
        path: "/health",
        headers: { Host: "hostile.example" },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode!);
      },
    );
    req.end();
  });
  assert.equal(status, 403);
});
test("occupiedPort fails clearly", async (t) => {
  const f = fixture(t);
  const occupied = createServer();
  await new Promise<void>((r) => occupied.listen(0, "127.0.0.1", r));
  t.after(() => new Promise<void>((r) => occupied.close(() => r())));
  const port = (occupied.address() as { port: number }).port;
  await assert.rejects(
    startServer(f.store, { dataDir: f.dir, port }),
    /address|port|EADDRINUSE/i,
  );
});
