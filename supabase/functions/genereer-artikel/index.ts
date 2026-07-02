// deno-lint-ignore-file no-explicit-any
// Genereer-artikel: roept de Anthropic API aan en levert een concept-artikel
// als gestructureerde JSON (title, content, excerpt, seo_title, seo_description, category).
// Alleen teamleden mogen aanroepen. De API-sleutel blijft server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `Je bent de redacteur van ZP Zaken en schrijft artikelen voor de Kennisbank op zpzaken.nl.

Over ZP Zaken:
- Al 13+ jaar dé partner voor zzp'ers in Nederland.
- Biedt verzekeringen (BAV, AVB), screening en zakelijke ondersteuning voor zelfstandig professionals.
- Kernwaarden: persoonlijk contact (altijd een mens aan de lijn), de menselijke maat, transparante werkwijze zonder verborgen kosten.

Doelgroep: zzp'ers en zelfstandig professionals in Nederland die op het punt staan een beroepsaansprakelijkheidsverzekering (BAV) af te sluiten en op zoek zijn naar de juiste partij. Ze willen snel weten wat het kost, wat het dekt, hoe snel het geregeld is en waarom ze dit via ZP Zaken zouden doen.

Zoekintentie en toon:
- De lezer is koopgericht, niet louter oriënterend. Schrijf overtuigend en beslissingsgericht, geen brede uitleg-artikelen ("wat is een BAV" als hoofdinsteek).
- Neem concrete twijfels weg die iemand heeft vlak voor een aanvraag: prijs, dekking, uitsluitingen, snelheid van afsluiten, service, waarom ZP Zaken.
- Wees concreet met voorbeelden, situaties, bedragen en praktische informatie. Vermijd algemene, zwevende bewoordingen.
- Schrijf consequent in de je/jij-vorm, de hele tekst door. Wissel nooit naar u of naar de derde persoon.

Vakgebieden van ZP Zaken (spits het artikel toe wanneer het onderwerp een vakgebied noemt):
- IT en ICT (developers, consultants, cybersecurity, data)
- HR en finance consultancy (interim HR, controllers, finance professionals)
- PR en marketing (communicatie, content, campagnes, online marketing)
- Management consultancy (strategie, verandering, project- en programmamanagement)
- Coaches (business coaches, loopbaancoaches, executive coaches)
- Zakelijke dienstverlening (overige professional services)
Gebruik risico's, klantsituaties en voorbeelden die bij het vakgebied passen (bijvoorbeeld: een IT-zzp'er die per ongeluk een productieomgeving plat legt, een consultant met een verkeerd advies, een coach met een klacht over een traject).

SEO-schrijfregels:
- Schrijf rond één helder hoofdzoekwoord dat past bij de koopintentie (bijvoorbeeld "BAV afsluiten als consultant" of "beroepsaansprakelijkheidsverzekering voor IT-zzp'er"). Verwerk natuurlijke varianten, geen keyword stuffing.
- Gebruik H2 en H3-koppen die concrete zoek- en beslissingsvragen beantwoorden zoals mensen ze intypen ("Wat kost een BAV voor een IT-zzp'er?", "Wat dekt de BAV precies?", "Hoe snel kan ik een BAV afsluiten?", "Waarom een BAV via ZP Zaken?").
- Verwerk het hoofdzoekwoord in de eerste alinea en in minimaal één H2.

Strikte stijlregels (belangrijk):
- Gebruik NOOIT em-dashes (—). Gebruik in plaats daarvan een komma, punt of losse zin.
- Gebruik NOOIT opgeklopte AI-clichés zoals "in de snel veranderende wereld van vandaag", "duik in", "ontdek de kracht van", "revolutionair", "cruciaal" of "essentieel" als opsmuk.
- Geen emoji.
- Schrijf de bedrijfsnaam altijd als "ZP Zaken" (twee woorden, hoofdletters Z en P en Z).
- Vermijd Engelse termen als er een gewone Nederlandse variant is.
- Schrijf natuurlijk en organisch Nederlands, zoals een goede Nederlandse redacteur.

