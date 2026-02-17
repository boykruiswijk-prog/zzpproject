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

    const brandRed = rgb(0.76, 0.07, 0.16); // #c2122a - ZP Zaken red
    const black = rgb(0, 0, 0);
    const gray = rgb(0.45, 0.45, 0.45);
    const lightGray = rgb(0.85, 0.85, 0.85);

    const leftMargin = 60;
    const valueX = 210;
    let y = height - 55;

    // === LOGO ===
    // Draw the ZP logo circle approximation
    page.drawCircle({ x: leftMargin + 22, y: y - 2, size: 18, borderColor: brandRed, borderWidth: 1.5, color: rgb(1, 1, 1) });
    page.drawText("ZP", { x: leftMargin + 12, y: y - 8, size: 14, font: helveticaBold, color: brandRed });
    page.drawText("Zaken", { x: leftMargin + 48, y: y - 8, size: 16, font: helvetica, color: black });

    y -= 45;

    // === TITLE ===
    page.drawText("VERZEKERINGSCERTIFICAAT", {
      x: leftMargin, y, size: 15, font: helveticaBold, color: brandRed,
    });
    y -= 18;
    page.drawText("BEROEPS- EN BEDRIJFSAANSPRAKELIJKHEIDSVERZEKERING", {
      x: leftMargin, y, size: 8.5, font: helveticaBold, color: brandRed,
    });
    y -= 13;
    page.drawText("Dit certificaat maakt onderdeel uit van de polis van ZP Zaken b.v. onder polisnummer HPI.1006446", {
      x: leftMargin, y, size: 6.5, font: helvetica, color: gray,
    });

    y -= 25;

    // === FIELD ROWS ===
    const labelFontSize = 8.5;
    const valueFontSize = 8.5;

    const drawField = (label: string, value: string, extraSpacing = 0) => {
      page.drawText(label, { x: leftMargin, y, size: labelFontSize, font: helvetica, color: gray });
      const lines = value.split("\n");
      lines.forEach((line: string, i: number) => {
        page.drawText(line, { x: valueX, y: y - i * 13, size: valueFontSize, font: helvetica, color: black });
      });
      y -= Math.max(18, lines.length * 13 + 5) + extraSpacing;
    };

    const drawFieldBold = (label: string, value: string) => {
      page.drawText(label, { x: leftMargin, y, size: labelFontSize, font: helvetica, color: gray });
      page.drawText(value, { x: valueX, y, size: valueFontSize, font: helveticaBold, color: black });
      y -= 18;
    };

    // Format date: "vrijdag 5 december 2025"
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const days = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
      const months = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
      return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    drawField("Certificaathouder:", policy.certificate_holder);
    drawField("Verzekeringsnemer:", policy.insured_name);
    y -= 2;
    drawFieldBold("Certificaatnummer:", policy.certificate_number);
    y -= 2;
    drawField("Ingangsdatum:", formatDate(policy.start_date));
    y -= 2;
    drawField("Hoedanigheid:", policy.profession);

    y -= 6;

    // === VERZEKERDE BEDRAGEN ===
    page.drawText("Verzekerde bedragen:", { x: leftMargin, y, size: labelFontSize, font: helvetica, color: gray });

    page.drawText("Beroepsaansprakelijkheid", { x: valueX, y, size: valueFontSize, font: helveticaBold, color: brandRed });
    y -= 14;
    page.drawText(`${policy.bav_per_event}, - per aanspraak`, { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 13;
    page.drawText(`${policy.bav_per_year}, - per verzekeringsjaar`, { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 18;

    page.drawText("Bedrijfsaansprakelijkheid", { x: valueX, y, size: valueFontSize, font: helveticaBold, color: brandRed });
    y -= 14;
    page.drawText(`${policy.avb_per_event}, - per aanspraak`, { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 13;
    page.drawText(`${policy.avb_per_year}, - per verzekeringsjaar`, { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 18;

    // Note about "per jaar voor alle leden tezamen"
    page.drawText('Waar op het polis blad wordt vermeld "per jaar voor alle leden tezamen" wordt', {
      x: valueX, y, size: 7, font: helvetica, color: gray,
    });
    y -= 11;
    page.drawText("gerefereerd aan het verzekerd bedrag per jaar.", {
      x: valueX, y, size: 7, font: helvetica, color: gray,
    });
    y -= 20;

    // === EIGEN RISICO ===
    drawField("Eigen risico:", policy.own_risk || "ZP Zaken draagt de kosten voor het eigen risico.");

    y -= 4;

    // === POLISVOORWAARDEN ===
    page.drawText("Polisvoorwaarden:", { x: leftMargin, y, size: labelFontSize, font: helvetica, color: gray });
    page.drawText("Informatie en Communicatie Technologie", { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 14;
    // Draw checkmark boxes manually (WinAnsi can't encode unicode checkmarks)
    const drawCheckItem = (text: string) => {
      // Draw checkbox square
      const boxSize = 6;
      const boxX = valueX;
      const boxY = y - 1;
      page.drawRectangle({ x: boxX, y: boxY, width: boxSize, height: boxSize, borderColor: brandRed, borderWidth: 0.8, color: rgb(1, 1, 1) });
      // Draw checkmark lines inside box
      page.drawLine({ start: { x: boxX + 1, y: boxY + 3 }, end: { x: boxX + 2.5, y: boxY + 1 }, thickness: 0.8, color: brandRed });
      page.drawLine({ start: { x: boxX + 2.5, y: boxY + 1 }, end: { x: boxX + 5, y: boxY + 5 }, thickness: 0.8, color: brandRed });
      page.drawText(text, { x: valueX + 10, y, size: 7.5, font: helvetica, color: brandRed });
      y -= 12;
    };
    drawCheckItem("Voorwaarden beroepsaansprakelijkheid");
    drawCheckItem("Voorwaarden bedrijfsaansprakelijkheid (kantoorrisico)");
    drawCheckItem("Verzekeringskaart");
    y -= 20;

    // === DEKKINGSGEBIED ===
    drawField("Dekkingsgebied:", policy.coverage_area || "De verzekering biedt dekking ongeacht waar in de EU het handelen\nen/of nalaten zich heeft voorgedaan.");

    // === CONTRACTDUUR ===
    drawField("Contractduur:", policy.contract_duration || "12 maanden doorlopend, met stilzwijgende verlenging voor telkens 12 maanden,\nper direct opzegbaar.");

    y -= 4;

    // === TUSSENPERSOON ===
    page.drawText("Tussenpersoon:", { x: leftMargin, y, size: labelFontSize, font: helvetica, color: gray });
    page.drawText("ZP Zaken.", { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 13;
    page.drawText("AFM vergunningnummer: 12050636", { x: valueX, y, size: valueFontSize, font: helvetica, color: black });
    y -= 22;

    // === AFGIFTEDATUM ===
    drawField("Afgiftedatum:", formatDate(policy.issued_date));

    // === VOOR GEZIEN ===
    drawField("Voor gezien ZP Zaken:", policy.issued_by);

    // === FOOTER ===
    const footerY = 38;
    page.drawLine({ start: { x: leftMargin, y: footerY + 12 }, end: { x: width - 60, y: footerY + 12 }, thickness: 0.4, color: lightGray });
    page.drawText(
      "De verzekeringsmaterialen van ZP Zaken zijn alleen toegankelijk voor klanten van ZP Zaken en treedt hierbij op geen enkele wijze op als financiële dienstverlener of bemiddelaar zoals gesteld onder de Wft.",
      { x: leftMargin, y: footerY, size: 5, font: helvetica, color: gray }
    );
    page.drawText(
      "De verstrekte gegevens zullen strikt vertrouwelijk worden behandeld. ZP Zaken is ingeschreven in het register Wft bij de AFM onder vergunningnummer: 12050363.",
      { x: leftMargin, y: footerY - 8, size: 5, font: helvetica, color: gray }
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
      return new Response(JSON.stringify({ error: "Failed to upload PDF", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
