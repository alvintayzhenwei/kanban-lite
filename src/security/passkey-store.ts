import {
  validatePasskeyKey,
  validatePasskeyTransports,
} from "./passkey-validation.js";
import { randomBytes } from "node:crypto";
import type { Store } from "../storage/database.js";
export interface PasskeyRecord {
  id: string;
  publicKey: Uint8Array<ArrayBuffer>;
  counter: number;
  transports: string[];
  createdAt: string;
  deviceType: string;
  backedUp: boolean;
  registrationId: string;
}
export function createPasskeyStore(store: Store) {
  store.db
    .prepare("INSERT OR IGNORE INTO passkey_owner VALUES (1,?)")
    .run(randomBytes(32).toString("hex"));
  function get(id: string): PasskeyRecord | undefined {
    const r = store.db.prepare("SELECT * FROM passkeys WHERE id=?").get(id);
    if (!r) return undefined;
    return {
      id: String(r.id),
      publicKey: new Uint8Array(r.public_key as Uint8Array),
      counter: Number(r.counter),
      transports: JSON.parse(String(r.transports)),
      createdAt: String(r.created_at),
      deviceType: String(r.device_type),
      backedUp: r.backed_up === 1,
      registrationId: String(r.registration_id),
    };
  }
  return {
    ownerId: () =>
      String(
        store.db
          .prepare("SELECT user_id FROM passkey_owner WHERE singleton=1")
          .get()!.user_id,
      ),
    get,
    list: () =>
      store.db
        .prepare("SELECT id FROM passkeys ORDER BY created_at")
        .all()
        .map((r) => get(String(r.id))!),
    insert: (r: PasskeyRecord) => {
      validatePasskeyKey(r.publicKey);
      validatePasskeyTransports(r.transports);
      store.db
        .prepare("INSERT INTO passkeys VALUES (?,?,?,?,?,?,?,?)")
        .run(
          r.id,
          r.publicKey,
          r.counter,
          JSON.stringify(r.transports),
          r.createdAt,
          r.deviceType,
          r.backedUp ? 1 : 0,
          r.registrationId,
        );
    },
    updateCounter: (
      id: string,
      registrationId: string,
      expected: number,
      next: number,
    ) =>
      Number(
        store.db
          .prepare(
            "UPDATE passkeys SET counter=? WHERE id=? AND registration_id=? AND counter=?",
          )
          .run(next, id, registrationId, expected).changes,
      ) === 1,
    remove: (id: string) =>
      Number(
        store.db.prepare("DELETE FROM passkeys WHERE id=?").run(id).changes,
      ) === 1,
  };
}
