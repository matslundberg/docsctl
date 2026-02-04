import { createServer } from "http";
import { createInterface } from "node:readline/promises";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import { URL, URLSearchParams } from "url";
import { loadCredentials } from "./credentials";

export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}

const TOKEN_ENV = "DOCSCTL_TOKEN_PATH";
const TOKEN_ENV_FALLBACK = "GDOCS_TOKEN_PATH";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

function resolveTokenPath(): string {
  const envPath = process.env[TOKEN_ENV] ?? process.env[TOKEN_ENV_FALLBACK];
  if (envPath) {
    return expandHome(envPath);
  }
  return expandHome("~/.config/docsctl/token.json");
}

async function readTokenFile(): Promise<TokenInfo | null> {
  const path = resolveTokenPath();
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.access_token) {
      return null;
    }
    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      expiryDate: typeof parsed.expiry_date === "number" ? parsed.expiry_date : undefined,
    };
  } catch {
    return null;
  }
}

async function writeTokenFile(token: TokenInfo): Promise<void> {
  const path = resolveTokenPath();
  await mkdir(dirname(path), { recursive: true });
  const stored: StoredToken = {
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
    expiry_date: token.expiryDate,
  };
  await writeFile(path, JSON.stringify(stored, null, 2), "utf-8");
}

function isExpired(token: TokenInfo): boolean {
  if (!token.expiryDate) {
    return false;
  }
  return Date.now() >= token.expiryDate - 60_000;
}

async function promptForCode(promptText: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(promptText);
  rl.close();
  return answer.trim();
}

function buildAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: DEFAULT_SCOPES.join(" "),
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function waitForAuthCode(redirectUri: string): Promise<string> {
  const url = new URL(redirectUri);
  const isLocalhost = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  const port = url.port ? Number(url.port) : null;

  if (!isLocalhost || !port) {
    return promptForCode("Paste the authorization code from the browser: ");
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? "", redirectUri);
      const code = requestUrl.searchParams.get("code");
      const error = requestUrl.searchParams.get("error");

      if (error) {
        res.statusCode = 400;
        res.end("Authorization failed. You can close this window.");
        server.close();
        reject(new Error(`Authorization error: ${error}`));
        return;
      }

      if (!code) {
        res.statusCode = 400;
        res.end("Missing authorization code. You can close this window.");
        return;
      }

      res.statusCode = 200;
      res.end("Authorization successful. You can close this window.");
      server.close();
      resolve(code);
    });

    server.on("error", async (err) => {
      server.close();
      console.warn(`Failed to start local auth listener (${String(err)}). Falling back to manual code entry.`);
      try {
        const code = await promptForCode("Paste the authorization code from the browser: ");
        resolve(code);
      } catch (inner) {
        reject(inner);
      }
    });

    server.listen(port, url.hostname, () => {
      console.log(`Waiting for auth redirect on ${redirectUri} ...`);
    });

    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for authorization code"));
    }, 5 * 60 * 1000);

    server.on("close", () => clearTimeout(timeout));
  });
}

async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<TokenInfo> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenInfo> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken,
    expiryDate: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  };
}

export async function login(): Promise<TokenInfo> {
  const creds = await loadCredentials();
  const authUrl = buildAuthUrl(creds.clientId, creds.redirectUri);

  console.log("Open this URL in your browser to authorize:");
  console.log(authUrl);
  if (!creds.redirectUri.startsWith("http://localhost") && !creds.redirectUri.startsWith("http://127.0.0.1")) {
    console.log("After authorizing, paste the code back into this terminal.");
  }

  const code = await waitForAuthCode(creds.redirectUri);
  const token = await exchangeCodeForToken(code, creds.clientId, creds.clientSecret, creds.redirectUri);
  await writeTokenFile(token);
  return token;
}

export async function getToken(): Promise<TokenInfo> {
  const token = await readTokenFile();
  if (!token) {
    throw new Error("Not logged in. Run `docsctl auth login` first.");
  }

  if (!isExpired(token)) {
    return token;
  }

  if (!token.refreshToken) {
    throw new Error("Token expired and no refresh token is available. Re-run `docsctl auth login`.");
  }

  const creds = await loadCredentials();
  const refreshed = await refreshAccessToken(token.refreshToken, creds.clientId, creds.clientSecret);
  await writeTokenFile(refreshed);
  return refreshed;
}

export async function logout(): Promise<void> {
  const path = resolveTokenPath();
  try {
    await unlink(path);
  } catch {
    // ignore missing file
  }
}

export async function getTokenStatus(): Promise<{ token: TokenInfo | null; tokenPath: string; expired: boolean }> {
  const token = await readTokenFile();
  return {
    token,
    tokenPath: resolveTokenPath(),
    expired: token ? isExpired(token) : false,
  };
}
