import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { COMPANY } from "../_shared/company.ts";
import { autoInvitePortalLead } from "../_shared/portalAccess.ts";
import { createMailGate } from "../_shared/mail.ts";
import {
  bepaalHoedanigheid, beslisNieuwCertificaat, schoonAanpassing, kiesKlantCertificaatnummer, actiefKlantContract,
  FOOTER_REGISTER_TEKST, POLISBLAD_NOTITIE,
  magCertificaatBeheren,
} from "../_shared/certificaatRegels.ts";
import { brancheVoorSector } from "../_shared/sectorBranche.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isTeam } = await createClient(
      supabaseUrl,
      supabaseServiceKey
    ).rpc("is_team_member", { _user_id: user.id });
    if (!isTeam) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, policy_data } = body;
    const actie: "nieuw" | "aanpassen" | "intrekken" | "mailen" | "nummer_overnemen" = body.actie || "nieuw";
    const json = (b: unknown, status = 200) =>
      new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: rolRijen } = await adminClient.from("user_roles").select("role").eq("user_id", user.id);
    const isSupAdmin = magCertificaatBeheren((rolRijen || []).map((r: any) => r.role));

    let policy: any;
    let policyLead: any = null;
    let kvkNummerBron: string | null = null;

    if (actie !== "nieuw") {
      if (!isSupAdmin) return json({ error: "Alleen supervisor/admin/verzekering mag certificaten aanpassen, intrekken of mailen" }, 403);
      if (!body.policy_id) return json({ error: "policy_id vereist" }, 400);
      const { data: bestaand } = await adminClient.from("policies").select("*").eq("id", body.policy_id).maybeSingle();
      if (!bestaand) return json({ error: "Certificaat niet gevonden" }, 404);
      if (bestaand.status !== "geldig") return json({ error: "Dit certificaat is ingetrokken" }, 409);
      const oudeWaarden = {
        profession: bestaand.profession, certificate_holder: bestaand.certificate_holder,
        insured_name: bestaand.insured_name, start_date: bestaand.start_date,
        issued_date: bestaand.issued_date, versie: bestaand.versie, status: bestaand.status,
      };

      if (actie === "intrekken") {
        const reden = typeof body.reden === "string" ? body.reden.trim() : "";
        if (reden.length < 3) return json({ error: "Reden is verplicht" }, 400);
        const { error: vErr } = await adminClient.from("policy_versies").insert({
          policy_id: bestaand.id, certificate_number: bestaand.certificate_number, versie: bestaand.versie,
          actie: "ingetrokken", oude_waarden: oudeWaarden, nieuwe_waarden: { status: "ingetrokken" },
          oude_pdf_pad: bestaand.pdf_url, reden, uitgevoerd_door: user.id, uitgevoerd_door_email: user.email,
        });
        if (vErr) return json({ error: vErr.message }, 500);
        const { error: uErr } = await adminClient.from("policies").update({
          status: "ingetrokken", ingetrokken_op: new Date().toISOString(), ingetrokken_door: user.id, intrek_reden: reden,
        }).eq("id", bestaand.id);
        if (uErr) return json({ error: uErr.message }, 500);
        return json({ success: true, policy: { id: bestaand.id, certificate_number: bestaand.certificate_number, status: "ingetrokken" } });
      }

      if (actie === "nummer_overnemen") {
        // Omzetting vastgelegd: nummer vervangen door het overgenomen BAV-nummer en PDF opnieuw maken. Nooit mail.
        let oudePdfPad: string | null = null;
        if (bestaand.pdf_url) {
          oudePdfPad = `versies/${bestaand.certificate_number}-v${bestaand.versie}-vervangen-${Date.now()}.pdf`;
          const { error: cErr } = await adminClient.storage.from("certificates").copy(bestaand.pdf_url, oudePdfPad);
          if (cErr) return json({ error: `Oude PDF kon niet bewaard worden: ${cErr.message}` }, 500);
        }
        const { data: r, error: rErr } = await userClient.rpc("policy_nummer_overnemen", { _policy_id: bestaand.id, _oude_pdf_pad: oudePdfPad });
        if (rErr) return json({ error: rErr.message }, 409);
        const { data: upd } = await adminClient.from("policies").select("*").eq("id", bestaand.id).single();
        if (!(r as any)?.gewijzigd && upd?.pdf_url === `${upd?.certificate_number}.pdf`) {
          return json({ success: true, gewijzigd: false, policy: { id: upd.id, certificate_number: upd.certificate_number } });
        }
        policy = upd;
        if (bestaand.lead_id) {
          const { data: l } = await adminClient.from("leads").select("kvk_nummer").eq("id", bestaand.lead_id).maybeSingle();
          kvkNummerBron = l?.kvk_nummer ?? null;
        }
      } else if (actie === "mailen") {
        const r = await mailCertificaat(adminClient, req, bestaand, user);
        if (!r.ok) return json({ error: r.error }, 500);
        await adminClient.from("policy_versies").insert({
          policy_id: bestaand.id, certificate_number: bestaand.certificate_number, versie: bestaand.versie,
          actie: "gemaild", oude_waarden: oudeWaarden, nieuwe_waarden: { ontvanger: r.to },
          oude_pdf_pad: bestaand.pdf_url, uitgevoerd_door: user.id, uitgevoerd_door_email: user.email,
        });
        return json({ success: true, verzonden_naar: r.to, opmerking: r.opmerking });
      } else {
      // aanpassen: oude PDF als versie bewaren, waarden bijwerken, zelfde nummer opnieuw renderen
      const wijz = schoonAanpassing(body.wijzigingen || {});
      let oudePdfPad: string | null = null;
      if (bestaand.pdf_url) {
        oudePdfPad = `versies/${bestaand.certificate_number}-v${bestaand.versie}-${Date.now()}.pdf`;
        const { error: cErr } = await adminClient.storage.from("certificates").copy(bestaand.pdf_url, oudePdfPad);
        if (cErr) return json({ error: `Oude PDF kon niet bewaard worden: ${cErr.message}` }, 500);
      }
      const vandaag = new Date().toISOString().split("T")[0];
      const nieuw = { ...wijz, issued_date: vandaag, versie: bestaand.versie + 1 };
      const { error: vErr } = await adminClient.from("policy_versies").insert({
        policy_id: bestaand.id, certificate_number: bestaand.certificate_number, versie: bestaand.versie,
        actie: "aangepast", oude_waarden: oudeWaarden, nieuwe_waarden: nieuw, oude_pdf_pad: oudePdfPad,
        reden: typeof body.reden === "string" ? body.reden.trim() || null : null,
        uitgevoerd_door: user.id, uitgevoerd_door_email: user.email,
      });
      if (vErr) return json({ error: vErr.message }, 500);
      const { data: upd, error: uErr } = await adminClient.from("policies").update(nieuw).eq("id", bestaand.id).select().single();
      if (uErr) return json({ error: uErr.message }, 500);
      policy = upd;
      if (bestaand.lead_id) {
        const { data: l } = await adminClient.from("leads").select("kvk_nummer").eq("id", bestaand.lead_id).maybeSingle();
        kvkNummerBron = l?.kvk_nummer ?? null;
      } else if (bestaand.onderneming_id) {
        const { data: o } = await adminClient.from("ondernemingen").select("kvk").eq("id", bestaand.onderneming_id).maybeSingle();
        kvkNummerBron = o?.kvk ?? null;
      }
      }
    } else if (body.onderneming_id) {
      // Bestaande klant (geïmporteerd, zonder lead): eigen nummer hergebruiken.
      if (!isSupAdmin) return json({ error: "Alleen supervisor/admin/verzekering mag certificaten genereren voor klanten" }, 403);
      const ondId = String(body.onderneming_id);
      const vandaag = new Date().toISOString().split("T")[0];
      const { data: ond } = await adminClient.from("ondernemingen").select("id,naam,kvk").eq("id", ondId).maybeSingle();
      if (!ond) return json({ error: "Klant niet gevonden" }, 404);
      const { data: kc } = await adminClient.from("klant_contracten").select("type,status,eind_datum,begin_datum,product").eq("onderneming_id", ondId);
      if (!actiefKlantContract(kc || [], vandaag)) return json({ error: "Deze klant heeft geen actief verzekeringscontract (opgezegd of afgelopen). Genereren is geblokkeerd.", code: "niet_actief" }, 409);
      const { data: bestaande } = await adminClient.from("policies").select("certificate_number,status").eq("onderneming_id", ondId);
      const besluit = beslisNieuwCertificaat(bestaande || [], body.bevestig_nieuw_nummer === true);
      if (!besluit.toegestaan) return json({ error: `Deze klant heeft al geldig certificaat ${besluit.bestaand}. Gebruik "Aanpassen".`, code: besluit.code, bestaand: besluit.bestaand }, 409);
      const heeftGeldig = (bestaande || []).some((p) => p.status === "geldig");
      let nummer = "";
      if (!heeftGeldig) {
        const { data: certs } = await adminClient.from("klant_certificaten").select("certificaatnummer,aanvraagdatum,koppeling_status").eq("onderneming_id", ondId);
        const k = kiesKlantCertificaatnummer(certs || []);
        if (k.soort === "bestaand") {
          const { data: botsing } = await adminClient.from("policies").select("id,onderneming_id,lead_id").eq("certificate_number", k.nummer).maybeSingle();
          if (botsing) return json({ error: `Nummer ${k.nummer} staat al op een ander certificaat in het systeem. Neem contact op met Boy.`, code: "nummer_bezet" }, 409);
          nummer = k.nummer;
        } else if (body.bevestig_nieuw_nummer !== true) {
          return json({ error: "Deze klant heeft nog geen certificaatnummer. Bevestig om een nieuw nummer uit te geven.", code: "geen_nummer" }, 409);
        }
      }
      const pd = policy_data || {};
      const tekst = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 200) : "");
      const sector = tekst(pd.sector);
      const profession = brancheVoorSector(sector) ?? "";
      if (!profession) return json({ error: "Kies een geldige branche/vak" }, 400);
      const holder = tekst(pd.certificate_holder) || ond.naam || "";
      const insured = tekst(pd.insured_name);
      const start = /^\d{4}-\d{2}-\d{2}$/.test(tekst(pd.start_date)) ? tekst(pd.start_date) : "";
      if (!profession || !holder || !insured || !start) return json({ error: "Branche, certificaathouder, verzekeringsnemer en ingangsdatum zijn verplicht" }, 400);
      const { data: prof } = await adminClient.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      kvkNummerBron = tekst(pd.kvk) || ond.kvk || null;
      const { data: ins, error: insErr } = await adminClient.from("policies").insert({
        onderneming_id: ondId, lead_id: null, certificate_number: nummer,
        certificate_holder: holder, insured_name: insured, start_date: start, profession,
        package_type: tekst(pd.package_type) || "BAV & AVB Jaarlijks",
        bav_per_event: "€ 5.000.000", bav_per_year: "€ 15.000.000", avb_per_event: "€ 2.500.000", avb_per_year: "€ 5.000.000",
        issued_by: prof?.full_name || user.email || "ZP Zaken", issued_date: vandaag,
      }).select().single();
      if (insErr) return json({ error: "Certificaat opslaan mislukt", details: insErr.message }, 500);
      await adminClient.from("ondernemingen").update({ branche: profession, sector }).eq("id", ondId);
      policy = ins;
    } else {
      if (!isSupAdmin) return json({ error: "Alleen supervisor/admin/verzekering mag certificaten genereren" }, 403);
      if (!lead_id && !policy_data) return json({ error: "lead_id or policy_data required" }, 400);
      let data = policy_data;
      if (lead_id) {
        // Open omzettingsvoorstel: eerst beslissen, anders zou een nieuw nummer worden uitgegeven.
        const { data: oz } = await userClient.rpc("omzetting_kandidaten", { _lead_id: lead_id });
        if (((oz as any)?.kandidaten ?? []).some((k: any) => !k.beslissing)) {
          return json({ error: "Beslis eerst over de omzetting", code: "omzetting_open" }, 409);
        }
        const { data: bestaande } = await adminClient.from("policies").select("certificate_number,status").eq("lead_id", lead_id);
        const besluit = beslisNieuwCertificaat(bestaande || [], body.bevestig_nieuw_nummer === true);
        if (!besluit.toegestaan) {
          return json({ error: `Deze lead heeft al geldig certificaat ${besluit.bestaand}. Gebruik "Aanpassen".`, code: besluit.code, bestaand: besluit.bestaand }, 409);
        }
        if (body.bevestig_nieuw_nummer === true && (bestaande || []).some((p) => p.status === "geldig") && !isSupAdmin) {
          return json({ error: "Alleen supervisor/admin/verzekering mag een extra certificaatnummer uitgeven" }, 403);
        }
      }
      if (lead_id && !data) {
        const { data: lead, error: leadError } = await adminClient.from("leads").select("*").eq("id", lead_id).maybeSingle();
        if (leadError || !lead) return json({ error: "Lead not found" }, 404);
        data = {
          certificate_holder: lead.bedrijfsnaam || `${lead.voornaam} ${lead.achternaam}`,
          insured_name: `${lead.voornaam} ${lead.achternaam}`,
          start_date: lead.ingangsdatum || new Date().toISOString().split("T")[0],
          profession: bepaalHoedanigheid(lead),
          package_type: lead.verzekering_type || "BAV & AVB Jaarlijks",
          kvk: lead.kvk_nummer || null,
        };
      }
      kvkNummerBron = data?.kvk ?? null;
      const { data: ins, error: policyError } = await adminClient.from("policies").insert({
        lead_id: lead_id || null,
        certificate_number: "",
        certificate_holder: data.certificate_holder,
        insured_name: data.insured_name,
        start_date: data.start_date,
        profession: data.profession,
        package_type: data.package_type || "BAV & AVB Jaarlijks",
        bav_per_event: data.bav_per_event || "€ 5.000.000",
        bav_per_year: data.bav_per_year || "€ 15.000.000",
        avb_per_event: data.avb_per_event || "€ 2.500.000",
        avb_per_year: data.avb_per_year || "€ 5.000.000",
        issued_by: data.issued_by || "Ellen Baars",
      }).select().single();
      if (policyError) {
        console.error("Policy insert error:", policyError);
        return json({ error: "Failed to create policy", details: policyError.message }, 500);
      }
      policy = ins;
    }
    if (policy?.lead_id) {
      const { data: leadVoorPolis } = await adminClient.from("leads")
        .select("gekozen_pakket,cyber_voorwaarden_versie,cyber_ingangsdatum,cyber_einddatum")
        .eq("id", policy.lead_id).maybeSingle();
      policyLead = leadVoorPolis;
    }
    const heeftNieuweCyber = policyLead?.cyber_voorwaarden_versie === "2026-10-08";

    // === Load the template background image from storage (private bucket) ===
    const { data: templateData, error: templateError } = await adminClient.storage
      .from("certificates")
      .download("templates/certificate-template.png");
    if (templateError || !templateData) {
      console.error("Failed to load template:", templateError);
      return new Response(
        JSON.stringify({ error: "Failed to load certificate template" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const templateBytes = new Uint8Array(await templateData.arrayBuffer());

    // === Create PDF with template as background ===
    const pdfDoc = await PDFDocument.create();
    const templateImage = await pdfDoc.embedPng(templateBytes);

    // A4 dimensions
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Draw template as full-page background
    page.drawImage(templateImage, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
    });

    // === Embed fonts ===
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helveticaOblique = await pdfDoc.embedFont(
      StandardFonts.HelveticaOblique
    );

    const black = rgb(0, 0, 0);
    const gray = rgb(0.35, 0.35, 0.35);
    const brandRed = rgb(0.76, 0.07, 0.16); // #c2122a

    // === Position constants ===
    // Based on the original template: labels start at x=56, values at x=195
    // The template image already has the logo, titles, decorative elements, and footer
    // We only need to place the dynamic field values

    const labelX = 56;
    const valueX = 195;
    const fontSize = 9;
    const smallFontSize = 7.5;
    const lineHeight = 13;

    // Format date short: "08-12-2025"
    const formatShortDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // Format date long: "vrijdag 5 december 2025"
    const formatLongDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const days = [
        "zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag",
      ];
      const months = [
        "januari", "februari", "maart", "april", "mei", "juni",
        "juli", "augustus", "september", "oktober", "november", "december",
      ];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    // Helper: wrap text to fit within maxWidth (in PDF points)
    const wrapText = (text: string, font: typeof helvetica, size: number, maxWidth: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Helper: draw a label + value row
    const drawRow = (
      label: string,
      value: string,
      yPos: number,
      options?: {
        boldValue?: boolean;
        valueColor?: typeof black;
        valueFont?: typeof helvetica;
        valueFontSize?: number;
      }
    ) => {
      // Draw label
      page.drawText(label, {
        x: labelX,
        y: yPos,
        size: fontSize,
        font: helvetica,
        color: gray,
      });

      // Draw value (supports multiline with \n)
      const lines = value.split("\n");
      const font = options?.valueFont || (options?.boldValue ? helveticaBold : helvetica);
      const color = options?.valueColor || black;
      const size = options?.valueFontSize || fontSize;
      lines.forEach((line: string, i: number) => {
        page.drawText(line, {
          x: valueX,
          y: yPos - i * lineHeight,
          size,
          font,
          color,
        });
      });
    };

    // =================================================================
    // FIELD POSITIONS - measured from the original filled template
    // Y coordinates are from bottom of page (PDF coordinate system)
    // The template PNG is 1654x2339 pixels, mapped to 595.28x841.89 pts
    // =================================================================

    // Certificaathouder: lowered to avoid overlapping with template header
    let y = 590;
    drawRow("Certificaathouder:", policy.certificate_holder, y);

    // KvK (alleen tonen als ingevuld op de lead)
    const kvkNummer = typeof kvkNummerBron === "string" ? kvkNummerBron.trim() : "";
    if (kvkNummer) {
      y -= 16;
      drawRow("KvK:", kvkNummer, y);
    }

    // Verzekeringsnemer:
    y -= 16;
    drawRow("Verzekeringsnemer:", policy.insured_name, y);

    // Certificaatnummer (bold)
    y -= 22;
    drawRow("Certificaatnummer:", policy.certificate_number, y, {
      boldValue: true,
    });

    // Ingangsdatum
    y -= 20;
    drawRow("Ingangsdatum:", formatShortDate(policy.start_date), y, {
      boldValue: true,
    });

    // Hoedanigheid
    y -= 20;
    drawRow("Hoedanigheid:", policy.profession, y);

    // Verzekerde bedragen section
    y -= 24;
    page.drawText("Verzekerde bedragen:", {
      x: labelX,
      y,
      size: fontSize,
      font: helvetica,
      color: gray,
    });

    // Beroepsaansprakelijkheid header
    page.drawText("Beroepsaansprakelijkheid", {
      x: valueX,
      y,
      size: fontSize,
      font: helveticaBold,
      color: brandRed,
    });

    y -= lineHeight;
    page.drawText(`${policy.bav_per_event}, - per aanspraak`, {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    y -= lineHeight;
    page.drawText(`${policy.bav_per_year}, - per verzekeringsjaar`, {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    // Bedrijfsaansprakelijkheid header
    y -= lineHeight + 5;
    page.drawText("Bedrijfsaansprakelijkheid", {
      x: valueX,
      y,
      size: fontSize,
      font: helveticaBold,
      color: brandRed,
    });

    y -= lineHeight;
    page.drawText(`${policy.avb_per_event}, - per aanspraak`, {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    y -= lineHeight;
    page.drawText(`${policy.avb_per_year}, - per verzekeringsjaar`, {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    // Italicized note
    y -= lineHeight + 5;
    const maxValueWidth = pageWidth - valueX - 40; // right margin of 40pt
    const noteText = POLISBLAD_NOTITIE;
    const noteLines = wrapText(noteText, helveticaOblique, smallFontSize, maxValueWidth);
    noteLines.forEach((line: string, i: number) => {
      page.drawText(line, {
        x: valueX,
        y: y - i * 10,
        size: smallFontSize,
        font: helveticaOblique,
        color: gray,
      });
    });
    y -= (noteLines.length - 1) * 10;

    // Eigen risico
    y -= 20;
    drawRow(
      "Eigen risico:",
      heeftNieuweCyber ? "BAV + AVB: geen. Cyber: EUR 500 (fraude EUR 1.000)." : "geen",
      y
    );

    // Polisvoorwaarden
    y -= 22;
    page.drawText("Polisvoorwaarden:", {
      x: labelX,
      y,
      size: fontSize,
      font: helvetica,
      color: gray,
    });
    page.drawText("Informatie en Communicatie Technologie", {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    // Checkmark items - draw small checkbox with checkmark + text
    const drawCheckItem = (text: string, yPos: number) => {
      const boxX = valueX;
      const boxY = yPos - 1.5;
      const boxSize = 7;
      // Checkbox border
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: brandRed,
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });
      // Checkmark V
      page.drawLine({
        start: { x: boxX + 1.2, y: boxY + 3.5 },
        end: { x: boxX + 2.8, y: boxY + 1.2 },
        thickness: 1,
        color: brandRed,
      });
      page.drawLine({
        start: { x: boxX + 2.8, y: boxY + 1.2 },
        end: { x: boxX + 5.8, y: boxY + 5.8 },
        thickness: 1,
        color: brandRed,
      });
      // Label text
      page.drawText(text, {
        x: valueX + 11,
        y: yPos,
        size: 8,
        font: helvetica,
        color: brandRed,
      });
    };

    y -= lineHeight + 2;
    drawCheckItem("Voorwaarden beroepsaansprakelijkheid", y);
    y -= lineHeight;
    drawCheckItem(
      "Voorwaarden bedrijfsaansprakelijkheid (kantoorrisico)",
      y
    );
    y -= lineHeight;
    drawCheckItem("Verzekeringskaart", y);

    // Dekkingsgebied
    y -= 20;
    const dekkingText = policy.coverage_area || "De verzekering biedt dekking ongeacht waar in de EU het handelen en/of nalaten zich heeft voorgedaan.";
    const dekkingLines = wrapText(dekkingText, helvetica, fontSize, maxValueWidth);
    page.drawText("Dekkingsgebied:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
    dekkingLines.forEach((line: string, i: number) => {
      page.drawText(line, { x: valueX, y: y - i * lineHeight, size: fontSize, font: helvetica, color: black });
    });
    y -= (dekkingLines.length - 1) * lineHeight;

    // Contractduur
    y -= 20;
    const contractText = heeftNieuweCyber
      ? `BAV + AVB doorlopend, zonder minimale looptijd, dagelijks opzegbaar. Cyber 12 maanden, daarna telkens 12 maanden verlengd; lopend cyberjaar t/m ${formatShortDate(policyLead.cyber_einddatum)}.`
      : "Doorlopend, zonder minimale looptijd, dagelijks opzegbaar.";
    const contractLines = wrapText(contractText, helvetica, fontSize, maxValueWidth);
    page.drawText("Contractduur:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
    contractLines.forEach((line: string, i: number) => {
      page.drawText(line, { x: valueX, y: y - i * lineHeight, size: fontSize, font: helvetica, color: black });
    });
    y -= (contractLines.length - 1) * lineHeight;

    // Tussenpersoon
    y -= 16 + lineHeight;
    page.drawText("Tussenpersoon:", {
      x: labelX,
      y,
      size: fontSize,
      font: helvetica,
      color: gray,
    });
    page.drawText("ZP Zaken.", {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });
    y -= lineHeight;
    page.drawText(`AFM vergunningnummer: ${COMPANY.registrations.afm}`, {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });

    // Afgiftedatum
    y -= 20;
    drawRow("Afgiftedatum:", formatLongDate(policy.issued_date), y, {
      boldValue: true,
    });

    // Voor gezien ZP Zaken
    y -= 20;
    drawRow("Voor gezien ZP Zaken:", policy.issued_by, y);

    // === Cover template footer with white rectangle ===
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: 120,
      color: rgb(1, 1, 1),
    });

    // === Footer text ===
    const footerText1 = "De verzekeringsmantel van ZP Zaken zijn alleen toegankelijk voor klanten van ZP Zaken en treedt hierbij op geen enkele";
    const footerText2 = "wijze op als financiële dienstverlener of bemiddelaar zoals gesteld onder de Wft. De verstrekte gegevens zullen strikt";
    const footerText3 = `vertrouwelijk worden behandeld. ${FOOTER_REGISTER_TEKST} ${COMPANY.registrations.afm}.`;
    const footerFontSize = 6.5;
    const footerY = 38;

    page.drawText(footerText1, { x: labelX, y: footerY + 16, size: footerFontSize, font: helvetica, color: gray });
    page.drawText(footerText2, { x: labelX, y: footerY + 8, size: footerFontSize, font: helvetica, color: gray });
    page.drawText(footerText3, { x: labelX, y: footerY, size: footerFontSize, font: helvetica, color: gray });

    // === Save & upload PDF ===
    const pdfBytes = await pdfDoc.save();
    const fileName = `${policy.certificate_number}.pdf`;

    const pdfBlob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
    const { error: uploadError } = await adminClient.storage
      .from("certificates")
      .upload(fileName, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({
          error: "Failed to upload PDF",
          details: uploadError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: signedUrlData } = await adminClient.storage
      .from("certificates")
      .createSignedUrl(fileName, 3600);

    await adminClient
      .from("policies")
      .update({ pdf_url: fileName })
      .eq("id", policy.id);

    // Automatische Mijn ZP-uitnodiging (alleen als de lead ook al geactiveerd is
    // en nog nooit is uitgenodigd). Mag het certificaat nooit laten mislukken.
    let portaal_uitnodiging: unknown = null;
    if (lead_id && actie === "nieuw") {
      portaal_uitnodiging = await autoInvitePortalLead(adminClient, req, lead_id, user.id, "generate-certificate")
        .catch((e) => ({ verstuurd: false, error: String(e) }));
    }

    return new Response(
      JSON.stringify({
        success: true,
        policy: {
          id: policy.id,
          certificate_number: policy.certificate_number,
          pdf_url: signedUrlData?.signedUrl || null,
          pdf_path: fileName,
        },
        portaal_uitnodiging,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
// Handmatig, op verzoek van het team: certificaat-PDF als bijlage naar de klant.
// deno-lint-ignore no-explicit-any
async function mailCertificaat(admin: any, req: Request, policy: any, user: { id: string }) {
  if (!policy.pdf_url) return { ok: false as const, error: "Geen PDF beschikbaar" };
  const { data: lead } = policy.lead_id
    ? await admin.from("leads").select("email,voornaam").eq("id", policy.lead_id).maybeSingle()
    : { data: null };
  let email = lead?.email?.trim();
  let voornaam = lead?.voornaam;
  if (!email && policy.onderneming_id) {
    const { data: po } = await admin.from("persoon_onderneming").select("personen(voornaam,email_weergave)").eq("onderneming_id", policy.onderneming_id);
    const p = (po || []).map((x: any) => x.personen).find((x: any) => x?.email_weergave);
    email = p?.email_weergave?.trim(); voornaam = p?.voornaam;
  }
  if (!email) return { ok: false as const, error: "Geen e-mailadres bij deze lead/klant" };
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false as const, error: "Mailinstelling ontbreekt" };
  const { data: file, error } = await admin.storage.from("certificates").download(policy.pdf_url);
  if (error || !file) return { ok: false as const, error: "PDF niet gevonden" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let b64 = "";
  for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  b64 = btoa(b64);
  const subject = `Je certificaat ${policy.certificate_number} – ZP Zaken`;
  const html = `<p>Beste ${voornaam || "klant"},</p><p>In de bijlage vind je je certificaat ${policy.certificate_number} voor je beroeps- en bedrijfsaansprakelijkheidsverzekering.</p><p>Met vriendelijke groet,<br/>ZP Zaken<br/>${COMPANY.phoneDisplay} · ${COMPANY.email}</p>`;
  const plan = createMailGate("generate-certificate", req).plan({ to: email, subject, html });
  const log = (status: string, extra: Record<string, unknown>) => admin.from("lead_notification_log").insert({
    lead_type: "certificaat", lead_id: policy.lead_id, recipient: email, subject, status,
    metadata: { soort: "certificaat_handmatig", certificate_number: policy.certificate_number, door: user.id, preview: !plan.send ? undefined : plan.to?.join(",") !== email },
    ...extra,
  });
  if (!plan.send) { await log("failed", { error_message: `niet verzonden: ${plan.reason}` }); return { ok: false as const, error: `Niet verzonden: ${plan.reason}` }; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: plan.from, to: plan.to, bcc: plan.bcc, subject: plan.subject, html: plan.html,
      attachments: [{ filename: `${policy.certificate_number}.pdf`, content: b64 }] }),
  });
  const rb = await res.json().catch(() => ({}));
  if (!res.ok) { await log("failed", { error_message: `Resend ${res.status}` }); return { ok: false as const, error: "Verzenden mislukt" }; }
  await log("sent", { resend_message_id: rb?.id ?? null });
  const naar = (plan.to || []).join(", ");
  return { ok: true as const, to: naar, opmerking: naar !== email ? "Preview: alleen naar het team verstuurd" : null };
}
