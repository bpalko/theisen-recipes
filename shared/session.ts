export const SESSION_COOKIE = "tr_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + "=".repeat(padLength));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (x: BufferSource, y: BufferSource) => boolean;
  };
  if (typeof subtle.timingSafeEqual === "function" && a.length === b.length) {
    return subtle.timingSafeEqual(a as BufferSource, b as BufferSource);
  }
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

/** Compare secrets without leaking length via timing. Always hashes first. */
export async function secretsEqual(provided: string, expected: string): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    sha256Bytes(provided),
    sha256Bytes(expected),
  ]);
  return timingSafeEqual(providedHash, expectedHash);
}

async function hmacSign(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return new Uint8Array(signature);
}

export async function createSessionToken(
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + ttlSeconds;
  const payload = `v1.${issuedAt}.${expiresAt}`;
  const signature = await hmacSign(secret, payload);
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 4) return false;
  const [version, issuedRaw, expiresRaw, signaturePart] = parts;
  if (version !== "v1") return false;
  const issuedAt = Number(issuedRaw);
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(issuedAt) || !Number.isInteger(expiresAt)) return false;
  if (expiresAt * 1000 <= now) return false;
  if (issuedAt > Math.floor(now / 1000) + 60) return false;

  const payload = `${version}.${issuedRaw}.${expiresRaw}`;
  const expected = await hmacSign(secret, payload);
  const provided = base64UrlToBytes(signaturePart);
  if (!provided) return false;
  return timingSafeEqual(expected, provided);
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

export function sessionCookieHeader(token: string, requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === "https:";
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function readValidSession(
  request: Request,
  env: { BOOKSHELF_PASSWORD?: string; SESSION_SECRET?: string },
): Promise<boolean> {
  const secret = env.SESSION_SECRET;
  if (!secret || !env.BOOKSHELF_PASSWORD) return false;
  const token = parseCookies(request.headers.get("Cookie"))[SESSION_COOKIE];
  if (!token) return false;
  return verifySessionToken(secret, token);
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/")) return "/";
  return value;
}
