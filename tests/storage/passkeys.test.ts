import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../../src/storage/database.js";
import { createPasskeyStore } from "../../src/security/passkey-store.js";
import { backupStore, restoreStore } from "../../src/storage/backup.js";
import { migrate, migrations } from "../../src/storage/migrations.js";
test("malformed public-key backup is rejected before replacing current database", async () => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-backup-"));
  const store = openStore(join(dir, "board.sqlite"));
  let closed = false;
  try {
    const keys = createPasskeyStore(store);
    store.db
      .prepare("INSERT INTO passkeys VALUES (?,?,?,?,?,?,?,?)")
      .run(
        "fixture-id",
        new Uint8Array([1, 2, 3]),
        0,
        "[]",
        new Date().toISOString(),
        "multiDevice",
        1,
        "a".repeat(64),
      );
    assert.ok(keys.ownerId());
    const out = join(dir, "bad.sqlite");
    await backupStore(store, out);
    store.close();
    closed = true;
    await assert.rejects(restoreStore(dir, out));
  } finally {
    if (!closed) store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("old backups migrate without losing board schema or requiring passkeys", async () => {
  const dir = mkdtempSync(join(tmpdir(), "passkey-old-"));
  const out = join(dir, "old.sqlite");
  const db = new DatabaseSync(out);
  try {
    migrate(db, migrations.slice(0, 1));
    db.close();
    await restoreStore(dir, out);
    const store = openStore(join(dir, "board.sqlite"));
    try {
      assert.equal(
        store.db.prepare("PRAGMA user_version").get()?.user_version,
        2,
      );
      assert.equal(createPasskeyStore(store).list().length, 0);
    } finally {
      store.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("credential identity and keys survive reopen and backup restore; invalid transports cannot be stored", async () => {
  const { generateKeyPairSync } = await import("node:crypto");
  const jwk = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  }).publicKey.export({ format: "jwk" });
  const publicKey = new Uint8Array(
    Buffer.concat([
      Buffer.from([0xa5, 1, 2, 3, 0x26, 0x20, 1, 0x21, 0x58, 0x20]),
      Buffer.from(jwk.x!, "base64url"),
      Buffer.from([0x22, 0x58, 0x20]),
      Buffer.from(jwk.y!, "base64url"),
    ]),
  );
  const dir = mkdtempSync(join(tmpdir(), "passkey-persist-"));
  let store = openStore(join(dir, "board.sqlite"));
  try {
    const keys = createPasskeyStore(store);
    const owner = keys.ownerId();
    const record = {
      id: "fixture-id",
      publicKey,
      counter: 0,
      transports: ["internal"],
      createdAt: new Date().toISOString(),
      deviceType: "multiDevice",
      backedUp: true,
      registrationId: "b".repeat(64),
    };
    assert.throws(() =>
      keys.insert({ ...record, transports: "invalid" as unknown as string[] }),
    );
    assert.equal(keys.list().length, 0);
    keys.insert(record);
    const backup = join(dir, "saved.sqlite");
    await backupStore(store, backup);
    store.close();
    await restoreStore(dir, backup);
    store = openStore(join(dir, "board.sqlite"));
    assert.equal(createPasskeyStore(store).ownerId(), owner);
    assert.deepEqual(
      createPasskeyStore(store).get("fixture-id")?.publicKey,
      publicKey,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
