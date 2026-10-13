// Upload KVK-uittreksel bij startertarief (A12 aangevuld). Alleen schrijven; lezen kan alleen het team via signed URL.
// Bestandsnaam = uuid, geen klantgegevens. Gebonden aan het concept-id van de aanvraag. Niets wordt verwijderd of overschreven.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guardPublicSubmission } from "../_shared/antiSpam.ts";
import { controleerUittreksel, extVoorMime, UITTREKSEL_MAX_BYTES } from "../_shared/kvkUittreksel.ts";
import { resolveEnvironment } from "../_shared/environment.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Extra verdediging: bucket privé, alleen pdf/jpg/png, max 10 MB. Eén keer per instantie, idempotent; fout laat de upload niet falen.
let bucketIngesteld = false;
async function zorgBucketInstelling(admin: ReturnType<typeof createClient>) {
  if (bucketIngesteld) return;
  const { error } = await admin.storage.updateBucket("kvk-uittreksels", {
    public: false, allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"], fileSizeLimit: UITTREKSEL_MAX_BYTES,
  });
  if (error) console.error("bucket-instelling mislukt:", error.message); else bucketIngesteld = true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  await zorgBucketInstelling(admin);
  let form: FormData;
  try { form = await req.formData(); } catch (_) { return json({ ok: false, error: "Ongeldig verzoek." }, 400); }
  const guard = await guardPublicSubmission(req, admin, { kind: "kvk-uittreksel", hp: form.get("hp") ?? "" });
  if (!guard.ok) return json({ ok: false, error: guard.error }, guard.status ?? 400);
  const conceptId = String(form.get("concept_id") ?? "");
  if (!UUID.test(conceptId)) return json({ ok: false, error: "Ongeldig verzoek." }, 400);
  const bestand = form.get("bestand");
  if (!(bestand instanceof File)) return json({ ok: false, error: "Geen bestand ontvangen." }, 400);
  if (bestand.size > UITTREKSEL_MAX_BYTES) return json({ ok: false, error: "Het bestand is groter dan 10 MB." }, 400);
  const bytes = new Uint8Array(await bestand.arrayBuffer());
  const c = controleerUittreksel(bestand.name, bytes.length, bytes.subarray(0, 16));
  if (c.ok === false) return json({ ok: false, error: c.fout }, 400);
  const id = crypto.randomUUID();
  const pad = `${id}.${extVoorMime(c.mime)}`;
  const { error: upErr } = await admin.storage.from("kvk-uittreksels").upload(pad, bytes, { contentType: c.mime, upsert: false });
  if (upErr) { console.error("uittreksel upload mislukt:", upErr.message); return json({ ok: false, error: "Uploaden lukte niet. Probeer het opnieuw." }, 500); }
  const { error } = await admin.from("kvk_uittreksels").insert({ id, concept_id: conceptId, pad, mime: c.mime, grootte: bytes.length, is_test: !resolveEnvironment(req).isProduction });
  if (error) { console.error("uittreksel registreren mislukt:", error.message); return json({ ok: false, error: "Uploaden lukte niet. Probeer het opnieuw." }, 500); }
  return json({ ok: true, uittreksel_id: id });
});
