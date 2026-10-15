// D9: STRIKT ALLEEN-LEZEN detectie van openstaande posten in Exact (besluit Boy 15-10-2026).
// Doet uitsluitend GET-verzoeken (afgedwongen in exactGet). Schrijft niets: geen tabellen, geen taken, geen mails.
// Modus 'probe' (standaard): welke velden en hoeveel posten. Modus 'voorstellen': kandidaten voor de admin,
// die het team zelf bevestigt via RPC meld_incasso_mislukt. Geen cron.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ensureValidToken, refreshAccessToken } from "../_shared/exactToken.ts";
import { requireSupervisor } from "../_shared/teamAuth.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const MAX_CALLS = 30;
const BRONNEN = ["read/financial/ReceivablesList", "cashflow/Receivables"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = await requireSupervisor(req, admin);
  if (auth instanceof Response) return json({ error: "geen_toegang" }, auth.status);
  let modus = "probe";
  try { const b = await req.json(); if (b?.modus === "voorstellen") modus = "voorstellen"; } catch { /* probe */ }

  const { data: cfg } = await admin.from("exact_config").select("*").limit(1).maybeSingle();
  if (!cfg?.is_actief || !cfg.divisie_code) return json({ error: "exact_niet_actief" }, 400);
  const base = `${cfg.base_url || "https://start.exactonline.nl"}/api/v1/${String(cfg.divisie_code).trim()}/`;
  let token = await ensureValidToken(admin, cfg);
  let calls = 0;

  // Enige toegang tot Exact: alleen GET.
  async function exactGet(url: string): Promise<{ ok: boolean; status: number; body: any }> {
    for (let poging = 0; poging < 2; poging++) {
      if (++calls > MAX_CALLS) throw new Error("call-plafond bereikt");
      const res = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      if (res.status === 401 && poging === 0) { await res.text(); token = await refreshAccessToken(admin, cfg); continue; }
      const tekst = await res.text();
      let body: any = null; try { body = JSON.parse(tekst); } catch { body = tekst.slice(0, 300); }
      return { ok: res.ok, status: res.status, body };
    }
    return { ok: false, status: 401, body: null };
  }

  if (modus === "probe") {
    const uit: Record<string, unknown> = {};
    for (const pad of BRONNEN) {
      const r = await exactGet(`${base}${pad}?$top=5`);
      const rijen: any[] = r.body?.d?.results ?? (Array.isArray(r.body?.d) ? r.body.d : []);
      let aantal: number | string = rijen.length;
      // Aantal posten tellen (alleen GET, maximaal 10 pagina's).
      if (r.ok) {
        let url: string | null = `${base}${pad}`; let n = 0; let pag = 0;
        while (url && pag < 10) { const p = await exactGet(url); if (!p.ok) break; const d = p.body?.d ?? {}; n += (d.results ?? []).length; url = d.__next ?? null; pag++; }
        aantal = url ? `${n}+` : n;
      }
      uit[pad] = { http: r.status, velden: rijen[0] ? Object.keys(rijen[0]).filter((k) => k !== "__metadata") : [], aantal,
        fout: r.ok ? null : (typeof r.body === "string" ? r.body : r.body?.error?.message?.value ?? null) };
    }
    return json({ modus, calls, bronnen: uit });
  }

  // voorstellen: openstaande posten over de vervaldatum, gekoppeld aan bekende klanten. Alleen tonen.
  const vandaag = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
  const r = await exactGet(`${base}read/financial/ReceivablesList?$top=500`);
  if (!r.ok) return json({ modus, error: `Exact ${r.status}`, detail: r.body }, 502);
  const rijen: any[] = r.body?.d?.results ?? [];
  const datum = (v: any) => { const m = /\/Date\((\d+)/.exec(String(v ?? "")); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null); };
  const verlopen = rijen.filter((x) => Number(x.Amount) > 0 && datum(x.DueDate) && datum(x.DueDate)! < vandaag);
  const codes = [...new Set(verlopen.map((x) => String(x.AccountCode ?? "").trim()).filter(Boolean))];
  const { data: onds } = codes.length ? await admin.from("ondernemingen").select("id,naam,exact_relatie_code,is_test").in("exact_relatie_code", codes) : { data: [] };
  const perCode = new Map((onds ?? []).map((o: any) => [String(o.exact_relatie_code).trim(), o]));
  const { data: open } = await admin.from("incasso_mislukt").select("onderneming_id,factuurnummer").in("status", ["open", "royement_voorgesteld"]);
  const bekend = new Set((open ?? []).map((x: any) => `${x.onderneming_id}|${x.factuurnummer}`));
  const kandidaten = verlopen.map((x) => {
    const o: any = perCode.get(String(x.AccountCode ?? "").trim());
    return o && !o.is_test ? { onderneming_id: o.id, klant: o.naam, factuurnummer: String(x.InvoiceNumber ?? ""), bedrag: Number(x.Amount),
      factuurdatum: datum(x.InvoiceDate), vervaldatum: datum(x.DueDate), omschrijving: x.Description ?? null } : null;
  }).filter((k: any) => k && k.factuurnummer && !bekend.has(`${k.onderneming_id}|${k.factuurnummer}`));
  return json({ modus, calls, totaal_open_posten: rijen.length, verlopen: verlopen.length, kandidaten });
});
