// The e2e accounts' passkeys. Foxing has no passwords, so every e2e account signs in with a
// passkey whose private key is the E2E_PASSKEY_PRIVATE_KEY secret (P-256, PKCS8, base64). One
// key serves every account; each account's credential id is derived from its email.
//
// The browser specs hand the key to Chromium's virtual authenticator and click "Sign in with a
// passkey", as a reader does. The seed scripts, which have no browser, sign the same assertion
// themselves (signInWithPasskey). scripts/seed-e2e-passkeys.mjs makes the key and stores the
// public halves in D1.
import { createHash, createPrivateKey, createPublicKey, type KeyObject, sign } from "node:crypto";
import type { Page } from "@playwright/test";

const b64url = (buf: Buffer) => buf.toString("base64url");
const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest();

export function privateKey(): KeyObject {
  const pkcs8 = process.env.E2E_PASSKEY_PRIVATE_KEY;
  if (!pkcs8) {
    throw new Error(
      "E2E_PASSKEY_PRIVATE_KEY is required for the signed-in specs: the e2e accounts' passkey " +
        "(see scripts/seed-e2e-passkeys.mjs). Set it, or run only the public project: " +
        "`playwright test --project=public`.",
    );
  }
  return createPrivateKey({ key: Buffer.from(pkcs8, "base64"), format: "der", type: "pkcs8" });
}

function credentialIdFor(email: string): Buffer {
  return sha256(`foxing-e2e:${email.toLowerCase()}`);
}

// The public key as COSE (an EC2 P-256 map), base64, which is how the passkey table stores it.
function cosePublicKey(key: KeyObject): string {
  const jwk = createPublicKey(key).export({ format: "jwk" });
  const x = Buffer.from(String(jwk.x), "base64url");
  const y = Buffer.from(String(jwk.y), "base64url");
  const cbor = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);
  return cbor.toString("base64");
}

// The SQL that gives the account with this email its e2e passkey (replacing an earlier one).
export function passkeyRowSql(email: string, key: KeyObject): string {
  const credentialId = b64url(credentialIdFor(email));
  return (
    "INSERT OR REPLACE INTO passkey (id, name, public_key, user_id, credential_id, counter, device_type, backed_up, transports, created_at) " +
    `SELECT 'e2e-${credentialId.slice(0, 16)}', 'E2E passkey', '${cosePublicKey(key)}', id, '${credentialId}', 0, 'singleDevice', 0, 'internal', unixepoch()*1000 ` +
    `FROM user WHERE email = '${email}';`
  );
}

// Signature counters only go up. Seconds since 1970 are always ahead of the last sign-in,
// whether the script or the browser's authenticator made it.
const counter = () => Math.floor(Date.now() / 1000);

// Gives the page a virtual authenticator holding the account's passkey. Call before /login.
export async function addPasskey(
  page: Page,
  email: string,
  baseURL: string,
  key: KeyObject = privateKey(),
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const pkcs8 = key.export({ format: "der", type: "pkcs8" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: credentialIdFor(email).toString("base64"),
      isResidentCredential: true,
      rpId: new URL(baseURL).hostname,
      privateKey: pkcs8.toString("base64"),
      userHandle: Buffer.from(email).toString("base64"),
      signCount: counter(),
    },
  });
}

// Signs in through the passkey endpoints without a browser; returns the session cookie.
export async function signInWithPasskey(baseURL: string, email: string): Promise<string> {
  const origin = new URL(baseURL).origin;
  const rpId = new URL(baseURL).hostname;
  const options = await fetch(new URL("/api/auth/passkey/generate-authenticate-options", baseURL), {
    headers: { origin },
  });
  if (!options.ok) throw new Error(`Passkey options returned ${options.status}`);
  const { challenge } = (await options.json()) as { challenge: string };
  const challengeCookie = options.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
  );
  const count = Buffer.alloc(4);
  count.writeUInt32BE(counter());
  // rpIdHash, flags (user present and verified), signature counter.
  const authenticatorData = Buffer.concat([sha256(rpId), Buffer.from([0x05]), count]);
  const signature = sign(
    "sha256",
    Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
    privateKey(),
  );
  const id = b64url(credentialIdFor(email));

  const verify = await fetch(new URL("/api/auth/passkey/verify-authentication", baseURL), {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie: challengeCookie },
    body: JSON.stringify({
      response: {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(authenticatorData),
          signature: b64url(signature),
          userHandle: b64url(Buffer.from(email)),
        },
        clientExtensionResults: {},
      },
    }),
  });
  if (!verify.ok) throw new Error(`Passkey sign-in for ${email} returned ${verify.status}`);
  return verify.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

// The visible sign-in, shared by every setup: the passkey button, then an authed page.
//
// It runs in a tab of its own. On the live site, a tab that has held Chromium's virtual
// authenticator stops drawing frames once signed in (timers run, requestAnimationFrame never
// does, even after a reload), so Playwright's next click there waits forever for the element
// to settle. Another tab in the same context, holding the same session, draws normally.
export async function signInThroughLogin(page: Page, email: string, baseURL: string) {
  const signIn = await page.context().newPage();
  await addPasskey(signIn, email, baseURL);
  await signIn.goto("/login");
  // The page also offers the passkey to the email field's autofill, and Chromium's virtual
  // authenticator answers that at once. Click only if the autofill has not signed in, so one
  // sign-in runs.
  const leftLogin = () => !new URL(signIn.url()).pathname.startsWith("/login");
  await signIn
    .waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 3_000 })
    .catch(() => {});
  if (!leftLogin()) {
    await signIn.getByRole("button", { name: /sign in with a passkey/i }).click();
    await signIn.waitForURL((url) => !url.pathname.startsWith("/login"));
  }
  const landed = signIn.url();
  await signIn.close();
  await page.goto(landed);
  await page.waitForLoadState("networkidle");
}
