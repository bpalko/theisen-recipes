const JWKS_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;
const encoder = new TextEncoder();

export const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
export const ACCESS_COOKIE = "CF_Authorization";

type AccessEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
};

type JwtHeader = {
  alg?: unknown;
  kid?: unknown;
  typ?: unknown;
};

type JwtPayload = {
  aud?: unknown;
  exp?: unknown;
  iss?: unknown;
  nbf?: unknown;
};

type Jwk = JsonWebKey & { kid?: string };

type Jwks = {
  keys?: Jwk[];
};

type JwksCache = {
  url: string;
  keys: Jwk[];
  expiresAt: number;
};

let jwksCache: JwksCache | null = null;

export type VerifyAccessOptions = {
  now?: number;
  fetch?: typeof fetch;
};

export function isAccessConfigured(
  env: AccessEnv,
): env is { CF_ACCESS_TEAM_DOMAIN: string; CF_ACCESS_AUD: string } {
  return Boolean(env.CF_ACCESS_TEAM_DOMAIN?.trim() && env.CF_ACCESS_AUD?.trim());
}

/** Normalize a team domain or URL to `https://<team>.cloudflareaccess.com`. */
export function accessIssuer(teamDomain: string): string {
  let value = teamDomain.trim();
  if (!value) return "";
  value = value.replace(/\/+$/, "");
  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) return `https://${value.slice("http://".length)}`;
  if (value.includes(".")) return `https://${value}`;
  return `https://${value}.cloudflareaccess.com`;
}

export function accessCertsUrl(teamDomain: string): string {
  return `${accessIssuer(teamDomain)}/cdn-cgi/access/certs`;
}

export function clearAccessJwksCache(): void {
  jwksCache = null;
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

export function readAccessToken(request: Request): string | null {
  const header = request.headers.get(ACCESS_JWT_HEADER)?.trim();
  if (header) return header;
  const cookie = parseCookies(request.headers.get("Cookie"))[ACCESS_COOKIE]?.trim();
  return cookie || null;
}

export async function verifyAccessJwt(
  token: string,
  env: { CF_ACCESS_TEAM_DOMAIN: string; CF_ACCESS_AUD: string },
  options: VerifyAccessOptions = {},
): Promise<boolean> {
  const issuer = accessIssuer(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = env.CF_ACCESS_AUD.trim();
  if (!issuer || !audience) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJwtJson<JwtHeader>(headerPart);
  if (!header || header.alg !== "RS256") return false;

  const signature = base64UrlToBytes(signaturePart);
  if (!signature) return false;

  const keys = await loadJwks(accessCertsUrl(env.CF_ACCESS_TEAM_DOMAIN), options.fetch);
  if (!keys) return false;

  const kid = typeof header.kid === "string" ? header.kid : undefined;
  const candidates = kid ? keys.filter((key) => key.kid === kid) : keys;
  const rsaKeys = (candidates.length > 0 ? candidates : keys).filter(
    (key) => key.kty === "RSA" && key.n && key.e,
  );
  if (rsaKeys.length === 0) return false;

  const signingInput = encoder.encode(`${headerPart}.${payloadPart}`);
  let signatureOk = false;
  for (const jwk of rsaKeys) {
    try {
      const key = await crypto.subtle.importKey(
        "jwk",
        {
          kty: "RSA",
          n: jwk.n,
          e: jwk.e,
          alg: "RS256",
          ext: true,
        },
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      );
      if (
        await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5",
          key,
          toArrayBuffer(signature),
          toArrayBuffer(signingInput),
        )
      ) {
        signatureOk = true;
        break;
      }
    } catch {
      // Try the next JWKS key.
    }
  }
  if (!signatureOk) return false;

  const payload = decodeJwtJson<JwtPayload>(payloadPart);
  if (!payload) return false;

  const now = options.now ?? Date.now();
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= now - CLOCK_SKEW_MS) return false;
  if (typeof payload.nbf === "number" && payload.nbf * 1000 > now + CLOCK_SKEW_MS) return false;
  if (payload.iss !== issuer) return false;
  if (!audienceMatches(payload.aud, audience)) return false;
  return true;
}

function audienceMatches(aud: unknown, expected: string): boolean {
  if (typeof aud === "string") return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

function decodeJwtJson<T>(part: string): T | null {
  const bytes = base64UrlToBytes(part);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
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

async function loadJwks(
  url: string,
  fetchImpl: typeof fetch | undefined,
): Promise<Jwk[] | null> {
  const now = Date.now();
  if (jwksCache && jwksCache.url === url && jwksCache.expiresAt > now) {
    return jwksCache.keys;
  }

  const fetchFn = fetchImpl ?? globalThis.fetch.bind(globalThis);
  try {
    const response = await fetchFn(url);
    if (!response.ok) return null;
    const body = (await response.json()) as Jwks;
    const keys = Array.isArray(body.keys) ? body.keys : [];
    jwksCache = { url, keys, expiresAt: now + JWKS_TTL_MS };
    return keys;
  } catch {
    return null;
  }
}
