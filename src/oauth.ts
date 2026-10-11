import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const TOKEN_FILE = path.resolve(".yahoo-token.json");
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";

export type YahooToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  obtained_at: number;
};

export type AuthorizationRequest = {
  url: string;
  codeVerifier: string;
  state: string;
};

function credentials() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const redirectUri = process.env.YAHOO_REDIRECT_URI || "https://localhost:3000/callback";

  if (!clientId) {
    throw new Error("Missing YAHOO_CLIENT_ID. Copy .env.example to .env and fill it in.");
  }

  return { clientId, redirectUri };
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/**
 * Generate a PKCE verifier/challenge pair for Yahoo public clients.
 * The verifier must be 43-128 URL-safe characters; 64 random bytes encode to 86.
 */
export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function createAuthorizationRequest(): AuthorizationRequest {
  const { clientId, redirectUri } = credentials();
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = base64Url(randomBytes(32));

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    language: "en-us"
  });

  return {
    url: `${AUTH_URL}?${params.toString()}`,
    codeVerifier,
    state
  };
}

export async function exchangeAuthorizationCode(code: string, codeVerifier: string): Promise<YahooToken> {
  const { clientId, redirectUri } = credentials();
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
    code_verifier: codeVerifier
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Yahoo token exchange failed (${response.status}): ${await response.text()}`);
  }

  const raw = (await response.json()) as Omit<YahooToken, "obtained_at">;
  if (!raw.access_token || !raw.refresh_token || !raw.expires_in) {
    throw new Error("Yahoo token response was missing an access token, refresh token, or expiry.");
  }

  const token: YahooToken = { ...raw, obtained_at: Date.now() };
  await saveToken(token);
  return token;
}

async function saveToken(token: YahooToken): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });
}

async function loadToken(): Promise<YahooToken> {
  try {
    return JSON.parse(await fs.readFile(TOKEN_FILE, "utf8")) as YahooToken;
  } catch {
    throw new Error("No Yahoo token found. Run `npm run auth` first.");
  }
}

async function refreshToken(token: YahooToken): Promise<YahooToken> {
  const { clientId, redirectUri } = credentials();
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    redirect_uri: redirectUri,
    refresh_token: token.refresh_token
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Yahoo token refresh failed (${response.status}): ${await response.text()}`);
  }

  const raw = (await response.json()) as Partial<YahooToken> & Pick<YahooToken, "access_token" | "expires_in" | "token_type">;
  if (!raw.access_token || !raw.expires_in) {
    throw new Error("Yahoo token refresh response was missing an access token or expiry.");
  }

  const refreshed: YahooToken = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || token.refresh_token,
    expires_in: raw.expires_in,
    token_type: raw.token_type || token.token_type || "bearer",
    obtained_at: Date.now()
  };

  await saveToken(refreshed);
  return refreshed;
}

export async function getAccessToken(): Promise<string> {
  let token = await loadToken();
  const expiresAt = token.obtained_at + token.expires_in * 1000;
  if (Date.now() > expiresAt - 60_000) {
    token = await refreshToken(token);
  }
  return token.access_token;
}
