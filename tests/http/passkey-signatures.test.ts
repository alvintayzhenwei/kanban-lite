import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";
import { openStore } from "../../src/storage/database.js";
import { createPasskeys } from "../../src/security/passkeys.js";

const origin = "http://localhost:4317";
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest();
function fixture() {
  const store = openStore(":memory:");
  const auth = createPasskeys(store, origin);
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const jwk = publicKey.export({ format: "jwk" });
  // COSE EC2 key: kty=2, alg=-7, crv=1, x and y each 32 bytes.
  const cose = new Uint8Array(
    Buffer.concat([
      Buffer.from([0xa5, 1, 2, 3, 0x26, 0x20, 1, 0x21, 0x58, 0x20]),
      Buffer.from(jwk.x!, "base64url"),
      Buffer.from([0x22, 0x58, 0x20]),
      Buffer.from(jwk.y!, "base64url"),
    ]),
  );
  const id = randomBytes(32).toString("base64url");
  auth.keys.insert({
    id,
    publicKey: cose,
    counter: 0,
    transports: ["internal"],
    createdAt: new Date().toISOString(),
    deviceType: "multiDevice",
    backedUp: true,
    registrationId: randomBytes(32).toString("hex"),
  });
  async function assertion(
    binding: string,
    flags = 0x1d,
    clientOrigin = origin,
    rpID = "localhost",
  ) {
    const options = await auth.authenticationOptions(binding);
    const client = Buffer.from(
      JSON.stringify({
        type: "webauthn.get",
        challenge: options.challenge,
        origin: clientOrigin,
      }),
    );
    // UP, UV, BE and BS set; synced credential counter remains zero.
    const data = Buffer.concat([
      hash(rpID),
      Buffer.from([flags]),
      Buffer.alloc(4),
    ]);
    return {
      id,
      rawId: id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: client.toString("base64url"),
        authenticatorData: data.toString("base64url"),
        signature: sign(
          "sha256",
          Buffer.concat([data, hash(client)]),
          privateKey,
        ).toString("base64url"),
        userHandle: Buffer.from(auth.keys.ownerId(), "hex").toString(
          "base64url",
        ),
      },
    };
  }
  return { store, auth, id, assertion };
}

test("signed synced-passkey assertions can retain a zero counter", async () => {
  const f = fixture();
  try {
    for (const binding of ["first", "second"]) {
      const response = await f.assertion(binding);
      await f.auth.verifyAuthentication(binding, response);
      assert.equal(f.auth.keys.get(f.id)!.counter, 0);
    }
  } finally {
    f.store.close();
  }
});

test("a successfully verified assertion cannot replay its consumed challenge", async () => {
  const f = fixture();
  try {
    const response = await f.assertion("replay");
    await f.auth.verifyAuthentication("replay", response);
    await assert.rejects(f.auth.verifyAuthentication("replay", response), {
      status: 401,
    });
  } finally {
    f.store.close();
  }
});

test("removal during asynchronous signature verification rejects authentication", async () => {
  const f = fixture();
  try {
    const response = await f.assertion("revoke");
    const verifying = f.auth.verifyAuthentication("revoke", response);
    // The verifier has taken its challenge and read the credential, then yielded.
    // These synchronous operations mirror the server DELETE handler.
    assert.equal(f.auth.keys.remove(f.id), true);
    f.auth.invalidate();
    await assert.rejects(verifying, { status: 401 });
    assert.equal(f.auth.keys.get(f.id), undefined);
  } finally {
    f.store.close();
  }
});
test("valid signatures without user verification or with wrong origin/RP are rejected", async () => {
  const f = fixture();
  try {
    for (const [binding, flags, clientOrigin, rp] of [
      ["no-uv", 0x19, origin, "localhost"],
      ["wrong-origin", 0x1d, "https://evil.example", "localhost"],
      ["wrong-rp", 0x1d, origin, "evil.example"],
    ] as const) {
      const response = await f.assertion(binding, flags, clientOrigin, rp);
      await assert.rejects(f.auth.verifyAuthentication(binding, response), {
        status: 401,
      });
    }
  } finally {
    f.store.close();
  }
});
test("expired signed challenge cannot authenticate", async () => {
  const f = fixture();
  const realNow = Date.now;
  try {
    const response = await f.assertion("expired");
    const now = realNow();
    Date.now = () => now + 300001;
    await assert.rejects(f.auth.verifyAuthentication("expired", response), {
      status: 401,
    });
  } finally {
    Date.now = realNow;
    f.store.close();
  }
});
