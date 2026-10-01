// Chatassistent Zeker. De server is de bron van waarheid voor de geschiedenis:
// de browser stuurt alleen sessie-id + nieuw bericht. Streaming via SSE.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { clientIp } from "../_shared/antiSpam.ts";
import { resolveEnvironment } from "../_shared/environment.ts";
import {
  bouwGeschiedenis, bouwSysteemPrompt, isFrustratie, isToegestaneOrigin, maskeerGevoelig,
  normaliseerActies, normaliseerTaal, rateLimitBeslissing, schoonAntwoord,
  ZEKER_MAX_BEURTEN, ZEKER_MAX_TEKENS, ZEKER_MAX_TOKENS, ZEKER_STANDAARD_GESPREKKEN_PER_DAG,
  ZEKER_STANDAARD_MODEL, ZEKER_TOOL, type ZekerActie,
} from "../_shared/zeker.ts";

const MODEL = Deno.env.get("ZEKER_MODEL") || ZEKER_STANDAARD_MODEL;
const MAX_PER_DAG = Number(Deno.env.get("ZEKER_MAX_GESPREKKEN_PER_DAG") || ZEKER_STANDAARD_GESPREKKEN_PER_DAG);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && isToegestaneOrigin(origin) ? origin : "https://zpzaken.nl",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

