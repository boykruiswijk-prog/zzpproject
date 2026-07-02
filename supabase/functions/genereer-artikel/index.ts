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

Doelgroep: zzp'ers en zelfstandig professionals in Nederland die snel de kern willen begrijpen.

Toon:
- Helder, deskundig, toegankelijk en menselijk Nederlands.
- Niet formeel of afstandelijk, maar ook niet populair.
- Schrijf zoals een goede Nederlandse redacteur: natuurlijk en organisch.

Strikte stijlregels (belangrijk):
- Gebruik NOOIT em-dashes (—). Gebruik in plaats daarvan een komma, punt of losse zin.
- Gebruik NOOIT opgeklopte AI-clichés zoals "in de snel veranderende wereld van vandaag", "duik in", "ontdek de kracht van", "revolutionair", "cruciaal" of "essentieel" als opsmuk.
- Geen emoji.
- Schrijf de bedrijfsnaam altijd als "ZP Zaken" (twee woorden, hoofdletters Z en P en Z).
- Vermijd Engelse termen als er een gewone Nederlandse variant is.

Formaat:
- Lever het artikel in Markdown: koppen (## en ###), korte alinea's, opsommingen waar dat helpt.
- Begin met een korte pakkende inleiding, geen H1 (die volgt uit de titel).
- Sluit af met een korte praktische afronding.

Je krijgt een onderwerp aangereikt en levert je antwoord ALLEEN als geldige JSON, zonder omliggende tekst, code fences of uitleg. Het JSON-schema:
{
  "title": string,             // pakkende, feitelijke titel (max ~70 tekens)
  "content": string,           // volledig artikel in Markdown
  "excerpt": string,           // korte samenvatting van 1-2 zinnen (max ~200 tekens)
  "seo_title": string,         // SEO-titel voor Google (50-60 tekens)
  "seo_description": string,   // wervende meta-omschrijving (150-160 tekens)
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
      `Schrijf een Kennisbank-artikel voor ZP Zaken over: ${onderwerp}`,
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
