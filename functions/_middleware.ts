import { isAccessConfigured, readAccessToken, verifyAccessJwt } from "../shared/access.ts";

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const { pathname } = new URL(request.url);

  if (isAccessConfigured(env)) {
    const token = readAccessToken(request);
    const valid = token ? await verifyAccessJwt(token, env) : false;
    if (!valid) return unauthorized(pathname);
  }

  const response = await next();
  if (response.status === 404 && isDocumentPath(pathname) && !pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(new URL("/", request.url));
  }
  return response;
};

function unauthorized(pathname: string): Response {
  const headers = { "cache-control": "no-store" };
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  return new Response("Unauthorized", { status: 401, headers });
}

function isDocumentPath(pathname: string): boolean {
  return !pathname.includes(".") || pathname.endsWith(".html");
}
