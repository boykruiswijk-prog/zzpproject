import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isTeam } = await createClient(supabaseUrl, supabaseServiceKey)
      .rpc("is_team_member", { _user_id: user.id });
    if (!isTeam) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, policy_data } = await req.json();
    if (!lead_id && !policy_data) {
      return new Response(JSON.stringify({ error: "lead_id or policy_data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let data = policy_data;
    if (lead_id && !data) {
      const { data: lead, error: leadError } = await adminClient
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .maybeSingle();
      if (leadError || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      data = {
        certificate_holder: lead.bedrijfsnaam || `${lead.voornaam} ${lead.achternaam}`,
        insured_name: `${lead.voornaam} ${lead.achternaam}`,
        start_date: lead.ingangsdatum || new Date().toISOString().split("T")[0],
        profession: lead.beroep || "Onbekend",
        package_type: lead.verzekering_type || "Combi Uitgebreid",
      };
    }

    // Insert policy record
    const { data: policy, error: policyError } = await adminClient
      .from("policies")
      .insert({
        lead_id: lead_id || null,
        certificate_number: "",
        certificate_holder: data.certificate_holder,
        insured_name: data.insured_name,
        start_date: data.start_date,
        profession: data.profession,
        package_type: data.package_type || "Combi Uitgebreid",
        bav_per_event: data.bav_per_event || "€ 5.000.000",
        bav_per_year: data.bav_per_year || "€ 15.000.000",
        avb_per_event: data.avb_per_event || "€ 2.500.000",
        avb_per_year: data.avb_per_year || "€ 5.000.000",
        issued_by: data.issued_by || "Michel Verheij",
      })
      .select()
      .single();

    if (policyError) {
      console.error("Policy insert error:", policyError);
      return new Response(JSON.stringify({ error: "Failed to create policy", details: policyError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Generate PDF matching exact ZP Zaken template ---
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const brandRed = rgb(0.76, 0.07, 0.16); // #c2122a
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.88, 0.88, 0.88);
    const watermarkGray = rgb(0.94, 0.94, 0.94);

    const leftMargin = 56;
    const labelX = leftMargin;
    const valueX = 200;
    const rightMargin = width - 56;

    // === WATERMARK DIAGONAL LINES (subtle background pattern) ===
    for (let i = -800; i < 1200; i += 18) {
      page.drawLine({
        start: { x: i, y: 0 },
        end: { x: i + height, y: height },
        thickness: 0.3,
        color: watermarkGray,
      });
    }

    let y = height - 50;

    // === LOGO ===
    // Draw hexagon/shield shape for ZP logo
    const logoX = leftMargin + 20;
    const logoY = y - 5;
    const logoSize = 20;
    // Simplified shield/hexagon as rounded rectangle
    page.drawRectangle({
      x: logoX - logoSize + 2,
      y: logoY - logoSize + 5,
      width: logoSize * 2 - 4,
      height: logoSize * 2 - 4,
      borderColor: brandRed,
      borderWidth: 1.8,
      color: rgb(1, 1, 1),
      borderOpacity: 1,
    });
    page.drawText("ZP", {
      x: logoX - 8,
      y: logoY - 5,
      size: 16,
      font: helveticaBold,
      color: brandRed,
    });

    // "Zaken" text next to logo
    page.drawText("Zaken", {
      x: logoX + logoSize + 8,
      y: logoY - 5,
      size: 18,
      font: helvetica,
      color: black,
    });

    y -= 55;

    // === TITLE ===
    page.drawText("VERZEKERINGSCERTIFICAAT", {
      x: leftMargin,
      y,
      size: 18,
      font: helveticaBold,
      color: brandRed,
    });
    y -= 16;
    page.drawText("BEROEPS- EN BEDRIJFSAANSPRAKELIJKHEIDSVERZEKERING", {
      x: leftMargin,
      y,
      size: 8,
      font: helveticaBold,
      color: brandRed,
    });
    y -= 12;
    page.drawText(
      "Dit certificaat maakt onderdeel uit van de polis van ZP Zaken b.v. onder polisnummer HPI.1006446",
      { x: leftMargin, y, size: 6.5, font: helveticaOblique, color: gray }
    );

    y -= 24;

    // === HELPER FUNCTIONS ===
    const fontSize = 9;
    const lineHeight = 14;

    const drawRow = (label: string, value: string, boldValue = false) => {
      page.drawText(label, {
        x: labelX,
        y,
        size: fontSize,
        font: helvetica,
        color: gray,
      });
      const lines = value.split("\n");
      lines.forEach((line: string, i: number) => {
        page.drawText(line, {
          x: valueX,
          y: y - i * lineHeight,
          size: fontSize,
          font: boldValue ? helveticaBold : helvetica,
          color: black,
        });
      });
      y -= Math.max(lineHeight + 4, lines.length * lineHeight + 4);
    };

    // Format date: "vrijdag 5 december 2025"
    const formatLongDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const days = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
      const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    // Format date short: "08-12-2025"
    const formatShortDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // === CERTIFICAATHOUDER ===
    drawRow("Certificaathouder:", policy.certificate_holder);

    // === VERZEKERINGSNEMER ===
    drawRow("Verzekeringsnemer:", policy.insured_name);

    y -= 2;

    // === CERTIFICAATNUMMER (bold value) ===
    drawRow("Certificaatnummer:", policy.certificate_number, true);

    y -= 2;

    // === INGANGSDATUM (short format like original: 08-12-2025) ===
    drawRow("Ingangsdatum:", formatShortDate(policy.start_date));

    y -= 2;

    // === HOEDANIGHEID ===
    drawRow("Hoedanigheid:", policy.profession);

    y -= 6;

    // === VERZEKERDE BEDRAGEN ===
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
    y -= lineHeight + 6;

    // Bedrijfsaansprakelijkheid header
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
    y -= lineHeight + 6;

    // Note
    page.drawText(
      'Waar op het polis blad wordt vermeld "per jaar voor alle leden tezamen" wordt',
      { x: valueX, y, size: 7, font: helveticaOblique, color: gray }
    );
    y -= 10;
    page.drawText("gerefereerd aan het verzekerd bedrag per jaar.", {
      x: valueX,
      y,
      size: 7,
      font: helveticaOblique,
      color: gray,
    });
    y -= lineHeight + 6;

    // === EIGEN RISICO ===
    drawRow(
      "Eigen risico:",
      policy.own_risk || "ZP Zaken draagt de kosten voor het eigen risico."
    );

    y -= 4;

    // === POLISVOORWAARDEN ===
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
    y -= lineHeight + 2;

    // Checkmark items - draw a small filled checkmark icon then text
    const drawCheckItem = (text: string) => {
      const boxX = valueX;
      const boxY = y - 1;
      const boxSize = 7;
      // Draw small rounded checkbox
      page.drawRectangle({
        x: boxX,
        y: boxY,
        width: boxSize,
        height: boxSize,
        borderColor: brandRed,
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });
      // Draw checkmark V shape inside
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
      // Text after checkbox
      page.drawText(text, {
        x: valueX + 11,
        y,
        size: 8,
        font: helvetica,
        color: brandRed,
      });
      y -= lineHeight;
    };

    drawCheckItem("Voorwaarden beroepsaansprakelijkheid");
    drawCheckItem("Voorwaarden bedrijfsaansprakelijkheid (kantoorrisico)");
    drawCheckItem("Verzekeringskaart");

    y -= 6;

    // === DEKKINGSGEBIED ===
    drawRow(
      "Dekkingsgebied:",
      policy.coverage_area ||
        "De verzekering biedt dekking ongeacht waar in de EU het handelen\nen/of nalaten zich heeft voorgedaan."
    );

    // === CONTRACTDUUR ===
    drawRow(
      "Contractduur:",
      policy.contract_duration ||
        "12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden,\nper direct opzegbaar."
    );

    y -= 4;

    // === TUSSENPERSOON ===
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
    page.drawText("AFM vergunningnummer: 12050636", {
      x: valueX,
      y,
      size: fontSize,
      font: helvetica,
      color: black,
    });
    y -= lineHeight + 8;

    // === AFGIFTEDATUM (long date like original: "vrijdag 5 december 2025") ===
    drawRow("Afgiftedatum:", formatLongDate(policy.issued_date));

    y -= 2;

    // === VOOR GEZIEN ===
    drawRow("Voor gezien ZP Zaken:", policy.issued_by);

    // === FOOTER ===
    const footerY = 36;
    page.drawLine({
      start: { x: leftMargin, y: footerY + 14 },
      end: { x: rightMargin, y: footerY + 14 },
      thickness: 0.4,
      color: lightGray,
    });
    page.drawText(
      "De verzekeringsmaterialen van ZP Zaken zijn alleen toegankelijk voor klanten van ZP Zaken en treedt hierbij op geen enkele wijze op als financiele dienstverlener of bemiddelaar zoals gesteld onder de Wft.",
      { x: leftMargin, y: footerY + 2, size: 5.5, font: helvetica, color: gray }
    );
    page.drawText(
      "De verstrekte gegevens zullen strikt vertrouwelijk worden behandeld. ZP Zaken is ingeschreven in het register Wft bij de AFM onder vergunningnummer: 12050363.",
      { x: leftMargin, y: footerY - 7, size: 5.5, font: helvetica, color: gray }
    );

    // Save & upload PDF
    const pdfBytes = await pdfDoc.save();
    const fileName = `${policy.certificate_number}.pdf`;

    const { error: uploadError } = await adminClient.storage
      .from("certificates")
      .upload(fileName, pdfBytes, {
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

    return new Response(
      JSON.stringify({
        success: true,
        policy: {
          id: policy.id,
          certificate_number: policy.certificate_number,
          pdf_url: signedUrlData?.signedUrl || null,
          pdf_path: fileName,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});