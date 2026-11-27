import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  accessCertsUrl,
  accessIssuer,
  clearAccessJwksCache,
  isAccessConfigured,
  parseCookies,
  readAccessToken,
  verifyAccessJwt,
} from "../shared/access.ts";
import { onRequest } from "../functions/_middleware.ts";

const TEAM_DOMAIN = "test-team.cloudflareaccess.com";
const ISSUER = "https://test-team.cloudflareaccess.com";
const AUD = "test-application-aud";
const KID = "test-key-1";

const encoder = new TextEncoder();

let privateKey: CryptoKey;
let publicJwk: JsonWebKey & { kid: string };

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function jsonToBase64Url(value: unknown): string {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

async function signJwt(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "RS256", kid: KID, typ: "JWT" },
  key = privateKey,
): Promise<string> {
  const headerPart = jsonToBase64Url(header);
  const payloadPart = jsonToBase64Url(payload);
  const data = encoder.encode(`${headerPart}.${payloadPart}`);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data));
  return `${headerPart}.${payloadPart}.${bytesToBase64Url(signature)}`;
}

function validClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    aud: AUD,
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "family@example.com",
    ...overrides,
  };
}

function jwksFetch(keys: JsonWebKey[] = [publicJwk]): typeof fetch {
  return async (input) => {
    const url = String(input);
    expect(url).toBe(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

type TestEnv = {
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  ASSETS: { fetch: (request: Request | URL | string) => Promise<Response> };
};

async function runMiddleware(options: {
  url?: string;
  headers?: HeadersInit;
  env?: Partial<Omit<TestEnv, "ASSETS">>;
  next?: Response;
  assets?: Response;
  assetFetch?: (request: Request | URL | string) => Promise<Response>;
}) {
  let assetsHit = 0;
  const assetsResponse = options.assets ?? new Response("<!doctype html>index", { status: 200 });
  const env: TestEnv = {
    ASSETS: {
      fetch: async (request) => {
        assetsHit += 1;
        if (options.assetFetch) return options.assetFetch(request);
        return assetsResponse;
      },
    },
    ...options.env,
  };
  const request = new Request(options.url ?? "https://recipes.palko.dev/", {
    headers: options.headers,
  });
  const response = await onRequest({
    request,
    env,
    next: async () => options.next ?? new Response("ok"),
    waitUntil() {},
    passThroughOnException() {},
    functionPath: "/",
    params: {},
    data: {},
  });
  return { response, assetsHit };
}

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  privateKey = pair.privateKey;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  publicJwk = { ...jwk, kid: KID, alg: "RS256", use: "sig" };
});

afterEach(() => {
  clearAccessJwksCache();
  vi.unstubAllGlobals();
});

describe("Cloudflare Access helpers", () => {
  it("treats Access as unconfigured until both env vars are set", () => {
    expect(isAccessConfigured({})).toBe(false);
    expect(isAccessConfigured({ CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN })).toBe(false);
    expect(isAccessConfigured({ CF_ACCESS_AUD: AUD })).toBe(false);
    expect(isAccessConfigured({ CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD })).toBe(
      true,
    );
  });

  it("normalizes team domains to an https issuer and JWKS URL", () => {
    expect(accessIssuer(TEAM_DOMAIN)).toBe(ISSUER);
    expect(accessIssuer(ISSUER)).toBe(ISSUER);
    expect(accessIssuer("test-team")).toBe(ISSUER);
    expect(accessCertsUrl(TEAM_DOMAIN)).toBe(`${ISSUER}/cdn-cgi/access/certs`);
  });

  it("reads the Access JWT from the assertion header or CF_Authorization cookie", () => {
    expect(
      readAccessToken(
        new Request("https://recipes.palko.dev/", {
          headers: { "Cf-Access-Jwt-Assertion": "header-token" },
        }),
      ),
    ).toBe("header-token");
    expect(
      readAccessToken(
        new Request("https://recipes.palko.dev/", {
          headers: { Cookie: "other=1; CF_Authorization=cookie-token" },
        }),
      ),
    ).toBe("cookie-token");
    expect(readAccessToken(new Request("https://recipes.palko.dev/"))).toBeNull();
  });

  it("parses cookies", () => {
    expect(parseCookies("a=1; CF_Authorization=abc.def.ghi")).toEqual({
      a: "1",
      CF_Authorization: "abc.def.ghi",
    });
  });
});

describe("Cloudflare Access JWT verification", () => {
  const env = { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD };

  it("accepts a RS256 token with matching aud, iss, and exp", async () => {
    const token = await signJwt(validClaims());
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(true);
  });

  it("accepts aud as an array that contains the application tag", async () => {
    const token = await signJwt(validClaims({ aud: [AUD, "other"] }));
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(true);
  });

  it("rejects an expired token", async () => {
    const token = await signJwt(validClaims({ exp: Math.floor(Date.now() / 1000) - 120 }));
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(false);
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await signJwt(validClaims({ aud: "someone-else" }));
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(false);
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await signJwt(validClaims({ iss: "https://evil.cloudflareaccess.com" }));
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(false);
  });

  it("rejects a token whose signature does not match the JWKS", async () => {
    const other = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    const token = await signJwt(validClaims(), undefined, other.privateKey);
    expect(await verifyAccessJwt(token, env, { fetch: jwksFetch() })).toBe(false);
  });

  it("rejects a truncated token and alg=none", async () => {
    const token = await signJwt(validClaims());
    expect(await verifyAccessJwt("not-a-jwt", env, { fetch: jwksFetch() })).toBe(false);
    expect(await verifyAccessJwt(token.slice(0, 20), env, { fetch: jwksFetch() })).toBe(false);
    const none = `${jsonToBase64Url({ alg: "none", typ: "JWT" })}.${jsonToBase64Url(validClaims())}.`;
    expect(await verifyAccessJwt(none, env, { fetch: jwksFetch() })).toBe(false);
  });
});

describe("Cloudflare Access middleware", () => {
  it("passes requests through when Access env vars are unset", async () => {
    const { response, assetsHit } = await runMiddleware({
      next: new Response("bookshelf"),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("bookshelf");
    expect(assetsHit).toBe(0);
  });

  it("passes through when only one Access env var is set", async () => {
    const teamOnly = await runMiddleware({
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN },
      next: new Response("ok"),
    });
    expect(await teamOnly.response.text()).toBe("ok");

    const audOnly = await runMiddleware({
      env: { CF_ACCESS_AUD: AUD },
      next: new Response("ok"),
    });
    expect(await audOnly.response.text()).toBe("ok");
  });

  it("falls back to the SPA index for 404 document paths when unconfigured", async () => {
    const { response, assetsHit } = await runMiddleware({
      url: "https://recipes.palko.dev/book/baking",
      next: new Response("missing", { status: 404 }),
      assets: new Response("<!doctype html>spa", { status: 200 }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<!doctype html>spa");
    expect(assetsHit).toBe(1);
  });

  it("does not rewrite API or static-file 404s", async () => {
    const api = await runMiddleware({
      url: "https://recipes.palko.dev/api/recipes",
      next: new Response("nope", { status: 404 }),
    });
    expect(api.response.status).toBe(404);
    expect(api.assetsHit).toBe(0);

    const asset = await runMiddleware({
      url: "https://recipes.palko.dev/assets/app.js",
      next: new Response("nope", { status: 404 }),
    });
    expect(asset.response.status).toBe(404);
    expect(asset.assetsHit).toBe(0);
  });

  it("returns 401 when Access is configured and the JWT is missing", async () => {
    vi.stubGlobal("fetch", jwksFetch());
    const page = await runMiddleware({
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
    });
    expect(page.response.status).toBe(401);
    expect(await page.response.text()).toBe("Unauthorized");

    const api = await runMiddleware({
      url: "https://recipes.palko.dev/api/recipes",
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
    });
    expect(api.response.status).toBe(401);
    expect(await api.response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 for an invalid JWT when Access is configured", async () => {
    vi.stubGlobal("fetch", jwksFetch());
    const token = await signJwt(validClaims({ aud: "wrong-aud" }));
    const { response } = await runMiddleware({
      headers: { "Cf-Access-Jwt-Assertion": token },
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
    });
    expect(response.status).toBe(401);
  });

  it("allows a valid Access JWT from the assertion header", async () => {
    vi.stubGlobal("fetch", jwksFetch());
    const token = await signJwt(validClaims());
    const { response } = await runMiddleware({
      headers: { "Cf-Access-Jwt-Assertion": token },
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
      next: new Response("bookshelf"),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("bookshelf");
  });

  it("allows a valid Access JWT from the CF_Authorization cookie", async () => {
    vi.stubGlobal("fetch", jwksFetch());
    const token = await signJwt(validClaims());
    const { response } = await runMiddleware({
      headers: { Cookie: `CF_Authorization=${token}` },
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
      next: new Response("bookshelf"),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("bookshelf");
  });

  it("still applies SPA fallback after a valid Access JWT", async () => {
    vi.stubGlobal("fetch", jwksFetch());
    const token = await signJwt(validClaims());
    const { response, assetsHit } = await runMiddleware({
      url: "https://recipes.palko.dev/recipe/apple-crisp",
      headers: { "Cf-Access-Jwt-Assertion": token },
      env: { CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, CF_ACCESS_AUD: AUD },
      next: new Response("missing", { status: 404 }),
      assets: new Response("<!doctype html>spa", { status: 200 }),
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<!doctype html>spa");
    expect(assetsHit).toBe(1);
  });
});
