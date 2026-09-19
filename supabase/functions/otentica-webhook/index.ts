// Otentica webhook endpoint.
//
// SECURITY: een screeningstatus mag alleen wijzigen als de aanroep aantoonbaar
// van Otentica komt. Daarom fail-closed verificatie van de afzender:
//   - HMAC-SHA256 over de ruwe body met OTENTICA_WEBHOOK_SECRET in
//     header x-otentica-signature (hex of "sha256=<hex>"), OF
//   - de shared secret zelf in header x-otentica-secret (voor providers
//     zonder signing-ondersteuning).
// Ontbreekt het secret in de omgeving, of klopt de signature niet, dan
// gebeurt er niets en volgt 401/503.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-otentica-signature, x-otentica-secret",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("OTENTICA_WEBHOOK_SECRET") ?? "";
  if (!secret) {
    console.error("otentica-webhook: OTENTICA_WEBHOOK_SECRET ontbreekt — aanroep geweigerd");
    return json({ error: "webhook_not_configured" }, 503);
  }

  const rawBody = await req.text();

  const headerSignature = (req.headers.get("x-otentica-signature") ?? "")
    .trim()
    .replace(/^sha256=/i, "")
    .toLowerCase();
  const headerSecret = (req.headers.get("x-otentica-secret") ?? "").trim();

  let authorized = false;
  if (headerSignature) {
    authorized = timingSafeEqual(headerSignature, await hmacHex(secret, rawBody));
  } else if (headerSecret) {
    authorized = timingSafeEqual(headerSecret, secret);
  }

  if (!authorized) {
    console.warn("otentica-webhook: ongeldige of ontbrekende signature — niets gewijzigd");
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const payload = rawBody ? JSON.parse(rawBody) : {};
    console.log("Otentica webhook verified:", JSON.stringify(payload));

    // TODO: verwerking van Otentica callbacks (matchen op otentica_flow_id,
    // otentica_status updaten, rapport-url en webhook-data opslaan).
    // Pas hier wijzigingen toe — dit punt is alleen bereikbaar na verificatie.

    return json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    console.error("otentica-webhook error:", message);
    return json({ received: false, error: message }, 400);
  }
});
