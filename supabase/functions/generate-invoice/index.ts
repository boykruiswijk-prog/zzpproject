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
    // Auth check
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

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isTeam } = await adminClient.rpc("is_team_member", { _user_id: user.id });
    if (!isTeam) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, invoice_data } = await req.json();
    if (!lead_id && !invoice_data) {
      return new Response(JSON.stringify({ error: "lead_id or invoice_data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build invoice data from lead if not provided
    let data = invoice_data;
    const packagePrices: Record<string, number> = {
      "Combi Basis": 292.40,
      "Combi Uitgebreid": 482.48,
    };

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
      const pkgName = lead.verzekering_type || "Combi Uitgebreid";
      const priceExcl = packagePrices[pkgName] || packagePrices["Combi Uitgebreid"];
      data = {
        client_name: `${lead.voornaam} ${lead.achternaam}`,
        company_name: lead.bedrijfsnaam || null,
        kvk_nummer: lead.kvk_nummer || null,
        package_type: pkgName,
        amount_excl_btw: priceExcl,
      };
    }

    // Calculate amounts (BTW vrijgesteld)
    const amountExcl = parseFloat(data.amount_excl_btw) || 0;
    const btwPercentage = 0;
    const btwAmount = 0;
    const amountIncl = amountExcl;

    // Insert invoice record
    const { data: invoice, error: invoiceError } = await adminClient
      .from("invoices")
      .insert({
        lead_id: lead_id || null,
        invoice_number: "",
        client_name: data.client_name,
        company_name: data.company_name || null,
        client_address: data.client_address || null,
        client_postcode: data.client_postcode || null,
        client_city: data.client_city || null,
        kvk_nummer: data.kvk_nummer || null,
        description: data.description || "Combinatiepolis Beroeps- en Bedrijfsaansprakelijkheid",
        package_type: data.package_type || "Combi Uitgebreid",
        amount_excl_btw: amountExcl,
        btw_percentage: btwPercentage,
        btw_amount: btwAmount,
        amount_incl_btw: amountIncl,
        payment_method: data.payment_method || "Automatische incasso",
        payment_terms: data.payment_terms || "Wordt binnen 7 dagen automatisch geïncasseerd",
        bank_account: data.bank_account || "NL00 BANK 0000 0000 00",
        bank_name: data.bank_name || "ZP Zaken B.V.",
        status: "definitief",
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Invoice insert error:", invoiceError);
      return new Response(JSON.stringify({ error: "Failed to create invoice", details: invoiceError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === Load the template background image from storage ===
    const { data: templateData, error: templateError } = await adminClient.storage
      .from("certificates")
      .download("templates/certificate-template.png");
    if (templateError || !templateData) {
      console.error("Failed to load template:", templateError);
      return new Response(
        JSON.stringify({ error: "Failed to load certificate template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const templateBytes = new Uint8Array(await templateData.arrayBuffer());

    // === Create PDF with template as background ===
    const pdfDoc = await PDFDocument.create();
    const templateImage = await pdfDoc.embedPng(templateBytes);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Draw template as full-page background
    page.drawImage(templateImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    // === Embed fonts ===
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const black = rgb(0, 0, 0);
    const gray = rgb(0.35, 0.35, 0.35);
    const brandRed = rgb(0.76, 0.07, 0.16);

    // === Position constants (same as certificate) ===
    const labelX = 56;
    const valueX = 195;
    const fontSize = 9;
    const lineHeight = 13;

    // Format currency
    const formatCurrency = (amount: number) => `€ ${amount.toFixed(2).replace('.', ',')}`;

    // Format date
    const formatShortDate = (dateStr: string) => {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    // Helper: wrap text
    const maxValueWidth = pageWidth - valueX - 40;
    const wrapText = (text: string, font: typeof helvetica, size: number, maxWidth: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(testLine, size) > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Helper: draw a label + value row (same style as certificate)
    const drawRow = (label: string, value: string, yPos: number, options?: { boldValue?: boolean; valueColor?: typeof black }) => {
      page.drawText(label, { x: labelX, y: yPos, size: fontSize, font: helvetica, color: gray });
      const font = options?.boldValue ? helveticaBold : helvetica;
      const color = options?.valueColor || black;
      const lines = value.split("\n");
      lines.forEach((line: string, i: number) => {
        page.drawText(line, { x: valueX, y: yPos - i * lineHeight, size: fontSize, font, color });
      });
    };

    // === FACTUUR TITLE (positioned where certificate title area is) ===
    let y = 620;
    page.drawText("FACTUUR", { x: labelX, y, size: 18, font: helveticaBold, color: brandRed });

    // === Invoice meta ===
    y -= 30;
    drawRow("Factuurnummer:", invoice.invoice_number, y, { boldValue: true });
    y -= 18;
    drawRow("Factuurdatum:", formatShortDate(invoice.invoice_date), y, { boldValue: true });
    y -= 18;
    drawRow("Vervaldatum:", formatShortDate(invoice.due_date), y);

    // === Divider ===
    y -= 20;
    page.drawLine({ start: { x: labelX, y }, end: { x: pageWidth - 56, y }, thickness: 0.5, color: brandRed });

    // === Client details ===
    y -= 22;
    page.drawText("Factuur aan", { x: labelX, y, size: fontSize, font: helveticaBold, color: brandRed });

    y -= 18;
    if (invoice.company_name) {
      drawRow("Bedrijfsnaam:", invoice.company_name, y, { boldValue: true });
      y -= 16;
    }
    drawRow("Naam:", invoice.client_name, y);
    y -= 16;
    if (invoice.client_address) {
      drawRow("Adres:", invoice.client_address, y);
      y -= 16;
    }
    if (invoice.client_postcode || invoice.client_city) {
      drawRow("Plaats:", `${invoice.client_postcode || ""} ${invoice.client_city || ""}`.trim(), y);
      y -= 16;
    }
    if (invoice.kvk_nummer) {
      drawRow("KvK-nummer:", invoice.kvk_nummer, y);
      y -= 16;
    }

    // === Divider ===
    y -= 10;
    page.drawLine({ start: { x: labelX, y }, end: { x: pageWidth - 56, y }, thickness: 0.5, color: brandRed });

    // === Omschrijving ===
    y -= 22;
    page.drawText("Omschrijving", { x: labelX, y, size: fontSize, font: helveticaBold, color: brandRed });

    y -= 18;
    drawRow("Product:", invoice.description, y);
    y -= 16;
    drawRow("Pakket:", invoice.package_type, y, { boldValue: true });

    // === Bedrag ===
    y -= 28;
    page.drawText("Bedrag", { x: labelX, y, size: fontSize, font: helveticaBold, color: brandRed });

    y -= 18;
    drawRow("Totaalbedrag:", formatCurrency(amountIncl), y, { boldValue: true, valueColor: brandRed });
    y -= 16;
    page.drawText("Vrijgesteld van BTW", { x: valueX, y, size: 8, font: helvetica, color: gray });

    // === Betaalgegevens ===
    y -= 30;
    page.drawText("Betaalgegevens", { x: labelX, y, size: fontSize, font: helveticaBold, color: brandRed });

    y -= 18;
    drawRow("Betaalwijze:", invoice.payment_method, y);
    y -= 16;
    const termLines = wrapText(invoice.payment_terms, helvetica, fontSize, maxValueWidth);
    page.drawText("Betaaltermijn:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
    termLines.forEach((line: string, i: number) => {
      page.drawText(line, { x: valueX, y: y - i * lineHeight, size: fontSize, font: helvetica, color: black });
    });
    y -= (termLines.length - 1) * lineHeight;
    y -= 16;
    drawRow("Ten name van:", invoice.bank_name, y);

    // === Cover template footer with white rectangle ===
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 120, color: rgb(1, 1, 1) });

    // === Footer text (same as certificate) ===
    const footerFontSize = 6.5;
    const footerY = 38;
    page.drawText("De verzekeringsmantel van ZP Zaken zijn alleen toegankelijk voor klanten van ZP Zaken en treedt hierbij op geen enkele", {
      x: labelX, y: footerY + 16, size: footerFontSize, font: helvetica, color: gray,
    });
    page.drawText("wijze op als financiële dienstverlener of bemiddelaar zoals gesteld onder de Wft. De verstrekte gegevens zullen strikt", {
      x: labelX, y: footerY + 8, size: footerFontSize, font: helvetica, color: gray,
    });
    page.drawText("vertrouwelijk worden behandeld. ZP Zaken in ingeschreven in het register Wft bij de AFM onder vergunningsnummer: 12050363.", {
      x: labelX, y: footerY, size: footerFontSize, font: helvetica, color: gray,
    });

    // === Save & upload PDF ===
    const pdfBytes = await pdfDoc.save();
    const fileName = `invoices/${invoice.invoice_number}.pdf`;

    const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
    const { error: uploadError } = await adminClient.storage
      .from("certificates")
      .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

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
      .from("invoices")
      .update({ pdf_url: fileName, status: "definitief" })
      .eq("id", invoice.id);

    return new Response(
      JSON.stringify({
        success: true,
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          pdf_url: signedUrlData?.signedUrl || null,
          pdf_path: fileName,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
