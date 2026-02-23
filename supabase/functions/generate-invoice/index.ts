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

    const { lead_id, invoice_data, invoice_date: customInvoiceDate } = await req.json();
    if (!lead_id && !invoice_data) {
      return new Response(JSON.stringify({ error: "lead_id or invoice_data required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build invoice data from lead if not provided
    let data = invoice_data;
    const packagePricesYearly: Record<string, number> = {
      "Combi Basis": 360.00,
      "Combi Uitgebreid": 540.00,
    };
    const packagePricesMonthly: Record<string, number> = {
      "Combi Basis": 30.00,
      "Combi Uitgebreid": 45.00,
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
      const isMonthly = lead.omzet === "maandelijks" || lead.omzet === "2";
      const priceMap = isMonthly ? packagePricesMonthly : packagePricesYearly;
      const priceExcl = priceMap[pkgName] || priceMap["Combi Uitgebreid"];
      data = {
        client_name: `${lead.voornaam} ${lead.achternaam}`,
        company_name: lead.bedrijfsnaam || null,
        kvk_nummer: lead.kvk_nummer || null,
        package_type: pkgName,
        amount_excl_btw: priceExcl,
        beroep: lead.beroep || null,
        betaalfrequentie: isMonthly ? "Maandelijks" : "Jaarlijks",
      };
    }

    const amountExcl = parseFloat(data.amount_excl_btw) || 0;
    const amountIncl = amountExcl; // Vrijgesteld van BTW

    // Determine invoice date
    const invoiceDate = customInvoiceDate || new Date().toISOString().slice(0, 10);

    // === Duplicate period check ===
    if (lead_id) {
      const isMonthlyCheck = data.betaalfrequentie === "Maandelijks";
      const periodStart = new Date(invoiceDate);
      const periodEnd = new Date(periodStart);
      if (isMonthlyCheck) {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      const { data: existingInvoices } = await adminClient
        .from("invoices")
        .select("id, invoice_number, invoice_date")
        .eq("lead_id", lead_id)
        .gte("invoice_date", invoiceDate)
        .lt("invoice_date", periodEnd.toISOString().slice(0, 10));

      if (existingInvoices && existingInvoices.length > 0) {
        return new Response(JSON.stringify({
          error: `Er bestaat al een factuur voor deze periode (${existingInvoices[0].invoice_number}, datum ${existingInvoices[0].invoice_date}). Dubbele facturatie voorkomen.`,
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert invoice record
    const { data: invoice, error: invoiceError } = await adminClient
      .from("invoices")
      .insert({
        lead_id: lead_id || null,
        invoice_number: "",
        invoice_date: invoiceDate,
        client_name: data.client_name,
        company_name: data.company_name || null,
        client_address: data.client_address || null,
        client_postcode: data.client_postcode || null,
        client_city: data.client_city || null,
        kvk_nummer: data.kvk_nummer || null,
        description: data.description || "Combinatiepolis Beroeps- en Bedrijfsaansprakelijkheid",
        package_type: data.package_type || "Combi Uitgebreid",
        amount_excl_btw: amountExcl,
        btw_percentage: 0,
        btw_amount: 0,
        amount_incl_btw: amountIncl,
        payment_method: data.payment_method || "Automatische incasso",
        payment_terms: data.payment_terms || "Wordt binnen 7 dagen automatisch geïncasseerd",
        bank_account: data.bank_account || "NL25 ABNA 0477 3302 23",
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
    const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const brandRed = rgb(0.91, 0.26, 0.29);
    const lightGray = rgb(0.95, 0.95, 0.95);

    const leftMargin = 56;
    const rightMargin = pageWidth - 56;
    const lineHeight = 15;

    const formatCurrency = (amount: number) => {
      return amount.toFixed(2).replace('.', ',');
    };

    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    const formatDateLong = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
    };

    // === EMBED LOGO ===
    let logoImage;
    try {
      const logoUrl = `${supabaseUrl}/storage/v1/object/public/certificates/assets/logo-zp.jpg`;
      const logoResponse = await fetch(logoUrl);
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      logoImage = await pdfDoc.embedJpg(logoBytes);
    } catch (e) {
      console.error("Logo embed error:", e);
    }

    // === TOP: Logo centered, company info right ===
    const companyInfoX = 410;
    let y = pageHeight - 50;

    // Logo centered between left margin and company info
    if (logoImage) {
      const logoSize = 65;
      const logoCenterX = (leftMargin + companyInfoX) / 2 - logoSize / 2 + 50;
      page.drawImage(logoImage, { x: logoCenterX, y: y - logoSize + 10, width: logoSize, height: logoSize });
    }

    const companyLines = [
      "ZP Zaken B.V.",
      "Tupolevlaan 41",
      "1119 NW",
      "Schiphol-Rijk",
      "NL25 ABNA 0477 3302 23",
      "KVK: 62117092",
      "BTW: NL854862431B01",
      "Telefoon: 023-2010502",
      "administratie@zpzaken.nl",
      "www.zpzaken.nl",
    ];

    companyLines.forEach((line) => {
      page.drawText(line, { x: companyInfoX, y, size: 8, font: helvetica, color: gray });
      y -= 11;
    });

    // === LEFT: Client address block ===
    let clientY = pageHeight - 170;
    if (invoice.company_name) {
      page.drawText(invoice.company_name, { x: leftMargin, y: clientY, size: 10, font: helvetica, color: black });
      clientY -= lineHeight;
    }
    page.drawText(`t.a.v. ${invoice.client_name}`, { x: leftMargin, y: clientY, size: 10, font: helvetica, color: black });
    clientY -= lineHeight;
    if (invoice.client_address) {
      page.drawText(invoice.client_address, { x: leftMargin, y: clientY, size: 10, font: helvetica, color: black });
      clientY -= lineHeight;
    }
    if (invoice.client_postcode || invoice.client_city) {
      page.drawText(`${invoice.client_postcode || ""}  ${invoice.client_city || ""}`.trim(), {
        x: leftMargin, y: clientY, size: 10, font: helvetica, color: black,
      });
      clientY -= lineHeight;
    }

    // === FACTUUR title ===
    let sectionY = clientY - 30;
    page.drawText("FACTUUR", { x: leftMargin, y: sectionY, size: 16, font: helveticaBold, color: black });

    // === Invoice meta fields ===
    sectionY -= 30;
    const labelX = leftMargin;
    const colonX = 170;
    const valueX = 180;

    const metaFields = [
      ["Factuurdatum", formatDate(invoice.invoice_date)],
      ["Factuurnummer", invoice.invoice_number],
      ["Debiteurennummer", invoice.kvk_nummer || "-"],
      ["Behandeld door", "administratie@zpzaken.nl"],
    ];

    metaFields.forEach(([label, value]) => {
      page.drawText(label, { x: labelX, y: sectionY, size: 9, font: helvetica, color: black });
      page.drawText(":", { x: colonX, y: sectionY, size: 9, font: helvetica, color: black });
      page.drawText(value, { x: valueX, y: sectionY, size: 9, font: helvetica, color: black });
      sectionY -= lineHeight;
    });

    // === TABLE ===
    sectionY -= 20;
    const colDesc = leftMargin;
    const colBedrag = rightMargin - 50;

    // Table header bar
    page.drawRectangle({ x: leftMargin - 5, y: sectionY - 4, width: rightMargin - leftMargin + 10, height: 18, color: brandRed });
    page.drawText("Omschrijving", { x: colDesc, y: sectionY, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });
    const bedragLabel = "Bedrag";
    const bedragLabelW = helveticaBold.widthOfTextAtSize(bedragLabel, 9);
    page.drawText(bedragLabel, { x: colBedrag - bedragLabelW + 50, y: sectionY, size: 9, font: helveticaBold, color: rgb(1, 1, 1) });

    // Table row
    sectionY -= 22;
    const descText = `Verzekering: ${invoice.description}`;
    page.drawText(descText, { x: colDesc, y: sectionY, size: 9, font: helvetica, color: black });
    const amountStr = formatCurrency(amountExcl);
    const amountW = helvetica.widthOfTextAtSize(amountStr, 9);
    page.drawText(amountStr, { x: colBedrag - amountW + 50, y: sectionY, size: 9, font: helvetica, color: black });

    sectionY -= lineHeight;
    // Betaalfrequentie
    if (data.betaalfrequentie) {
      page.drawText(`Betaalfrequentie: ${data.betaalfrequentie}`, { x: colDesc, y: sectionY, size: 9, font: helvetica, color: black });
      sectionY -= lineHeight;
    }
    if (data.beroep) {
      page.drawText(`Branche: ${data.beroep}`, { x: colDesc, y: sectionY, size: 9, font: helvetica, color: black });
      sectionY -= lineHeight;
    }

    // Period line in italic - adjust based on payment frequency
    const startDate = formatDateLong(invoice.invoice_date);
    const endDate = new Date(invoice.invoice_date);
    const isMonthlyPayment = data.betaalfrequentie === "Maandelijks";
    if (isMonthlyPayment) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }
    const endDateStr = `${endDate.getDate()}-${endDate.getMonth() + 1}-${endDate.getFullYear()}`;
    page.drawText(`Periode: ${startDate} t/m ${endDateStr}`, { x: colDesc, y: sectionY, size: 9, font: helveticaOblique, color: black });

    sectionY -= 5;
    // Line under table
    page.drawLine({ start: { x: leftMargin - 5, y: sectionY }, end: { x: rightMargin + 5, y: sectionY }, thickness: 0.5, color: gray });

    // === TOTAL ===
    sectionY -= 30;
    const totalLabel = "Door u te betalen in EUR";
    const totalLabelW = helveticaBold.widthOfTextAtSize(totalLabel, 10);
    page.drawText(totalLabel, { x: colBedrag - totalLabelW - 10, y: sectionY, size: 10, font: helveticaBold, color: black });
    const totalStr = formatCurrency(amountIncl);
    const totalW = helvetica.widthOfTextAtSize(totalStr, 10);
    page.drawText(totalStr, { x: colBedrag - totalW + 50, y: sectionY, size: 10, font: helvetica, color: black });

    // === BTW vrijstelling ===
    sectionY -= 40;
    page.drawText("Conform artikel 11.K van de Wet op de omzetbelasting 1968 is deze factuur vrijgesteld van BTW.", {
      x: leftMargin, y: sectionY, size: 9, font: helvetica, color: black,
    });

    // === Payment note ===
    sectionY -= 25;
    page.drawText("Het door u te betalen/ontvangen bedrag zullen wij binnen drie werkdagen incasseren of overmaken.", {
      x: leftMargin, y: sectionY, size: 9, font: helvetica, color: black,
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
