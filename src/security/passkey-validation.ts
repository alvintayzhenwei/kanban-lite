import { createPublicKey } from "node:crypto";
import { decodeCredentialPublicKey } from "@simplewebauthn/server/helpers";
export function validatePasskeyKey(value: Uint8Array): void {
  const key = decodeCredentialPublicKey(new Uint8Array(value)) as Map<
    number,
    unknown
  >;
  const x = key.get(-2),
    y = key.get(-3);
  if (
    key.get(1) !== 2 ||
    key.get(3) !== -7 ||
    key.get(-1) !== 1 ||
    !(x instanceof Uint8Array) ||
    x.length !== 32 ||
    !(y instanceof Uint8Array) ||
    y.length !== 32
  )
    throw new Error("Invalid passkey public key.");
  createPublicKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: Buffer.from(x).toString("base64url"),
      y: Buffer.from(y).toString("base64url"),
    },
  });
}
export function validatePasskeyTransports(
  value: unknown,
): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length > 10 ||
    !value.every(
      (t) =>
        typeof t === "string" &&
        [
          "ble",
          "cable",
          "hybrid",
          "internal",
          "nfc",
          "smart-card",
          "usb",
        ].includes(t),
    )
  )
    throw new Error("Invalid passkey transports.");
}
