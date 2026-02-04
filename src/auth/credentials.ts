import { readFile, stat } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

export interface OAuthClientCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const CREDENTIALS_ENV = "GDOCS_CREDENTIALS_PATH";
const REDIRECT_URI_ENV = "GDOCS_REDIRECT_URI";

function expandHome(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return path;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveCredentialsPath(): Promise<string> {
  const envPath = process.env[CREDENTIALS_ENV];
  if (envPath) {
    const expanded = expandHome(envPath);
    const candidate = (await isDirectory(expanded)) ? join(expanded, "credentials.json") : expanded;
    if (!(await pathExists(candidate))) {
      throw new Error(`Credentials file not found at ${candidate}`);
    }
    return candidate;
  }

  const candidates = [
    expandHome("~/.gdocs/credentials.json"),
    expandHome("~/.config/gdocs/credentials.json"),
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Credentials file not found. Set GDOCS_CREDENTIALS_PATH to a credentials.json file or directory."
  );
}

function pickRedirectUri(redirectUris: string[]): string {
  const override = process.env[REDIRECT_URI_ENV];
  if (override) {
    return override;
  }

  const local = redirectUris.find(
    (uri) => uri.startsWith("http://localhost") || uri.startsWith("http://127.0.0.1")
  );
  return local ?? redirectUris[0] ?? "";
}

export async function loadCredentials(): Promise<OAuthClientCredentials> {
  const path = await resolveCredentialsPath();
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const root = (parsed.installed ?? parsed.web ?? parsed) as Record<string, unknown>;

  const clientId = root.client_id as string | undefined;
  const clientSecret = root.client_secret as string | undefined;
  const redirectUris = (root.redirect_uris as string[] | undefined) ?? [];
  const redirectUri = pickRedirectUri(redirectUris);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      `Invalid credentials.json at ${path}: missing client_id, client_secret, or redirect_uris`
    );
  }

  return { clientId, clientSecret, redirectUri };
}
