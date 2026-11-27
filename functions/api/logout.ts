import { clearSessionCookieHeader } from "../../shared/session.ts";

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  const headers = new Headers({
    "Set-Cookie": clearSessionCookieHeader(request.url),
    Location: "/",
    "cache-control": "no-store",
  });
  if ((request.headers.get("Accept") ?? "").includes("application/json")) {
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader(request.url) } });
  }
  return new Response(null, { status: 303, headers });
};
