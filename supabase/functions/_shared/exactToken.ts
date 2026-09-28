// Gedeelde Exact-tokenlogica (zelfde gedrag als polis-lifecycle, incl. 401-race-herstel).
// Nog alleen gebruikt door exact-email-bulk; andere functies worden later omgezet (M4).

// deno-lint-ignore no-explicit-any
type Sb = any;

// deno-lint-ignore no-explicit-any
export async function ensureValidToken(supabase: Sb, config: any): Promise<string> {
  const expiresAt = config.access_token_expires_at ? new Date(config.access_token_expires_at) : new Date(0);
  if (expiresAt.getTime() - Date.now() > 60_000 && config.access_token) return config.access_token;
  return await refreshAccessToken(supabase, config, true);
}

// deno-lint-ignore no-explicit-any
export async function refreshAccessToken(supabase: Sb, config: any, reloadOn401: boolean): Promise<string> {
  const baseUrl = config.base_url || "https://start.exactonline.nl";
  if (!config.refresh_token) throw new Error("Geen refresh_token in exact_config");
  const r = await fetch(`${baseUrl}/api/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: config.refresh_token,
      client_id: config.client_id, client_secret: config.client_secret,
    }).toString(),
  });
  // deno-lint-ignore no-explicit-any
  const td: any = await r.json().catch(() => ({}));
  if (!r.ok || !td.access_token) {
    if (reloadOn401 && r.status === 401) {
      const { data: fresh } = await supabase.from("exact_config").select("*").eq("id", config.id).single();
      if (fresh && fresh.refresh_token && fresh.refresh_token !== config.refresh_token) {
        return await refreshAccessToken(supabase, fresh, false);
      }
      throw new Error("Refresh mislukt (401) — verbind Exact opnieuw via /admin/exact-koppeling.");
    }
    // Alleen foutcode/omschrijving, nooit tokens.
    throw new Error(`Refresh mislukt (${r.status}): ${td?.error ?? ""} ${td?.error_description ?? ""}`.trim());
  }
  const newExpiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase.from("exact_config").update({
    access_token: td.access_token, refresh_token: td.refresh_token,
    access_token_expires_at: newExpiresAt, token_expires_at: newExpiresAt,
    refresh_token_obtained_at: new Date().toISOString(),
  }).eq("id", config.id);
  return td.access_token;
}
