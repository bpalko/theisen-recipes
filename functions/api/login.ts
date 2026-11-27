import {
  createSessionToken,
  safeNextPath,
  secretsEqual,
  sessionCookieHeader,
} from "../../shared/session.ts";
import { loginPageHtml } from "../login-page.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.BOOKSHELF_PASSWORD || !env.SESSION_SECRET) {
    return fail(request, "Bookshelf is not configured.", "/");
  }

  const { password, nextPath } = await readCredentials(request);
  const matches = await secretsEqual(password, env.BOOKSHELF_PASSWORD);
  if (!matches) {
    return fail(request, "That password didn’t work. Try again.", nextPath);
  }

  const token = await createSessionToken(env.SESSION_SECRET);
  const headers = new Headers({
    Location: nextPath,
    "Set-Cookie": sessionCookieHeader(token, request.url),
    "cache-control": "no-store",
  });

  if (wantsJson(request)) {
    return Response.json(
      { ok: true, next: nextPath },
      { headers: { "Set-Cookie": sessionCookieHeader(token, request.url) } },
    );
  }

  return new Response(null, { status: 303, headers });
};

async function readCredentials(
  request: Request,
): Promise<{ password: string; nextPath: string }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { password?: unknown; next?: unknown };
    return {
      password: typeof body.password === "string" ? body.password : "",
      nextPath: safeNextPath(typeof body.next === "string" ? body.next : "/"),
    };
  }
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const nextPath = safeNextPath(String(form.get("next") ?? "/"));
  return { password, nextPath };
}

function fail(request: Request, message: string, nextPath: string): Response {
  if (wantsJson(request)) {
    return Response.json({ error: message }, { status: 401 });
  }
  return new Response(loginPageHtml({ error: message, nextPath }), {
    status: 401,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

export const onRequestGet: PagesFunction<Env> = async () => {
  return new Response("Method Not Allowed", { status: 405 });
};
