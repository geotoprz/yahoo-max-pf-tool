import "dotenv/config";
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

function credentials() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  const redirectUri = process.env.YAHOO_REDIRECT_URI || "oob";

  if (!clientId || !clientSecret) {
    throw new Error("Missing YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET. Copy .env.example to .env and fill them in.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function authorizationUrl(): string {
  const { clientId, redirectUri } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    language: "en-us"
  });
  return `${AUTH_URL}?${params.toString()}`;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeAuthorizationCode(code: string): Promise<YahooToken> {
  const { clientId, clientSecret, redirectUri } = credentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Yahoo token exchange failed (${response.status}): ${await response.text()}`);
  }

  const raw = (await response.json()) as Omit<YahooToken, "obtained_at">;
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
  const { clientId, clientSecret, redirectUri } = credentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    redirect_uri: redirectUri,
    refresh_token: token.refresh_token
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(clientId, clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Yahoo token refresh failed (${response.status}): ${await response.text()}`);
  }

  const raw = (await response.json()) as Partial<YahooToken> & Pick<YahooToken, "access_token" | "expires_in" | "token_type">;
  const refreshed: YahooToken = {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token || token.refresh_token,
    expires_in: raw.expires_in,
    token_type: raw.token_type,
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
