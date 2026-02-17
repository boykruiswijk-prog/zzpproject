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

    const { lead_id, policy_data } = await req.json();
    if (!lead_id && !policy_data) {
      return new Response(
        JSON.stringify({ error: "lead_id or policy_data required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        certificate_holder:
          lead.bedrijfsnaam || `${lead.voornaam} ${lead.achternaam}`,
        insured_name: `${lead.voornaam} ${lead.achternaam}`,
        start_date:
          lead.ingangsdatum || new Date().toISOString().split("T")[0],
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
        issued_by: data.issued_by || "Ellen Baars",
      })
      .select()
      .single();

    if (policyError) {
      console.error("Policy insert error:", policyError);
      return new Response(
        JSON.stringify({
          error: "Failed to create policy",
          details: policyError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Certificaathouder: ~line at Y=625 from bottom
    let y = 625;
    drawRow("Certificaathouder:", policy.certificate_holder, y);

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
    page.drawText(
      'Waar op het polis blad wordt vermeld "per jaar voor alle leden tezamen" wordt',
      { x: valueX, y, size: smallFontSize, font: helveticaOblique, color: gray }
    );
    y -= 10;
    page.drawText("gerefereerd aan het verzekerd bedrag per jaar.", {
      x: valueX,
      y,
      size: smallFontSize,
      font: helveticaOblique,
      color: gray,
    });

    // Eigen risico
    y -= 20;
    drawRow(
      "Eigen risico:",
      policy.own_risk || "ZP Zaken draagt de kosten voor het eigen risico.",
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
    drawRow(
      "Dekkingsgebied:",
      policy.coverage_area ||
        "De verzekering biedt dekking ongeacht waar in de EU het handelen\nen/of nalaten zich heeft voorgedaan.",
      y
    );

    // Contractduur
    y -= 16 + lineHeight;
    drawRow(
      "Contractduur:",
      policy.contract_duration ||
        "12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden,\nper direct opzegbaar.",
      y
    );

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
    page.drawText("AFM vergunningnummer: 12050636", {
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

    // === Footer text ===
    const footerText1 = "De verzekeringsmantel van ZP Zaken zijn alleen toegankelijk voor klanten van ZP Zaken en treedt hierbij op geen enkele";
    const footerText2 = "wijze op als financiële dienstverlener of bemiddelaar zoals gesteld onder de Wft. De verstrekte gegevens zullen strikt";
    const footerText3 = "vertrouwelijk worden behandeld. ZP Zaken in ingeschreven in het register Wft bij de AFM onder vergunningsnummer: 12050363.";
    const footerFontSize = 6.5;
    const footerY = 38;

    page.drawText(footerText1, { x: labelX, y: footerY + 16, size: footerFontSize, font: helvetica, color: gray });
    page.drawText(footerText2, { x: labelX, y: footerY + 8, size: footerFontSize, font: helvetica, color: gray });
    page.drawText(footerText3, { x: labelX, y: footerY, size: footerFontSize, font: helvetica, color: gray });

    // === Save & upload PDF ===
    const pdfBytes = await pdfDoc.save();
    const fileName = `${policy.certificate_number}.pdf`;

    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
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