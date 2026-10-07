import { request, authenticate } from "./api.js";
function supported() {
  if (location.hostname !== "localhost")
    throw new Error(
      "Open http://localhost:" + location.port + " to use passkeys.",
    );
  if (!window.PublicKeyCredential || !window.SimpleWebAuthnBrowser)
    throw new Error(
      "This browser cannot use passkeys. Open Chrome or use CLI recovery.",
    );
}
async function ceremony(fn, optionsJSON) {
  try {
    return await fn({ optionsJSON });
  } catch (error) {
    if (error.name === "NotAllowedError" || error.name === "AbortError")
      throw new Error(
        "Passkey request canceled or timed out. Try again, or use CLI recovery.",
        { cause: error },
      );
    throw error;
  }
}
export async function registerPasskey() {
  supported();
  const optionsJSON = await request("/api/passkeys/register/options", {
    method: "POST",
    body: {},
  });
  const response = await ceremony(
    window.SimpleWebAuthnBrowser.startRegistration,
    optionsJSON,
  );
  await request("/api/passkeys/register/verify", {
    method: "POST",
    body: response,
  });
}
export async function signInWithPasskey() {
  supported();
  const optionsJSON = await request("/api/passkeys/authenticate/options", {
    method: "POST",
    body: {},
  });
  const response = await ceremony(
    window.SimpleWebAuthnBrowser.startAuthentication,
    optionsJSON,
  );
  await request("/api/passkeys/authenticate/verify", {
    method: "POST",
    body: response,
  });
  await authenticate();
}
