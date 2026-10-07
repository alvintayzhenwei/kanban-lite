import {
  validatePasskeyKey,
  validatePasskeyTransports,
} from "../security/passkey-validation.js";
import type { DatabaseSync } from "node:sqlite";
import { isAbsolute } from "node:path";
import { columns, phases } from "../domain/types.js";
type RecordValue = Record<string, unknown>;
function check(condition: unknown): asserts condition {
  if (!condition) throw new Error("Invalid backup record.");
}
function record(value: unknown): RecordValue {
  check(value && typeof value === "object" && !Array.isArray(value));
  return value as RecordValue;
}
function string(value: unknown, max: number, blank = false): boolean {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (blank || Boolean(value.trim()))
  );
}
function integer(value: unknown, min = 1): boolean {
  return Number.isSafeInteger(value) && Number(value) >= min;
}
function date(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function actor(value: unknown): void {
  const a = record(value);
  check(
    ["browser", "claude", "codex"].includes(String(a.client)) &&
      typeof a.humanSession === "boolean",
  );
}
function parse(value: unknown): RecordValue {
  try {
    return record(JSON.parse(String(value)));
  } catch (error) {
    throw new Error("Invalid backup JSON record.", { cause: error });
  }
}
export function validateRecords(db: DatabaseSync): void {
  if (Number(db.prepare("PRAGMA user_version").get()?.user_version) === 2) {
    const owners = db
      .prepare("SELECT singleton,user_id FROM passkey_owner")
      .all();
    check(owners.length <= 1);
    for (const owner of owners)
      check(
        owner.singleton === 1 && /^[a-f0-9]{64}$/.test(String(owner.user_id)),
      );
    for (const key of db.prepare("SELECT * FROM passkeys").all()) {
      check(
        owners.length === 1 &&
          typeof key.id === "string" &&
          /^[A-Za-z0-9_-]{1,2048}$/.test(key.id),
      );
      check(
        key.public_key instanceof Uint8Array &&
          key.public_key.length > 0 &&
          key.public_key.length <= 4096,
      );
      validatePasskeyKey(key.public_key as Uint8Array);
      check(integer(key.counter, 0) && date(key.created_at));
      check(
        ["singleDevice", "multiDevice"].includes(String(key.device_type)) &&
          [0, 1].includes(Number(key.backed_up)),
      );
      check(
        typeof key.registration_id === "string" &&
          /^[a-f0-9]{64}$/.test(key.registration_id),
      );
      const transports: unknown = JSON.parse(String(key.transports));
      validatePasskeyTransports(transports);
    }
  }

  const projects = new Map<string, number>();
  for (const p of db
    .prepare("SELECT id,name,root,revision,created_at,wip_limit FROM projects")
    .all()) {
    check(
      string(p.id, 100) &&
        string(p.name, 200) &&
        string(p.root, 4096) &&
        isAbsolute(String(p.root)) &&
        integer(p.revision) &&
        date(p.created_at) &&
        (p.wip_limit === null || integer(p.wip_limit)),
    );
    projects.set(String(p.id), Number(p.revision));
  }
  const cards = new Map<string, { workRevision: number; revision: number }>();
  for (const row of db
    .prepare("SELECT id,project_id,data,revision,deleted FROM cards")
    .all()) {
    const c = parse(row.data);
    check(
      string(c.id, 100) &&
        c.id === row.id &&
        c.projectId === row.project_id &&
        projects.has(String(c.projectId)),
    );
    check(
      integer(c.revision) &&
        integer(c.workRevision) &&
        Number(c.workRevision) <= Number(c.revision) &&
        integer(row.revision) &&
        [0, 1].includes(Number(row.deleted)),
    );
    check(
      Number(row.revision) ===
        Number(c.revision) + (Number(row.deleted) === 1 ? 1 : 0),
    );
    check(
      string(c.title, 200) &&
        string(c.description, 20000, true) &&
        columns.includes(c.column as (typeof columns)[number]) &&
        phases.includes(c.phase as (typeof phases)[number]) &&
        ["low", "normal", "high", "urgent"].includes(String(c.priority)),
    );
    check(
      (c.owner === null || string(c.owner, 200)) &&
        (c.blockedReason === null || string(c.blockedReason, 2000)) &&
        date(c.createdAt) &&
        date(c.updatedAt),
    );
    check(Array.isArray(c.artifacts) && c.artifacts.length <= 100);
    for (const value of c.artifacts) {
      const a = record(value);
      check(
        string(a.path, 4096) &&
          string(a.label, 200) &&
          !isAbsolute(String(a.path)) &&
          !String(a.path).includes("\\") &&
          !String(a.path).split("/").includes(".."),
      );
    }
    if (c.evidence !== undefined) check(Array.isArray(c.evidence));
    cards.set(String(c.id), {
      workRevision: Number(c.workRevision),
      revision: Number(row.revision),
    });
  }
  for (const row of db.prepare("SELECT id,card_id,data FROM evidence").all()) {
    const e = parse(row.data),
      card = cards.get(String(row.card_id));
    check(
      card &&
        integer(row.id) &&
        integer(e.workRevision) &&
        Number(e.workRevision) <= card.workRevision &&
        string(e.name, 200) &&
        string(e.summary, 4000) &&
        ["passed", "failed"].includes(String(e.outcome)) &&
        date(e.at),
    );
    if (e.sourceRevision !== undefined) check(string(e.sourceRevision, 200));
    actor(e.actor);
  }
  for (const row of db.prepare("SELECT id,entity_id,data FROM events").all()) {
    const e = parse(row.data),
      revision =
        cards.get(String(row.entity_id))?.revision ??
        projects.get(String(row.entity_id));
    check(
      revision !== undefined &&
        e.entityId === row.entity_id &&
        integer(row.id) &&
        string(e.action, 200) &&
        integer(e.beforeRevision, 0) &&
        integer(e.afterRevision) &&
        Number(e.afterRevision) > Number(e.beforeRevision) &&
        Number(e.afterRevision) <= revision &&
        date(e.at),
    );
    if (e.reason !== undefined) check(string(e.reason, 2000));
    actor(e.actor);
  }
}
