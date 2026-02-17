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
    // Package price mapping (yearly, excl. BTW)
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

    // Calculate BTW
    const amountExcl = parseFloat(data.amount_excl_btw) || 0;
    const btwPercentage = parseFloat(data.btw_percentage) || 0;
    const btwAmount = Math.round(amountExcl * (btwPercentage / 100) * 100) / 100;
    const amountIncl = Math.round((amountExcl + btwAmount) * 100) / 100;

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

    // === Generate PDF ===
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const brandRed = rgb(0.76, 0.07, 0.16);
    const lightGray = rgb(0.95, 0.95, 0.95);

    const leftMargin = 56;
    const rightMargin = pageWidth - 56;
    const lineHeight = 16;

    // Helper: wrap text
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

    // Format currency
    const formatCurrency = (amount: number) => {
      return `€ ${amount.toFixed(2).replace('.', ',')}`;
    };

    // Format date
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    let y = pageHeight - 60;

    // === HEADER ===
    page.drawText("ZP Zaken B.V.", { x: leftMargin, y, size: 18, font: helveticaBold, color: brandRed });
    y -= 16;
    page.drawText("Tupolevlaan 41, 1119 NW Schiphol-Rijk", { x: leftMargin, y, size: 8, font: helvetica, color: gray });
    y -= 11;
    page.drawText("AFM vergunningsnummer: 12050363", { x: leftMargin, y, size: 8, font: helvetica, color: gray });

    // Invoice title - right aligned
    const titleText = "FACTUUR";
    const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 22);
    page.drawText(titleText, { x: rightMargin - titleWidth, y: pageHeight - 60, size: 22, font: helveticaBold, color: brandRed });

    // Invoice number & date - right aligned
    const invoiceNumText = `Factuurnummer: ${invoice.invoice_number}`;
    page.drawText(invoiceNumText, {
      x: rightMargin - helvetica.widthOfTextAtSize(invoiceNumText, 9),
      y: pageHeight - 80,
      size: 9,
      font: helvetica,
      color: black,
    });
    const invoiceDateText = `Factuurdatum: ${formatDate(invoice.invoice_date)}`;
    page.drawText(invoiceDateText, {
      x: rightMargin - helvetica.widthOfTextAtSize(invoiceDateText, 9),
      y: pageHeight - 93,
      size: 9,
      font: helvetica,
      color: black,
    });
    const dueDateText = `Vervaldatum: ${formatDate(invoice.due_date)}`;
    page.drawText(dueDateText, {
      x: rightMargin - helvetica.widthOfTextAtSize(dueDateText, 9),
      y: pageHeight - 106,
      size: 9,
      font: helvetica,
      color: black,
    });

    // === Divider line ===
    y -= 25;
    page.drawLine({ start: { x: leftMargin, y }, end: { x: rightMargin, y }, thickness: 1, color: brandRed });

    // === CLIENT DETAILS ===
    y -= 25;
    page.drawText("Factuur aan:", { x: leftMargin, y, size: 9, font: helveticaBold, color: gray });
    y -= lineHeight;
    if (invoice.company_name) {
      page.drawText(invoice.company_name, { x: leftMargin, y, size: 10, font: helveticaBold, color: black });
      y -= lineHeight;
    }
    page.drawText(invoice.client_name, { x: leftMargin, y, size: 10, font: helvetica, color: black });
    y -= lineHeight;
    if (invoice.client_address) {
      page.drawText(invoice.client_address, { x: leftMargin, y, size: 10, font: helvetica, color: black });
      y -= lineHeight;
    }
    if (invoice.client_postcode || invoice.client_city) {
      page.drawText(`${invoice.client_postcode || ""} ${invoice.client_city || ""}`.trim(), {
        x: leftMargin, y, size: 10, font: helvetica, color: black,
      });
      y -= lineHeight;
    }
    if (invoice.kvk_nummer) {
      page.drawText(`KvK: ${invoice.kvk_nummer}`, { x: leftMargin, y, size: 9, font: helvetica, color: gray });
      y -= lineHeight;
    }

    // === TABLE HEADER ===
    y -= 20;
    const colDesc = leftMargin;
    const colAmount = 420;
    const colBtw = 470;
    const colTotal = 520;

    // Table header background
    page.drawRectangle({ x: leftMargin - 5, y: y - 4, width: rightMargin - leftMargin + 10, height: 20, color: brandRed });

    page.drawText("Omschrijving", { x: colDesc, y, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText("Bedrag", { x: colAmount, y, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    page.drawText("Totaal", { x: colTotal, y, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });

    // === TABLE ROW ===
    y -= 22;
    // Description may wrap
    const descLines = wrapText(invoice.description, helvetica, 9, colAmount - colDesc - 15);
    descLines.forEach((line: string, i: number) => {
      page.drawText(line, { x: colDesc, y: y - i * 13, size: 9, font: helvetica, color: black });
    });
    page.drawText(formatCurrency(amountExcl), { x: colAmount, y, size: 9, font: helvetica, color: black });
    page.drawText(formatCurrency(amountIncl), { x: colTotal, y, size: 9, font: helveticaBold, color: black });

    y -= Math.max(descLines.length * 13, 13) + 5;

    // Package type
    page.drawText(`Pakket: ${invoice.package_type}`, { x: colDesc, y, size: 8, font: helvetica, color: gray });

    // === TOTALS ===
    y -= 30;
    page.drawLine({ start: { x: colAmount - 10, y: y + 12 }, end: { x: rightMargin, y: y + 12 }, thickness: 0.5, color: gray });

    const drawTotalRow = (label: string, value: string, yPos: number, bold = false) => {
      const font = bold ? helveticaBold : helvetica;
      page.drawText(label, { x: colAmount, y: yPos, size: 9, font: helvetica, color: gray });
      page.drawText(value, { x: colTotal, y: yPos, size: bold ? 11 : 9, font, color: bold ? brandRed : black });
    };

    drawTotalRow("Subtotaal:", formatCurrency(amountExcl), y);
    y -= lineHeight;
    page.drawText("Vrijgesteld van BTW", { x: colAmount, y, size: 9, font: helvetica, color: gray });
    y -= lineHeight + 5;
    page.drawLine({ start: { x: colAmount - 10, y: y + 12 }, end: { x: rightMargin, y: y + 12 }, thickness: 1, color: brandRed });
    drawTotalRow("Totaal:", formatCurrency(amountIncl), y, true);

    // === PAYMENT DETAILS ===
    y -= 50;
    page.drawRectangle({ x: leftMargin - 5, y: y - 50, width: rightMargin - leftMargin + 10, height: 65, color: lightGray });
    y -= 5;
    page.drawText("Betaalgegevens", { x: leftMargin, y, size: 10, font: helveticaBold, color: brandRed });
    y -= lineHeight;
    page.drawText(`Betaalwijze: ${invoice.payment_method}`, { x: leftMargin, y, size: 9, font: helvetica, color: black });
    y -= 13;
    page.drawText(`Betaaltermijn: ${invoice.payment_terms}`, { x: leftMargin, y, size: 9, font: helvetica, color: black });
    y -= 13;
    page.drawText(`Ten name van: ${invoice.bank_name}`, { x: leftMargin, y, size: 9, font: helvetica, color: black });

    // === FOOTER ===
    const footerY = 40;
    const footerFontSize = 6.5;
    page.drawLine({ start: { x: leftMargin, y: footerY + 20 }, end: { x: rightMargin, y: footerY + 20 }, thickness: 0.5, color: gray });
    page.drawText("ZP Zaken B.V. | Tupolevlaan 41, 1119 NW Schiphol-Rijk | AFM vergunningsnummer: 12050363", {
      x: leftMargin, y: footerY + 8, size: footerFontSize, font: helvetica, color: gray,
    });
    page.drawText("De verstrekte gegevens zullen strikt vertrouwelijk worden behandeld.", {
      x: leftMargin, y: footerY, size: footerFontSize, font: helvetica, color: gray,
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