Formaat:
- Lever het artikel in Markdown: koppen (## en ###), korte alinea's, opsommingen waar dat helpt.
- Begin met een korte pakkende inleiding die direct de koopintentie erkent, geen H1 (die volgt uit de titel).
- Sluit af met een duidelijke, uitnodigende volgende stap voor de lezer: een BAV aanvragen bij ZP Zaken of vrijblijvend contact opnemen. Houd het menselijk en niet pusherig, passend bij de menselijke maat van ZP Zaken.

Je krijgt een onderwerp aangereikt en levert je antwoord ALLEEN als geldige JSON, zonder omliggende tekst, code fences of uitleg. Het JSON-schema:
{
  "title": string,             // pakkende, feitelijke titel met hoofdzoekwoord (max ~70 tekens)
  "content": string,           // volledig artikel in Markdown, koopgericht, in jij-vorm, met activerende afsluiting
  "excerpt": string,           // korte samenvatting van 1-2 zinnen (max ~200 tekens)
  "seo_title": string,         // SEO-titel met hoofdzoekwoord vooraan, passende lengte voor Google (circa 50-60 tekens)
  "seo_description": string,   // wervende meta-omschrijving met duidelijke reden om te klikken (circa 150-160 tekens)
  "category": string           // exact een van de aangeleverde rubrieken
}`;

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
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`anthropic_http_${res.status}`);
  }
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error("anthropic_bad_response"); }
  const block = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === "text") : null;
  const out = block?.text ?? "";
  if (!out) throw new Error("anthropic_empty_response");
  return out as string;
}

function extractJson(raw: string): any {
  let s = raw.trim();
  // Strip evt. code fences
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  // Fallback: pak eerste { ... laatste }
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
    const onderwerp = String(body?.onderwerp ?? "").trim();
    const gewensteRubriek = body?.rubriek ? String(body.rubriek).trim() : "";
    if (!onderwerp) return json({ error: "onderwerp_required" }, 400);

    // Categorieën ophalen zodat Claude er een geldige uit kiest
    const { data: cats } = await admin.from("article_categories").select("label").order("label");
    const beschikbaar = (cats ?? []).map((c: any) => c.label).filter(Boolean);
    const rubriekenLijst = beschikbaar.length ? beschikbaar.join(", ") : "Algemeen";

    const userMessage = [
      `Schrijf een koopgericht Kennisbank-artikel voor ZP Zaken over: ${onderwerp}`,
      `Focus op de BAV (beroepsaansprakelijkheidsverzekering) voor zzp'ers. De lezer overweegt al een BAV af te sluiten en zoekt de juiste partij. Neem twijfels weg (prijs, dekking, snelheid, waarom ZP Zaken) in plaats van een brede uitlegtekst te schrijven.`,
      `Als het onderwerp een specifiek vakgebied noemt (IT/ICT, HR of finance consultancy, PR of marketing, management consultancy, coaches, zakelijke dienstverlening), spits het artikel dan toe op dat vakgebied met passende voorbeelden en risico's.`,
      `Kies één helder hoofdzoekwoord met koopintentie en verwerk dat in de titel, de eerste alinea, minimaal één H2 en de seo_title. Schrijf de hele tekst in de je/jij-vorm.`,
      `Sluit af met een uitnodigende, niet-pusherige call-to-action om via ZP Zaken een BAV aan te vragen of vrijblijvend contact op te nemen.`,
      gewensteRubriek ? `Gewenste rubriek: ${gewensteRubriek}` : "",
      `Kies de "category" exact uit deze lijst: ${rubriekenLijst}.`,
      `Antwoord ALLEEN met geldige JSON volgens het schema uit de systeeminstructie. Geen omliggende tekst, geen code fences.`,
    ].filter(Boolean).join("\n\n");

    let rawOut: string;
    try {
      rawOut = await callAnthropic(ANTHROPIC_API_KEY, userMessage);
    } catch (_e) {
      return json({ error: "ai_call_failed" }, 502);
    }

    let parsed: any;
    try {
      parsed = extractJson(rawOut);
    } catch (_e) {
      return json({ error: "ai_bad_json" }, 502);
    }

    const result = {
      title: String(parsed?.title ?? "").trim(),
      content: String(parsed?.content ?? "").trim(),
      excerpt: String(parsed?.excerpt ?? "").trim(),
      seo_title: String(parsed?.seo_title ?? "").trim(),
      seo_description: String(parsed?.seo_description ?? "").trim(),
      category: String(parsed?.category ?? "").trim(),
    };
    if (!result.title || !result.content) return json({ error: "ai_incomplete" }, 502);

    // Verifieer category is geldig; anders leeg laten zodat redacteur kiest.
    if (result.category && !beschikbaar.includes(result.category)) {
      result.category = "";
    }

    // Log naar activiteiten_log
    try {
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const naam = (profile as any)?.full_name || user.email || "onbekend";
      await admin.from("activiteiten_log").insert({
        actie_type: "artikel_gegenereerd_met_claude",
        omschrijving: `Concept-artikel gegenereerd met Claude over "${onderwerp}"`,
        uitgevoerd_door: user.id,
        uitgevoerd_door_naam: naam,
      });
    } catch { /* logging mag flow niet blokkeren */ }

    return json({ success: true, article: result });
  } catch (_e) {
    return json({ error: "internal_error" }, 500);
  }
});
