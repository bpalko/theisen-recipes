import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  parseCookies,
  safeNextPath,
  secretsEqual,
  sessionCookieHeader,
  verifySessionToken,
} from "../shared/session.ts";

describe("password session", () => {
  it("accepts the matching password and rejects a wrong one", async () => {
    expect(await secretsEqual("family", "family")).toBe(true);
    expect(await secretsEqual("family", "nope")).toBe(false);
  });

  it("round-trips a signed session token", async () => {
    const token = await createSessionToken("test-secret", 60, 1_700_000_000_000);
    expect(await verifySessionToken("test-secret", token, 1_700_000_000_000)).toBe(true);
    expect(await verifySessionToken("other-secret", token, 1_700_000_000_000)).toBe(false);
  });

  it("rejects expired and truncated tokens", async () => {
    const token = await createSessionToken("test-secret", 10, 1_000_000);
    expect(await verifySessionToken("test-secret", token, 20_000_000)).toBe(false);
    expect(await verifySessionToken("test-secret", token.slice(0, 8))).toBe(false);
    expect(await verifySessionToken("test-secret", "not-a-token")).toBe(false);
  });

  it("parses cookies and only allows relative next paths", () => {
    expect(parseCookies("a=1; tr_session=abc")).toEqual({ a: "1", tr_session: "abc" });
    expect(safeNextPath("/book/baking")).toBe("/book/baking");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/api/recipes")).toBe("/");
  });

  it("marks the session cookie HttpOnly", () => {
    const header = sessionCookieHeader("tok", "https://recipes.example");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("Secure");
    expect(header).toContain("tr_session=tok");
  });
});
