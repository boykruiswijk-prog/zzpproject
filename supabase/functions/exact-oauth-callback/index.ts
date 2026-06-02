// Exact Online OAuth2 callback. Valideert state, wisselt code in voor tokens,
// slaat ze op in exact_config en toont een nette HTML-bevestiging.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function htmlResponse(title: string, bodyInner: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 540px; margin: 80px auto; padding: 0 24px; color: #1a1a1a; }
    h1 { font-size: 24px; margin-bottom: 12px; }
    p { line-height: 1.6; color: #444; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 12px;
      overflow: auto; white-space: pre-wrap; word-break: break-all; }
    .err { color: #b91c1c; }
    .ok  { color: #047857; }
    a.btn { display: inline-block; margin-top: 16px; padding: 10px 18px;
      background: #E53E2F; color: #fff; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>${bodyInner}</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const adminLink = `<a class="btn" href="https://zpzaken.nl/admin/exact-koppeling">Naar admin-pagina</a>`;

  if (error) {
    return htmlResponse(
      "Autorisatie geweigerd",
      `<h1 class="err">Autorisatie geweigerd</h1><p>Exact Online gaf terug: <code>${error}</code></p>${adminLink}`,
      400,
    );
  }

  if (!code || !state) {
    return htmlResponse(
      "Ongeldige callback",
      `<h1 class="err">Ongeldige callback</h1><p>De parameters <code>code</code> of <code>state</code> ontbreken.</p>${adminLink}`,
      400,
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: stateRow } = await supabase
      .from("exact_oauth_state")
      .select("state, expires_at")
      .eq("state", state)
      .maybeSingle();

    if (!stateRow) {
      return htmlResponse(
        "Ongeldige sessie",
        `<h1 class="err">Ongeldige sessie</h1><p>De state token werd niet herkend. Start de koppeling opnieuw vanuit de admin.</p>${adminLink}`,
        400,
      );
    }

    if (new Date(stateRow.expires_at) < new Date()) {
      await supabase.from("exact_oauth_state").delete().eq("state", state);
      return htmlResponse(
        "Sessie verlopen",
        `<h1 class="err">Sessie verlopen</h1><p>De koppelingssessie is verlopen (max 10 min). Start opnieuw.</p>${adminLink}`,
        400,
      );
    }

    await supabase.from("exact_oauth_state").delete().eq("state", state);

    const { data: config } = await supabase
      .from("exact_config")
      .select("id, client_id, client_secret, redirect_uri, base_url")
      .maybeSingle();

    if (!config?.client_id || !config?.client_secret || !config?.redirect_uri) {
      return htmlResponse(
        "Configuratie incompleet",
        `<h1 class="err">Configuratie incompleet</h1><p>client_id, client_secret of redirect_uri ontbreekt in exact_config.</p>${adminLink}`,
        500,
      );
    }

    const baseUrl = config.base_url || "https://start.exactonline.nl";
    const tokenRes = await fetch(`${baseUrl}/api/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: config.client_id,
        client_secret: config.client_secret,
        redirect_uri: config.redirect_uri,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      return htmlResponse(
        "Tokenuitwisseling mislukt",
        `<h1 class="err">Tokenuitwisseling mislukt</h1>
         <p>Exact gaf status <code>${tokenRes.status}</code> terug.</p>
         <pre>${JSON.stringify(tokenData, null, 2)}</pre>${adminLink}`,
        500,
      );
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
    const now = new Date().toISOString();

    await supabase
      .from("exact_config")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        access_token_expires_at: expiresAt,
        token_expires_at: expiresAt,
        refresh_token_obtained_at: now,
        is_actief: true,
        last_error: null,
      })
      .eq("id", config.id);

    return htmlResponse(
      "Verbonden met Exact Online",
      `<h1 class="ok">Verbonden met Exact Online</h1>
       <p>De koppeling met administratie ZP Zaken B.V. is succesvol opgezet.</p>
       <p>Je kunt dit venster sluiten en teruggaan naar de admin.</p>
       ${adminLink}`,
    );
  } catch (err) {
    return htmlResponse(
      "Onverwachte fout",
      `<h1 class="err">Onverwachte fout</h1><pre>${err instanceof Error ? err.message : String(err)}</pre>${adminLink}`,
      500,
    );
  }
});
