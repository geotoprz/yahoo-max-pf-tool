import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createPkcePair } from "./oauth.js";

test("creates a valid S256 PKCE verifier/challenge pair", () => {
  const { codeVerifier, codeChallenge } = createPkcePair();

  assert.ok(codeVerifier.length >= 43 && codeVerifier.length <= 128);
  assert.match(codeVerifier, /^[A-Za-z0-9_-]+$/);

  const expected = createHash("sha256").update(codeVerifier).digest("base64url");
  assert.equal(codeChallenge, expected);
  assert.match(codeChallenge, /^[A-Za-z0-9_-]+$/);
});
