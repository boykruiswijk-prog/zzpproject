import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateUBLInvoice(invoice: any, lead: any): string {
  const issueDate = formatDate(new Date(invoice.invoice_date));
  const dueDate = formatDate(new Date(invoice.due_date));
  const isMonthly = lead?.omzet === "maandelijks" || lead?.omzet === "2";
  
  const periodEnd = new Date(invoice.invoice_date);
  if (isMonthly) {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoice.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>Conform artikel 11.K van de Wet op de omzetbelasting 1968 is deze factuur vrijgesteld van BTW.</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:InvoicePeriod>
    <cbc:StartDate>${issueDate}</cbc:StartDate>
    <cbc:EndDate>${formatDate(periodEnd)}</cbc:EndDate>
  </cac:InvoicePeriod>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>ZP Zaken B.V.</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>Tupolevlaan 41</cbc:StreetName>
        <cbc:CityName>Schiphol-Rijk</cbc:CityName>
        <cbc:PostalZone>1119 NW</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>NL854862431B01</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>ZP Zaken B.V.</cbc:RegistrationName>
        <cbc:CompanyID>62117092</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${escapeXml(invoice.company_name || invoice.client_name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(invoice.client_address || "")}</cbc:StreetName>
        <cbc:CityName>${escapeXml(invoice.client_city || "")}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(invoice.client_postcode || "")}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>NL</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      ${invoice.kvk_nummer ? `<cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(invoice.company_name || invoice.client_name)}</cbc:RegistrationName>
        <cbc:CompanyID>${escapeXml(invoice.kvk_nummer)}</cbc:CompanyID>
      </cac:PartyLegalEntity>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>49</cbc:PaymentMeansCode>
    <cbc:PaymentID>${escapeXml(invoice.invoice_number)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>NL25ABNA0477330223</cbc:ID>
      <cbc:Name>ZP Zaken B.V.</cbc:Name>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${Number(invoice.amount_excl_btw).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>E</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cbc:TaxExemptionReason>Vrijgesteld conform artikel 11.K Wet OB 1968</cbc:TaxExemptionReason>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${Number(invoice.amount_excl_btw).toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${Number(invoice.amount_excl_btw).toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${Number(invoice.amount_incl_btw).toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${Number(invoice.amount_incl_btw).toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="EA">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${Number(invoice.amount_excl_btw).toFixed(2)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${escapeXml(invoice.description)}</cbc:Description>
      <cbc:Name>${escapeXml(invoice.package_type)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>E</cbc:ID>
        <cbc:Percent>0</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${Number(invoice.amount_excl_btw).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>`;
}

Deno.serve(async (req) => {
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
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse optional date filter (default: today's invoices)
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") || new Date().toISOString().slice(0, 10);

    // Fetch invoices created on or after the given date
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .gte("created_at", `${dateParam}T00:00:00`)
      .lte("created_at", `${dateParam}T23:59:59`)
      .order("created_at", { ascending: true });

    if (invError) throw invError;

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ error: "Geen facturen gevonden voor deze datum" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get lead data for period calculation
    const leadIds = [...new Set(invoices.filter(i => i.lead_id).map(i => i.lead_id))];
    let leadsMap: Record<string, any> = {};
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, omzet")
        .in("id", leadIds);
      if (leads) {
        leadsMap = Object.fromEntries(leads.map(l => [l.id, l]));
      }
    }

    // Generate combined XML with multiple invoices
    const xmlParts = invoices.map((inv) => {
      const lead = inv.lead_id ? leadsMap[inv.lead_id] : null;
      return generateUBLInvoice(inv, lead);
    });

    // If single invoice, return single XML; if multiple, wrap in batch
    let xmlContent: string;
    if (xmlParts.length === 1) {
      xmlContent = xmlParts[0];
    } else {
      xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<InvoiceBatch count="${xmlParts.length}">\n${xmlParts.map(x => x.replace('<?xml version="1.0" encoding="UTF-8"?>\n', '')).join('\n')}\n</InvoiceBatch>`;
    }

    const fileName = `zpzaken-ubl-${dateParam}.xml`;
    return new Response(xmlContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("UBL export error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
