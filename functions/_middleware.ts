import { loginPageHtml } from "./login-page.ts";
import {
  parseCookies,
  readValidSession,
  safeNextPath,
  SESSION_COOKIE,
} from "../shared/session.ts";

const PUBLIC_PATHS = new Set(["/favicon.svg", "/favicon.ico", "/robots.txt"]);

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname === "/api/login" || pathname === "/api/logout") {
    return next();
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return next();
  }

  if (!env.BOOKSHELF_PASSWORD || !env.SESSION_SECRET) {
    if (wantsHtml(request)) {
      return html(
        loginPageHtml({
          error: "This bookshelf is not configured yet. Set BOOKSHELF_PASSWORD and SESSION_SECRET.",
          nextPath: "/",
        }),
      );
    }
    return Response.json({ error: "Bookshelf is not configured." }, { status: 503 });
  }

  const ok = await readValidSession(request, env);
  if (ok) {
    const response = await next();
    if (response.status === 404 && isDocumentPath(pathname) && !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(new URL("/", request.url));
    }
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (wantsHtml(request) || isDocumentPath(pathname)) {
    const nextPath = safeNextPath(`${pathname}${url.search}`);
    const cookies = parseCookies(request.headers.get("Cookie"));
    const error =
      cookies[SESSION_COOKIE] != null
        ? "That session expired. Enter the family password again."
        : undefined;
    return html(loginPageHtml({ error, nextPath }));
  }

  return new Response("Unauthorized", { status: 401 });
};

function wantsHtml(request: Request): boolean {
  return (request.headers.get("Accept") ?? "").includes("text/html");
}

function isDocumentPath(pathname: string): boolean {
  return !pathname.includes(".") || pathname.endsWith(".html");
}

function html(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