const FOUT: Record<string, string> = {
  nl: "Sorry, dat lukt me nu even niet. Je kunt ons bellen op 020 - 457 3077, een WhatsApp sturen of mailen naar info@zpzaken.nl.",
  en: "Sorry, I can't help right now. You can call us on +31 20 457 3077, send a WhatsApp or email info@zpzaken.nl.",
  de: "Entschuldigung, das klappt gerade nicht. Rufen Sie uns an unter +31 20 457 3077, schreiben Sie per WhatsApp oder an info@zpzaken.nl.",
  fr: "Désolé, je ne peux pas vous aider pour le moment. Appelez-nous au +31 20 457 3077, envoyez un WhatsApp ou écrivez à info@zpzaken.nl.",
};
const DRUK: Record<string, string> = {
  nl: "Het is op dit moment erg druk in de chat. Neem gerust direct contact met ons op, dan helpen we je persoonlijk verder.",
  en: "The chat is very busy right now. Please contact us directly and we'll help you personally.",
  de: "Im Chat ist gerade viel los. Kontaktieren Sie uns gern direkt, wir helfen Ihnen persönlich weiter.",
  fr: "Le chat est très sollicité en ce moment. Contactez-nous directement et nous vous aiderons personnellement.",
};
const EINDE: Record<string, string> = {
  nl: "Dit gesprek is erg lang geworden. Start gerust een nieuw gesprek, of neem direct contact met ons op.",
  en: "This conversation has become very long. Feel free to start a new one or contact us directly.",
  de: "Dieses Gespräch ist sehr lang geworden. Starten Sie gern ein neues oder kontaktieren Sie uns direkt.",
  fr: "Cette conversation est devenue très longue. Commencez-en une nouvelle ou contactez-nous directement.",
};
const CONTACT_ACTIES: ZekerActie[] = ["terugbelformulier", "bellen", "whatsapp"];

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...headers, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ fout: "niet_toegestaan" }, 405);
  if (!isToegestaneOrigin(origin)) return json({ fout: "niet_toegestaan" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ fout: "ongeldig" }, 400); }
  const taal = normaliseerTaal(body?.taal);
  const actie = String(body?.actie ?? "bericht");
  const sessieId = typeof body?.sessieId === "string" && UUID_RE.test(body.sessieId) ? body.sessieId : null;

  try {
    if (actie === "geschiedenis") {
      if (!sessieId) return json({ berichten: [] });
      const { data } = await supabase.from("chat_messages").select("id, rol, tekst, acties, feedback, created_at")
        .eq("sessie_id", sessieId).order("created_at").limit(80);
      return json({ berichten: data ?? [] });
    }

    if (actie === "feedback") {
      const berichtId = typeof body?.berichtId === "string" && UUID_RE.test(body.berichtId) ? body.berichtId : null;
      const waarde = body?.waarde === 1 || body?.waarde === -1 ? body.waarde : null;
      if (!sessieId || !berichtId) return json({ fout: "ongeldig" }, 400);
      await supabase.from("chat_messages").update({ feedback: waarde })
        .eq("id", berichtId).eq("sessie_id", sessieId).eq("rol", "assistant");
      return json({ ok: true });
    }

    if (actie !== "bericht") return json({ fout: "ongeldig" }, 400);

    const ruw = typeof body?.tekst === "string" ? body.tekst.trim() : "";
    if (!ruw) return json({ fout: "leeg" }, 400);
    if (ruw.length > ZEKER_MAX_TEKENS) return json({ fout: "te_lang", tekst: `Je bericht is te lang (maximaal ${ZEKER_MAX_TEKENS} tekens).` }, 400);

    const pepper = Deno.env.get("INTERNAL_FUNCTION_SECRET") ?? "zeker";
    const ipHash = await sha256(`${pepper}|${clientIp(req)}`);
    const uaHash = await sha256(`${pepper}|${req.headers.get("user-agent") ?? ""}`);

    // Rate limit per IP-hash.
    const nu = Date.now();
    const [{ count: c10 }, { count: cDag }] = await Promise.all([
      supabase.from("chat_rate_limit").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(nu - 10 * 60_000).toISOString()),
      supabase.from("chat_rate_limit").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(nu - 24 * 3600_000).toISOString()),
    ]);
    const rl = rateLimitBeslissing({ laatste10Min: c10 ?? 0, vandaag: cDag ?? 0 });
    if (!rl.ok) return json({ fout: "limiet", tekst: DRUK[taal], acties: CONTACT_ACTIES }, 429);
    await supabase.from("chat_rate_limit").insert({ ip_hash: ipHash });

    // Sessie ophalen of aanmaken (met dagplafond).
    let sessie: { id: string; aantal_berichten: number; startpagina: string | null } | null = null;
    if (sessieId) {
      const { data } = await supabase.from("chat_sessions").select("id, aantal_berichten, startpagina").eq("id", sessieId).maybeSingle();
      sessie = data;
    }
    if (!sessie) {
      const begin = new Date(); begin.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase.from("chat_sessions").select("id", { count: "exact", head: true }).gte("created_at", begin.toISOString());
      if ((count ?? 0) >= MAX_PER_DAG) return json({ fout: "plafond", tekst: DRUK[taal], acties: CONTACT_ACTIES }, 429);
      const pagina = typeof body?.pagina === "string" ? body.pagina.slice(0, 200) : null;
      const { data, error } = await supabase.from("chat_sessions").insert({
        taal, startpagina: pagina, ip_hash: ipHash, ua_hash: uaHash, is_test: !resolveEnvironment(req).isProduction,
      }).select("id, aantal_berichten, startpagina").single();
      if (error || !data) throw new Error("sessie_aanmaken");
      sessie = data;
    }
    if (sessie.aantal_berichten >= ZEKER_MAX_BEURTEN * 2) {
      return json({ fout: "einde", tekst: EINDE[taal], acties: CONTACT_ACTIES, sessieId: sessie.id }, 200);
    }

    const { tekst, gemaskeerd } = maskeerGevoelig(ruw);
    const { data: eerder } = await supabase.from("chat_messages").select("rol, tekst").eq("sessie_id", sessie.id).order("created_at").limit(80);
    await supabase.from("chat_messages").insert({ sessie_id: sessie.id, rol: "user", tekst });

    const { data: artikelen } = await supabase.rpc("zeker_zoek_artikelen", { _q: tekst.slice(0, 300) });
    const system = bouwSysteemPrompt({ taal, artikelen: (artikelen ?? []) as any, pagina: sessie.startpagina });
    const messages = bouwGeschiedenis((eerder ?? []) as any, gemaskeerd ? `${tekst}\n\n(Systeem: de bezoeker deelde gevoelige gegevens; die zijn verwijderd. Waarschuw vriendelijk.)` : tekst);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("config");
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: ZEKER_MAX_TOKENS, system, messages, tools: [ZEKER_TOOL], stream: true }),
    });
    if (!upstream.ok || !upstream.body) {
      console.error("zeker-chat upstream", upstream.status, (await upstream.text().catch(() => "")).slice(0, 300));
      throw new Error("upstream");
    }

    const sid = sessie.id;
    const startAantal = sessie.aantal_berichten;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        const send = (o: unknown) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        send({ type: "sessie", id: sid });
        let antwoord = "";
        let toolJson = "";
        let inTool = false;
        try {
          const reader = upstream.body!.pipeThrough(new TextDecoderStream()).getReader();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += value;
            let idx;
            while ((idx = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1);
              if (!line.startsWith("data:")) continue;
              let ev: any; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
              if (ev.type === "content_block_start") inTool = ev.content_block?.type === "tool_use";
              else if (ev.type === "content_block_delta") {
                if (ev.delta?.type === "text_delta" && !inTool) {
                  const d = schoonAntwoord(ev.delta.text ?? "");
                  antwoord += d; if (d) send({ type: "delta", tekst: d });
                } else if (ev.delta?.type === "input_json_delta") toolJson += ev.delta.partial_json ?? "";
              } else if (ev.type === "content_block_stop") inTool = false;
            }
          }
          antwoord = schoonAntwoord(antwoord).trim();
          let { acties, sector } = normaliseerActies(toolJson ? (() => { try { return JSON.parse(toolJson); } catch { return {}; } })() : {});
          if (isFrustratie(tekst)) acties = [...new Set([...acties, ...CONTACT_ACTIES])].slice(0, 4) as ZekerActie[];
          if (!antwoord) { antwoord = FOUT[taal]; send({ type: "delta", tekst: antwoord }); if (!acties.length) acties = CONTACT_ACTIES; }
          const actiesObj = acties.length ? { acties, sector: sector ?? null } : null;
          const { data: rij } = await supabase.from("chat_messages").insert({ sessie_id: sid, rol: "assistant", tekst: antwoord, acties: actiesObj }).select("id").single();
          await supabase.from("chat_sessions").update({ aantal_berichten: startAantal + 2, laatste_bericht_op: new Date().toISOString() }).eq("id", sid);
          if (actiesObj) send({ type: "acties", ...actiesObj });
          send({ type: "klaar", berichtId: rij?.id ?? null });
        } catch (e) {
          console.error("zeker-chat stream", e instanceof Error ? e.message : e);
          send({ type: "fout", tekst: FOUT[taal], acties: CONTACT_ACTIES });
        } finally {
          ctrl.close();
        }
      },
    });
    return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (e) {
    console.error("zeker-chat", e instanceof Error ? e.message : e);
    return json({ fout: "storing", tekst: FOUT[taal], acties: CONTACT_ACTIES }, 200);
  }
});
