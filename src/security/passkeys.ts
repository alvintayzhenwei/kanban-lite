import { randomBytes } from "node:crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import type { Store } from "../storage/database.js";
import { createPasskeyStore } from "./passkey-store.js";
import { HttpError } from "./session.js";
export function createPasskeys(store: Store, origin: string) {
  const keys = createPasskeyStore(store);
  const pending = new Map<
    string,
    { challenge: string; expires: number; epoch: number }
  >();
  const rates = new Map<string, { count: number; expires: number }>();
  let epoch = 0;
  function limit(binding: string) {
    const now = Date.now();
    for (const [key, value] of rates)
      if (value.expires <= now) rates.delete(key);
    for (const key of ["global", binding]) {
      const r = rates.get(key) ?? { count: 0, expires: now + 60000 };
      if (++r.count > (key === "global" ? 200 : 20))
        throw new HttpError(
          429,
          "Too many passkey requests. Retry in one minute.",
        );
      rates.set(key, r);
    }
  }
  function save(key: string, challenge: string) {
    for (const [k, v] of pending)
      if (v.expires <= Date.now()) pending.delete(k);
    if (pending.size >= 100 && !pending.has(key))
      throw new HttpError(429, "Too many pending passkey requests.");
    pending.set(key, { challenge, expires: Date.now() + 300000, epoch });
  }
  function take(key: string) {
    const p = pending.get(key);
    pending.delete(key);
    if (!p || p.expires <= Date.now() || p.epoch !== epoch)
      throw new HttpError(401, "Passkey request expired. Try again.");
    return p;
  }
  return {
    keys,
    invalidate() {
      epoch++;
      pending.clear();
    },
    async registrationOptions(binding: string) {
      limit(binding);
      if (keys.list().length >= 20)
        throw new HttpError(
          400,
          "Remove an existing passkey before adding another.",
        );
      const options = await generateRegistrationOptions({
        supportedAlgorithmIDs: [-7],
        rpName: "Kanban Lite",
        rpID: "localhost",
        userName: "Board owner",
        userID: Buffer.from(keys.ownerId(), "hex"),
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        excludeCredentials: keys
          .list()
          .map((k) => ({ id: k.id, transports: k.transports })),
      });
      save("register:" + binding, options.challenge);
      return options;
    },
    async verifyRegistration(
      binding: string,
      response: unknown,
      validSession: () => boolean,
    ) {
      limit(binding);
      const p = take("register:" + binding);
      try {
        const result = await verifyRegistrationResponse({
          response: response as RegistrationResponseJSON,
          expectedChallenge: p.challenge,
          expectedOrigin: origin,
          expectedRPID: "localhost",
          requireUserVerification: true,
        });
        if (
          !result.verified ||
          !result.registrationInfo ||
          p.epoch !== epoch ||
          !validSession() ||
          keys.list().length >= 20
        )
          throw new Error("Invalid enrollment");
        const info = result.registrationInfo;
        keys.insert({
          id: info.credential.id,
          publicKey: info.credential.publicKey,
          counter: info.credential.counter,
          transports: info.credential.transports ?? [],
          createdAt: new Date().toISOString(),
          deviceType: info.credentialDeviceType,
          backedUp: info.credentialBackedUp,
          registrationId: randomBytes(32).toString("hex"),
        });
      } catch {
        throw new HttpError(
          401,
          "Passkey enrollment failed. Start again from a fresh login.",
        );
      }
    },
    async authenticationOptions(binding: string) {
      limit(binding);
      const options = await generateAuthenticationOptions({
        rpID: "localhost",
        userVerification: "required",
      });
      save("authenticate:" + binding, options.challenge);
      return options;
    },
    async verifyAuthentication(binding: string, response: unknown) {
      limit(binding);
      const p = take("authenticate:" + binding);
      try {
        const r = response as AuthenticationResponseJSON;
        const credential = keys.get(r.id);
        if (
          !credential ||
          r.response.userHandle !==
            Buffer.from(keys.ownerId(), "hex").toString("base64url")
        )
          throw new Error("Unknown credential");
        const result = await verifyAuthenticationResponse({
          response: r,
          expectedChallenge: p.challenge,
          expectedOrigin: origin,
          expectedRPID: "localhost",
          credential,
          requireUserVerification: true,
        });
        if (
          !result.verified ||
          p.epoch !== epoch ||
          !keys.updateCounter(
            credential.id,
            credential.registrationId,
            credential.counter,
            result.authenticationInfo.newCounter,
          )
        )
          throw new Error("Credential changed");
      } catch {
        throw new HttpError(
          401,
          "Passkey sign-in failed. Try again or use CLI recovery.",
        );
      }
    },
  };
}
