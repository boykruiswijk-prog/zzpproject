// Gedeelde Exact-tokenlogica (M4): de ENIGE plek waar een Exact-token wordt ververst.
// - Ververs minimaal 60 s vóór verloop.
// - Gelijktijdige aanroepen: alleen de houder van de lock (exact_config.refresh_lock_until,
//   atomaire update … where lock leeg of verlopen … returning) ververst; de rest pollt
//   max ~5 s exact_config en gebruikt het nieuwe token.
// - Exact "access_token not expired": geen fout; huidig token opnieuw lezen en gebruiken.
// - 401 bij refresh: config herlezen en met een nieuwer refresh token opnieuw proberen.
// Geen imports: ook getest met vitest (src/test/exactToken.test.ts).

// deno-lint-ignore no-explicit-any
type Sb = any;
// deno-lint-ignore no-explicit-any
type Cfg = any;

export const MARGE_MS = 60_000;
const LOCK_MS = 30_000;

export const tokenTiming = { pollMs: 250, maxWachtMs: 5_000 };

const geldig = (cfg: Cfg, marge = MARGE_MS) =>
  !!cfg?.access_token && !!cfg?.access_token_expires_at &&
  new Date(cfg.access_token_expires_at).getTime() - Date.now() > marge;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function herlees(supabase: Sb, id: string): Promise<Cfg | null> {
  const { data } = await supabase.from("exact_config").select("*").eq("id", id).single();
  return data ?? null;
}

async function claimLock(supabase: Sb, id: string): Promise<boolean> {
  const nu = new Date().toISOString();
  const tot = new Date(Date.now() + LOCK_MS).toISOString();
  const { data, error } = await supabase.from("exact_config")
    .update({ refresh_lock_until: tot })
    .eq("id", id)
    .or(`refresh_lock_until.is.null,refresh_lock_until.lt.${nu}`)
    .select("id");
  if (error) throw new Error(`Refresh-lock mislukt: ${error.message}`);
  return Array.isArray(data) && data.length === 1;
}

async function releaseLock(supabase: Sb, id: string) {
  try { await supabase.from("exact_config").update({ refresh_lock_until: null }).eq("id", id); } catch (_) { /* lock verloopt vanzelf */ }
}

export async function ensureValidToken(supabase: Sb, config: Cfg): Promise<string> {
  if (geldig(config)) return config.access_token;
  return await refreshMetLock(supabase, config, false);
}

/** Geforceerde refresh (keepalive), via dezelfde lock. reloadOn401 blijft voor compatibiliteit. */
export async function refreshAccessToken(supabase: Sb, config: Cfg, _reloadOn401 = true): Promise<string> {
  return await refreshMetLock(supabase, config, true);
}

async function refreshMetLock(supabase: Sb, config: Cfg, force: boolean): Promise<string> {
  const id = config.id;
  if (await claimLock(supabase, id)) {
    try {
      const vers = (await herlees(supabase, id)) ?? config;
      // Een ander heeft net ververst: gebruik dat token (ook bij force, dan is het vers).
      if (geldig(vers) && (!force || vers.access_token !== config.access_token)) {
        Object.assign(config, vers);
        return vers.access_token;
      }
      const token = await doeRefresh(supabase, vers, true);
      Object.assign(config, await herlees(supabase, id) ?? {});
      return token;
    } finally {
      await releaseLock(supabase, id);
    }
  }
  // Iemand anders ververst: wachten op het nieuwe token.
  const start = Date.now();
  while (Date.now() - start < tokenTiming.maxWachtMs) {
    await sleep(tokenTiming.pollMs);
    const vers = await herlees(supabase, id);
    if (vers && geldig(vers) && vers.access_token !== config.access_token) {
      Object.assign(config, vers);
      return vers.access_token;
    }
    if (vers && !vers.refresh_lock_until && geldig(vers)) { Object.assign(config, vers); return vers.access_token; }
  }
  const laatste = await herlees(supabase, id);
  if (laatste && geldig(laatste, 0)) { Object.assign(config, laatste); return laatste.access_token; }
  throw new Error("Exact-token niet beschikbaar: een andere refresh loopt nog of is mislukt.");
}

async function doeRefresh(supabase: Sb, config: Cfg, reloadOn401: boolean): Promise<string> {
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
    const omschrijving = `${td?.error ?? ""} ${td?.error_description ?? ""}`;
    if (/not expired/i.test(omschrijving)) {
      // Exact weigert omdat het huidige token nog geldig is: dat token gebruiken.
      const vers = await herlees(supabase, config.id);
      if (vers?.access_token) return vers.access_token;
    }
    if (reloadOn401 && r.status === 401) {
      const fresh = await herlees(supabase, config.id);
      if (fresh && fresh.refresh_token && fresh.refresh_token !== config.refresh_token) {
        return await doeRefresh(supabase, fresh, false);
      }
      throw new Error("Refresh mislukt (401) — verbind Exact opnieuw via /admin/exact-koppeling.");
    }
    // Alleen foutcode/omschrijving, nooit tokens.
    throw new Error(`Refresh mislukt (${r.status}): ${omschrijving.trim()}`.trim());
  }
  const newExpiresAt = new Date(Date.now() + td.expires_in * 1000).toISOString();
  await supabase.from("exact_config").update({
    access_token: td.access_token, refresh_token: td.refresh_token,
    access_token_expires_at: newExpiresAt, token_expires_at: newExpiresAt,
    refresh_token_obtained_at: new Date().toISOString(),
  }).eq("id", config.id);
  return td.access_token;
}
