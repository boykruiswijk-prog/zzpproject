// deno-lint-ignore-file no-explicit-any
// Suggereer-onderwerpen: gebruikt Anthropic om 8 koopgerichte BAV-artikelonderwerpen
// voor te stellen voor een gekozen vakgebied, zonder overlap met bestaande artikelen.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const VAKGEBIEDEN = [
  "IT en ICT",
  "HR en finance consultancy",
  "PR en marketing",
  "management consultancy",
  "coaches",
  "zakelijke dienstverlening",
  "algemeen",
];

const SYSTEM_PROMPT = `Je bent SEO-strateeg en redacteur voor ZP Zaken, dé partner voor zzp'ers in Nederland voor beroepsaansprakelijkheidsverzekering (BAV) en aanverwante zakelijke verzekeringen (AVB).

Doel: kansrijke, koopgerichte artikel-onderwerpen bedenken voor de Kennisbank op zpzaken.nl. De lezer is een zzp'er in Nederland die al overweegt een BAV af te sluiten en op zoek is naar de juiste partij. Focus dus op beslissingsgerichte, transactionele zoekintentie rond de BAV, niet op brede oriëntatie ("wat is een BAV" als hoofdinsteek).

Regels voor de suggesties:
- Elk onderwerp is koopgericht en past bij het gekozen vakgebied (met concrete risico's en klantsituaties uit dat vakgebied).
- Formuleer een werktitel in de je/jij-vorm die aansluit op hoe mensen zoeken.
- Kies één helder hoofdzoekwoord met koopintentie (bijvoorbeeld "BAV afsluiten als IT-zzp'er", "beroepsaansprakelijkheidsverzekering voor coach").
- Waarom-veld: één zin die uitlegt waarom dit onderwerp kansrijk is (zoekvolume, koopintentie, of onderscheidend inzicht).
- Vermijd overlap met bestaande artikelen die aangeleverd worden. Denk aan een andere invalshoek, ander vakgebied, andere fase in de aanvraag, of andere concrete twijfel.

Stijl:
- Geen em-dashes.
- Geen opgeklopte AI-taal.
- Geen emoji.
- Schrijf de bedrijfsnaam altijd als "ZP Zaken".

Antwoord ALLEEN als geldige JSON, zonder omliggende tekst of code fences, volgens dit schema:
{
  "onderwerpen": [
    { "titel": string, "hoofdzoekwoord": string, "waarom": string }
  ]
}

Lever exact 8 onderwerpen aan.`;

async function callAnthropic(apiKey: string, userMessage: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`anthropic_http_${res.status}`);
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("anthropic_bad_response"); }
  const block = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === "text") : null;
  const out = block?.text ?? "";
  if (!out) throw new Error("anthropic_empty_response");
  return out as string;
}

function extractJson(raw: string): any {
  let s = raw.trim();
  if (s.startsWith("```")) s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!s.startsWith("{")) {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first >= 0 && last > first) s = s.slice(first, last + 1);
  }
  return JSON.parse(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "config_missing" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isTeam } = await admin.rpc("is_team_member", { _user_id: user.id });
    if (!isTeam) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const vakgebiedRaw = String(body?.vakgebied ?? "").trim();
    if (!vakgebiedRaw) return json({ error: "vakgebied_required" }, 400);
    const vakgebied = VAKGEBIEDEN.find((v) => v.toLowerCase() === vakgebiedRaw.toLowerCase());
    if (!vakgebied) return json({ error: "vakgebied_invalid" }, 400);

    const { data: existing } = await admin.from("articles").select("title").order("updated_at", { ascending: false });
    const bestaandeTitels = (existing ?? []).map((r: any) => r.title).filter(Boolean);

    const userMessage = [
      `Vakgebied: ${vakgebied}.`,
      `Bedenk 8 koopgerichte BAV-artikelonderwerpen voor zzp'ers in Nederland in dit vakgebied, gericht op mensen die al overwegen een BAV af te sluiten.`,
      `Vermijd inhoudelijk overlap met deze bestaande artikelen (titels):`,
      bestaandeTitels.length ? bestaandeTitels.map((t) => `- ${t}`).join("\n") : "(nog geen artikelen)",
      `Antwoord ALLEEN met geldige JSON volgens het schema uit de systeeminstructie. Exact 8 onderwerpen. Geen omliggende tekst, geen code fences.`,
    ].join("\n\n");

    let rawOut: string;
    try {
      rawOut = await callAnthropic(ANTHROPIC_API_KEY, userMessage);
    } catch (_e) {
      return json({ error: "ai_call_failed" }, 502);
    }

    let parsed: any;
    try { parsed = extractJson(rawOut); } catch { return json({ error: "ai_bad_json" }, 502); }

    const raw = Array.isArray(parsed?.onderwerpen) ? parsed.onderwerpen : [];
    const onderwerpen = raw
      .map((o: any) => ({
        titel: String(o?.titel ?? "").trim(),
        hoofdzoekwoord: String(o?.hoofdzoekwoord ?? "").trim(),
        waarom: String(o?.waarom ?? "").trim(),
      }))
      .filter((o: any) => o.titel && o.hoofdzoekwoord);

    if (!onderwerpen.length) return json({ error: "ai_incomplete" }, 502);

    try {
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const naam = (profile as any)?.full_name || user.email || "onbekend";
      await admin.from("activiteiten_log").insert({
        actie_type: "seo_onderwerpen_gegenereerd",
        omschrijving: `SEO-onderwerpen gegenereerd voor vakgebied "${vakgebied}" (${onderwerpen.length} suggesties)`,
        uitgevoerd_door: user.id,
        uitgevoerd_door_naam: naam,
      });
    } catch { /* logging mag flow niet blokkeren */ }

    return json({ success: true, vakgebied, onderwerpen });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});
