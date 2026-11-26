export function loginPageHtml(options: { error?: string; nextPath: string }): string {
  const error = options.error
    ? `<p class="error" role="alert">${escapeHtml(options.error)}</p>`
    : "";
  const nextPath = escapeHtml(options.nextPath);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Theisen Recipes — Enter family password</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; }
      body {
        font-family: Inter, "Helvetica Neue", Helvetica, Arial, sans-serif;
        background: #fff;
        color: #111;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
      }
      main { width: min(420px, 100%); }
      .spines {
        display: flex;
        gap: 6px;
        height: 56px;
        margin-bottom: 36px;
      }
      .spines span {
        flex: 1;
        border-radius: 2px;
        box-shadow: 0 10px 18px rgba(0,0,0,.12);
      }
      h1 {
        font-size: 28px;
        letter-spacing: -0.04em;
        margin: 0 0 8px;
      }
      p.lede {
        margin: 0 0 28px;
        color: #666;
        line-height: 1.5;
      }
      label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      input[type="password"] {
        width: 100%;
        border: 1px solid #111;
        border-radius: 999px;
        padding: 14px 18px;
        font: inherit;
        font-size: 16px;
        outline: none;
        background: #fff;
      }
      input[type="password"]:focus {
        box-shadow: 0 0 0 3px rgba(17,17,17,.15);
      }
      button {
        margin-top: 16px;
        width: 100%;
        border: 0;
        background: #111;
        color: #fff;
        font: inherit;
        font-weight: 600;
        padding: 14px 18px;
        border-radius: 999px;
        cursor: pointer;
      }
      button:hover { background: #000; }
      .error {
        color: #8a1f1f;
        background: #fbeaea;
        border-radius: 12px;
        padding: 10px 14px;
        margin: 0 0 18px;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="spines" aria-hidden="true">
        <span style="background:#C45C26"></span>
        <span style="background:#1E4B8E"></span>
        <span style="background:#2D5A3D"></span>
        <span style="background:#D4A017"></span>
        <span style="background:#7B2D3B"></span>
        <span style="background:#3D4C5C"></span>
      </div>
      <h1>Theisen Recipes</h1>
      <p class="lede">Enter family password</p>
      ${error}
      <form method="post" action="/api/login" autocomplete="current-password">
        <input type="hidden" name="next" value="${nextPath}" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required autofocus autocomplete="current-password" />
        <button type="submit">Open the bookshelf</button>
      </form>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
