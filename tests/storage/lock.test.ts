import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { acquireLock } from "../../src/storage/lock.js";
test("stale lock recovery never admits two live owners", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-lock-"));
  const children: ReturnType<typeof spawn>[] = [];
  const path = new URL("../../src/storage/lock.js", import.meta.url).href;
  const source = `import {acquireLock} from ${JSON.stringify(path)}; import {existsSync,writeFileSync} from 'node:fs'; const [dir,label]=process.argv.slice(1); const original=process.kill.bind(process); process.kill=(pid,sig)=>{if(pid===2147483647){writeFileSync(dir+'/'+label+'-ready','');while(!existsSync(dir+'/'+label+'-go'))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5);}return original(pid,sig);};try{acquireLock(dir);writeFileSync(dir+'/'+label+'-acquired',String(process.pid));setInterval(()=>{},1000);}catch{writeFileSync(dir+'/'+label+'-rejected','');}`;
  async function wait(files: string[]) {
    const end = Date.now() + 4000;
    while (Date.now() < end) {
      if (files.some((f) => existsSync(join(dir, f)))) return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("Timed out: " + files.join(","));
  }
  try {
    mkdirSync(join(dir, "service.lock"));
    writeFileSync(
      join(dir, "service.lock", "owner.json"),
      JSON.stringify({ pid: 2147483647 }),
    );
    children.push(
      spawn(process.execPath, ["--input-type=module", "-e", source, dir, "A"], {
        stdio: "ignore",
      }),
    );
    await wait(["A-ready"]);
    children.push(
      spawn(process.execPath, ["--input-type=module", "-e", source, dir, "B"], {
        stdio: "ignore",
      }),
    );
    await wait(["B-ready", "B-rejected"]);
    writeFileSync(join(dir, "A-go"), "");
    await wait(["A-acquired"]);
    writeFileSync(join(dir, "B-go"), "");
    await wait(["B-acquired", "B-rejected"]);
    assert.equal(
      existsSync(join(dir, "B-acquired")),
      false,
      "A second live owner must not acquire the lock",
    );
    assert.equal(existsSync(join(dir, "B-rejected")), true);
  } finally {
    await Promise.all(
      children.map(async (child) => {
        if (child.exitCode === null) {
          child.kill();
          await new Promise((r) => child.once("exit", r));
        }
      }),
    );
    rmSync(dir, { recursive: true, force: true });
  }
});
test("lock release does not delete a replacement owner", () => {
  const dir = mkdtempSync(join(tmpdir(), "kanban-lock-"));
  try {
    const lock = acquireLock(dir);
    const path = join(dir, "service.lock", "owner.json");
    const owner = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(
      path,
      JSON.stringify({ ...owner, token: "replacement-owner" }),
    );
    lock.release();
    assert.equal(existsSync(path), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
