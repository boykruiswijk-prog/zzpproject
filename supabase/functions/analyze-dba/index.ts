import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is team member
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader?.replace("Bearer ", "") || "");
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Niet geautoriseerd" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Geen toegang" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { check_id, action } = await req.json();

    // Fetch the check
    const { data: check, error: checkError } = await supabase
      .from("dba_checks")
      .select("*")
      .eq("id", check_id)
      .single();

    if (checkError || !check) {
      return new Response(JSON.stringify({ error: "Check niet gevonden" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active check fields
    const { data: fields } = await supabase
      .from("dba_check_fields")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    const fieldNames = (fields || []).map((f: any) => `- ${f.field_name}: ${f.description}`).join("\n");

    if (action === "analyze") {
      // Screen the form for missing/unfilled fields and checklist items
      const systemPrompt = `Je bent een expert op het gebied van de Nederlandse Wet DBA (Wet Deregulering Beoordeling Arbeidsrelaties).
Je screent ingevulde toetsingsformulieren van ZP kandidaten op volledigheid.

Het formulier "Gegevens met betrekking tot toetsing ZP kandidaat - Wet DBA" bevat de volgende velden die ingevuld moeten zijn:

VERPLICHTE VELDEN:
- Naam ZP kandidaat
- Opdrachtgever
- Eindopdrachtgever
- Functie
- Opdrachtomschrijving
- Project
- Startdatum
- Einddatum
- Optie tot verlenging
- Uurtarief ZP'er
- Aantal uur per week
- Specifieke vaardigheden, kennis, opleiding
- Treedt zelfstandig naar buiten toe (ja/nee)
- Zelfstandigheid - eigen materiaal, werkwijze enz. (ja/nee)

AANVULLENDE DOCUMENTATIE CHECKLIST:
Voor elk document moet aangegeven zijn of het "van toepassing / aanwezig" of "niet van toepassing / niet aanwezig" is:
- Overeenkomst Eindopdrachtgever
- Identiteits verklaring
- Curriculum Vitae
- Uittreksel Kamer van Koophandel
- Polis beroeps en bedrijfsaansprakelijkheid
- VOG verklaring
- VCA certificering (VCA basis / VCA VOL / VIL VCU)

BELANGRIJK BIJ HET BEOORDELEN VAN DE CHECKLIST:
1. De checklist heeft TWEE kolommen: "van toepassing / aanwezig" (links) en "niet van toepassing / niet aanwezig" (rechts).
   Checkboxes worden weergegeven als ☒ (aangevinkt) of ☐ (niet aangevinkt).
   - Als ☒ in de LINKER kolom ("van toepassing / aanwezig") staat: het document IS aanwezig → status "aanwezig"
   - Als ☒ in de RECHTER kolom ("niet van toepassing / niet aanwezig") staat: het document is NIET aanwezig → status "niet_aanwezig"
   - Als beide ☐ zijn of niet te bepalen: status "niet_ingevuld"
   Let op de volgorde: per rij staat eerst het resultaat voor "aanwezig", dan voor "niet aanwezig".
2. Beoordeel alleen een veld als NIET ingevuld als het veld echt volledig leeg is (geen tekst na de veldnaam).
3. Als een veld tekst bevat (ook al is het kort), markeer het als ingevuld (filled: true).
4. Het veld "Specifieke vaardigheden" is optioneel - als het leeg is, is dit een OPMERKING maar geen kritisch aandachtspunt.
5. Het veld "Rechtsvorm" is NIET onderdeel van de check - negeer dit volledig, meld het NIET als aandachtspunt, en tel het NIET mee in de overall_score berekening. De rechtsvorm van de opdrachtgevers (bijv. B.V.) is al bekend en hoeft niet gecontroleerd te worden.

Controleer het ingevulde formulier en rapporteer voor elk veld of het is ingevuld.
Alleen als een veld ECHT leeg is of ontbreekt in het document: markeer dit als aandachtspunt.

EXTRA: Zoek ook naar de datum/geldigheid van de polis beroeps- en bedrijfsaansprakelijkheid als die vermeld staat in het document.
Geef de datum terug in YYYY-MM-DD formaat als je die vindt. Dit kan een ingangsdatum, afgiftedatum of geldigheidsdatum zijn.

Antwoord ALLEEN met een JSON tool call.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Analyseer dit ingevulde toetsingsformulier:\n\n${check.extracted_text}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_form_screening",
              description: "Report the screening results of the ZP candidate verification form",
              parameters: {
                type: "object",
                properties: {
                  form_fields: {
                    type: "array",
                    description: "Resultaten per verplicht veld",
                    items: {
                      type: "object",
                      properties: {
                        field_name: { type: "string", description: "Naam van het veld" },
                        filled: { type: "boolean", description: "Of het veld is ingevuld" },
                        value: { type: "string", description: "De ingevulde waarde, of null als leeg" },
                        issue: { type: "string", description: "Aandachtspunt als het veld niet ingevuld is" },
                      },
                      required: ["field_name", "filled"],
                    },
                  },
                  checklist_items: {
                    type: "array",
                    description: "Resultaten per documentatie-item uit de checklist",
                    items: {
                      type: "object",
                      properties: {
                        document_name: { type: "string", description: "Naam van het document" },
                        status: { type: "string", enum: ["aanwezig", "niet_aanwezig", "niet_ingevuld"], description: "Status van het document" },
                        issue: { type: "string", description: "Aandachtspunt als document ontbreekt of niet is aangevinkt" },
                      },
                      required: ["document_name", "status"],
                    },
                  },
                  aandachtspunten: {
                    type: "array",
                    items: { type: "string" },
                    description: "Lijst van alle aandachtspunten: ontbrekende velden en niet-aanwezige documentatie",
                  },
                  overall_score: { type: "number", description: "Score van 0-100 hoe volledig het formulier is ingevuld" },
                  summary: { type: "string", description: "Korte samenvatting van de screening" },
                  insurance_policy_date: { type: "string", description: "Datum van de polis beroeps-/bedrijfsaansprakelijkheid in YYYY-MM-DD formaat, of null als niet gevonden" },
                },
                required: ["form_fields", "checklist_items", "aandachtspunten", "overall_score", "summary"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_form_screening" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        return new Response(JSON.stringify({ error: "AI analyse mislukt" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "Geen analyse resultaat" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const analysis = JSON.parse(toolCall.function.arguments);
      const missingFields = analysis.aandachtspunten || [];

      // Check insurance policy status from checklist
      const insuranceChecklist = analysis.checklist_items?.find(
        (item: any) => item.document_name?.toLowerCase().includes("polis") || item.document_name?.toLowerCase().includes("aansprakelijkheid")
      );
      const insuranceMissing = insuranceChecklist?.status === "niet_aanwezig" || insuranceChecklist?.status === "niet_ingevuld";

      // Check insurance policy age (older than 1 year = aandachtspunt)
      let insurancePolicyExpired: boolean | null = null;
      if (insuranceMissing) {
        // Policy not provided at all - flag it
        insurancePolicyExpired = null;
        if (!missingFields.some((f: string) => f.toLowerCase().includes("polis") && f.toLowerCase().includes("niet aanwezig"))) {
          missingFields.push("Polis beroeps- en bedrijfsaansprakelijkheid is niet aangeleverd");
        }
      } else if (analysis.insurance_policy_date) {
        const policyDate = new Date(analysis.insurance_policy_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        insurancePolicyExpired = policyDate < oneYearAgo;
        if (insurancePolicyExpired) {
          missingFields.push(`Polis beroeps-/bedrijfsaansprakelijkheid is ouder dan 1 jaar (datum: ${analysis.insurance_policy_date})`);
        }
      }

      await supabase.from("dba_checks").update({
        field_results: analysis.form_fields,
        missing_fields: missingFields,
        document_checklist: analysis.checklist_items,
        suggestions: [{
          score: analysis.overall_score,
          summary: analysis.summary,
          aandachtspunten: missingFields,
          insurance_policy_date: analysis.insurance_policy_date || null,
          insurance_policy_expired: insurancePolicyExpired,
          insurance_missing: insuranceMissing || false,
        }],
        status: "analyzed",
      }).eq("id", check_id);

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "rewrite") {
      // Rewrite project description to be Wet DBA compliant
      const systemPrompt = `Je bent een juridisch expert op het gebied van de Nederlandse Wet DBA.
De gebruiker geeft je een projectomschrijving uit een overeenkomst. 
Herschrijf deze projectomschrijving zodat deze volledig Wet DBA-proof is.

Zorg ervoor dat:
1. Er geen elementen van een gezagsverhouding in staan
2. De zelfstandigheid van de opdrachtnemer benadrukt wordt
3. Het resultaatgericht is (niet uren-gericht)
4. De opdrachtnemer vrij is in de wijze van uitvoering
5. Er geen exclusiviteit wordt gesuggereerd

Geef ALLEEN de herschreven tekst terug, geen uitleg.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Herschrijf deze projectomschrijving:\n\n${check.project_description}` },
          ],
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "AI herschrijving mislukt" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      // Strip markdown formatting (**, *, #, etc.)
      const rawRewritten = aiResult.choices?.[0]?.message?.content || "";
      const rewritten = rawRewritten
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^[-*]\s+/gm, "- ")
        .trim();

      await supabase.from("dba_checks").update({
        rewritten_description: rewritten,
      }).eq("id", check_id);

      return new Response(JSON.stringify({ success: true, rewritten_description: rewritten }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "check_kvk") {
      // Check KVK description against actual work
      if (!check.kvk_text) {
        return new Response(JSON.stringify({ error: "Geen KVK tekst beschikbaar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const workDescription = check.project_description || check.extracted_text || "";
      const systemPrompt = `Je bent een expert op het gebied van KVK-registraties en de Wet DBA in Nederland.

Je hebt TWEE taken:
1. Vergelijk de KVK bedrijfsomschrijving/activiteiten met de feitelijke werkzaamheden uit de overeenkomst.
   Beoordeel of de werkzaamheden passen binnen de KVK-omschrijving.
2. Zoek de datum van het KVK-uittreksel in de tekst (vaak staat er "Datum uittreksel", "Uittreksel d.d.", "Datum" of een vergelijkbare aanduiding).
   Als je een datum vindt, geef deze terug in het formaat YYYY-MM-DD.

Dit is belangrijk voor Wet DBA compliance: als een zzp'er werkzaamheden verricht die niet passen bij zijn/haar KVK-registratie, kan dit wijzen op een schijnconstructie.
Een KVK-uittreksel dat ouder is dan 3 maanden is een aandachtspunt.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `KVK bedrijfsomschrijving/activiteiten:\n${check.kvk_text}\n\nWerkzaamheden uit de overeenkomst:\n${workDescription}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_kvk_check",
              description: "Report whether the KVK activities match the work being performed and the age of the KVK extract",
              parameters: {
                type: "object",
                properties: {
                  match: { type: "boolean", description: "Of de werkzaamheden passen bij de KVK-omschrijving" },
                  kvk_activities: { type: "string", description: "Samenvatting van de KVK-activiteiten" },
                  work_description: { type: "string", description: "Samenvatting van de feitelijke werkzaamheden" },
                  explanation: { type: "string", description: "Uitleg waarom het wel of niet matcht" },
                  suggestions: { type: "array", items: { type: "string" }, description: "Eventuele suggesties als het niet matcht" },
                  kvk_extract_date: { type: "string", description: "Datum van het KVK-uittreksel in YYYY-MM-DD formaat, of null als niet gevonden" },
                },
                required: ["match", "kvk_activities", "work_description", "explanation"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_kvk_check" } },
        }),
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ error: "AI KVK check mislukt" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        return new Response(JSON.stringify({ error: "Geen KVK check resultaat" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const kvkResult = JSON.parse(toolCall.function.arguments);

      // Check if KVK extract is older than 3 months
      if (kvkResult.kvk_extract_date) {
        const extractDate = new Date(kvkResult.kvk_extract_date);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        kvkResult.kvk_extract_expired = extractDate < threeMonthsAgo;
      } else {
        kvkResult.kvk_extract_expired = null; // could not determine
      }

      await supabase.from("dba_checks").update({
        kvk_check_result: kvkResult,
      }).eq("id", check_id);

      return new Response(JSON.stringify({ success: true, kvk_check_result: kvkResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "certify") {
      // Generate ZP Approved certificate PDF
      const verificationToken = crypto.randomUUID();
      const { data: seqData } = await supabase.rpc("nextval_text", { seq_name: "dba_cert_seq" });
      const certNum = "ZPDBA" + (seqData || Math.floor(Math.random() * 9000 + 1000));
      const certifiedAt = new Date().toISOString();

      let pdfPath: string | null = null;
      try {
        const pdfDoc = await PDFDocument.create();
        const pageWidth = 595.28;
        const pageHeight = 841.89;

        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const black = rgb(0, 0, 0);
        const gray = rgb(0.4, 0.4, 0.4);
        const darkGray = rgb(0.25, 0.25, 0.25);
        const headerBg = rgb(0.15, 0.15, 0.15);
        const lightGrayBg = rgb(0.96, 0.96, 0.96);
        const tableBorder = rgb(0.8, 0.8, 0.8);
        const green = rgb(0.1, 0.55, 0.1);
        const aandachtColor = rgb(0.8, 0.2, 0.0);
        const white = rgb(1, 1, 1);

        const margin = 50;
        const rightMargin = 50;
        const tableWidth = pageWidth - margin - rightMargin;
        const labelColWidth = 155;
        const valueColX = margin + labelColWidth;
        const fontSize = 8.5;
        const smallFont = 7.5;
        const rowPadding = 5;

        const formatDate = (d: string) => {
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2, "0")}-${String(dt.getMonth() + 1).padStart(2, "0")}-${dt.getFullYear()}`;
        };

        const formatLongDate = (d: string) => {
          const dt = new Date(d);
          const days = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
          const months = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
          return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
        };

        const cleanText = (text: string): string => {
          if (!text) return "-";
          return text.replace(/[\n\r\t\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim() || "-";
        };

        const wrapText = (text: string, font: typeof helvetica, size: number, maxW: number): string[] => {
          const cleaned = cleanText(text);
          if (cleaned === "-") return ["-"];
          const words = cleaned.split(" ");
          const lines: string[] = [];
          let cur = "";
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
            else cur = test;
          }
          if (cur) lines.push(cur);
          return lines.length > 0 ? lines : ["-"];
        };

        // Parse rich description text into structured blocks (paragraphs + bullet points)
        const parseDescriptionBlocks = (text: string): Array<{ type: "paragraph" | "bullet"; text: string }> => {
          if (!text || text.trim() === "-") return [{ type: "paragraph", text: "-" }];
          // Split on real newlines
          const rawLines = text.split(/\n/).map(l => l.trim()).filter(l => l.length > 0);
          const blocks: Array<{ type: "paragraph" | "bullet"; text: string }> = [];
          for (const line of rawLines) {
            // Detect bullet points: lines starting with -, *, •, or numbered (1., 2.)
            if (/^[-*•]\s+/.test(line)) {
              blocks.push({ type: "bullet", text: line.replace(/^[-*•]\s+/, "").trim() });
            } else if (/^\d+[.)]\s+/.test(line)) {
              blocks.push({ type: "bullet", text: line.trim() });
            } else {
              blocks.push({ type: "paragraph", text: line });
            }
          }
          return blocks.length > 0 ? blocks : [{ type: "paragraph", text: "-" }];
        };

        // Render rich description inside a table cell
        const drawDescriptionRow = (label: string, rawText: string, altBg: boolean): void => {
          const blocks = parseDescriptionBlocks(rawText || "-");
          const bulletIndent = 12;
          const paragraphSpacing = 4;

          // Pre-calculate total height
          let totalLines = 0;
          const renderedBlocks: Array<{ type: string; lines: string[]; spaceBefore: number }> = [];
          blocks.forEach((block, idx) => {
            const spaceBefore = idx > 0 ? paragraphSpacing : 0;
            const maxW = block.type === "bullet" ? valueMaxW - bulletIndent : valueMaxW;
            const lines = wrapText(block.text, helvetica, fontSize, maxW);
            renderedBlocks.push({ type: block.type, lines, spaceBefore });
            totalLines += lines.length;
          });
          const totalExtraSpacing = renderedBlocks.reduce((sum, b) => sum + b.spaceBefore, 0);
          const cellH = Math.max(24, totalLines * lineHeight + totalExtraSpacing + rowPadding * 2);

          ensureSpace(cellH);

          // Background
          if (altBg) {
            currentPage.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, color: lightGrayBg });
          }
          // Border
          currentPage.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, borderColor: tableBorder, borderWidth: 0.4 });
          // Vertical divider
          currentPage.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - cellH }, thickness: 0.4, color: tableBorder });
          // Label
          currentPage.drawText(label, { x: margin + 8, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });

          // Draw blocks
          let drawY = y - 16;
          renderedBlocks.forEach((block) => {
            drawY -= block.spaceBefore;
            const xOffset = block.type === "bullet" ? bulletIndent : 0;
            block.lines.forEach((line, li) => {
              if (block.type === "bullet" && li === 0) {
                // Draw bullet marker
                currentPage.drawText("\u2022", { x: valueColX + 8, y: drawY, size: fontSize, font: helvetica, color: darkGray });
              }
              currentPage.drawText(line, { x: valueColX + 8 + xOffset, y: drawY, size: fontSize, font: helvetica, color: black });
              drawY -= lineHeight;
            });
          });

          y -= cellH;
        };

        // === PAGE SETUP ===
        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        let currentPage = page;

        // --- Embed logos (PNG) ---
        let zpLogoImage: any = null;
        let ofLogoImage: any = null;
        let sigImage: any = null;

        try {
          const { data: zpLogoData } = await supabase.storage.from("certificates").download("templates/zp-approved-logo.png");
          if (zpLogoData) {
            const zpLogoBytes = new Uint8Array(await zpLogoData.arrayBuffer());
            zpLogoImage = await pdfDoc.embedPng(zpLogoBytes);
          }
        } catch { /* skip */ }

        try {
          const { data: ofLogoData } = await supabase.storage.from("certificates").download("templates/onefellow-logo.png");
          if (ofLogoData) {
            const ofLogoBytes = new Uint8Array(await ofLogoData.arrayBuffer());
            ofLogoImage = await pdfDoc.embedPng(ofLogoBytes);
          }
        } catch { /* skip */ }

        try {
          const { data: sigData } = await supabase.storage.from("certificates").download("templates/signature-gertjan.png");
          if (sigData) {
            const sigBytes = new Uint8Array(await sigData.arrayBuffer());
            sigImage = await pdfDoc.embedPng(sigBytes);
          }
        } catch { /* skip */ }

        // Draw logos — aligned on same baseline, preserving aspect ratio
        const logoY = pageHeight - 75;
        if (zpLogoImage) {
          const zpOrigW = zpLogoImage.width;
          const zpOrigH = zpLogoImage.height;
          const zpTargetH = 50;
          const zpTargetW = (zpOrigW / zpOrigH) * zpTargetH;
          page.drawImage(zpLogoImage, { x: margin, y: logoY - 20, width: zpTargetW, height: zpTargetH });
        }
        if (ofLogoImage) {
          page.drawImage(ofLogoImage, { x: pageWidth - rightMargin - 140, y: logoY - 5, width: 140, height: 30 });
        }

        // --- Table helper with auto-pagination ---
        let y = pageHeight - 130;
        const lineHeight = 13;
        const valueMaxW = tableWidth - labelColWidth - 14;
        const footerZone = 75;

        const addNewPage = () => {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - 50;
          return currentPage;
        };

        const ensureSpace = (needed: number) => {
          if (y - needed < footerZone) {
            addNewPage();
          }
        };

        const drawRow = (label: string, value: string, opts?: { headerRow?: boolean; valueColor?: typeof black; valueBold?: boolean; altBg?: boolean }): void => {
          const valFont = opts?.valueBold ? helveticaBold : helvetica;
          const lines = wrapText(value || "-", valFont, fontSize, valueMaxW);
          const cellH = Math.max(24, lines.length * lineHeight + rowPadding * 2);

          ensureSpace(cellH);

          // Background
          if (opts?.headerRow) {
            currentPage.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, color: headerBg });
          } else if (opts?.altBg) {
            currentPage.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, color: lightGrayBg });
          }

          // Border
          currentPage.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, borderColor: tableBorder, borderWidth: 0.4 });

          if (!opts?.headerRow) {
            // Vertical divider
            currentPage.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - cellH }, thickness: 0.4, color: tableBorder });
            // Label
            currentPage.drawText(label, { x: margin + 8, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });
            // Value lines
            const valColor = opts?.valueColor || black;
            lines.forEach((line, i) => {
              currentPage.drawText(line, { x: valueColX + 8, y: y - 16 - i * lineHeight, size: fontSize, font: valFont, color: valColor });
            });
          } else {
            const headerText = label;
            const headerTextWidth = helveticaBold.widthOfTextAtSize(headerText, 10);
            const headerX = margin + (tableWidth - headerTextWidth) / 2;
            currentPage.drawText(headerText, { x: headerX, y: y - 16, size: 10, font: helveticaBold, color: white });
          }

          y -= cellH;
        };

        // === HEADER ROW ===
        drawRow("TOETSING ZP KANDIDAAT - WET DBA", "", { headerRow: true });

        // === Extract field values ===
        const suggestions = check.suggestions as any[];
        const fieldResults = (check.field_results || []) as any[];
        const getFieldValue = (name: string) => {
          const field = fieldResults.find((f: any) => f.field_name?.toLowerCase().includes(name.toLowerCase()));
          return field?.value || field?.excerpt || "";
        };
        const getFieldBool = (name: string): boolean | null => {
          const val = getFieldValue(name);
          if (!val) return null;
          const lower = val.toLowerCase().trim();
          if (lower === "ja" || lower === "yes" || lower === "true") return true;
          if (lower === "nee" || lower === "no" || lower === "false") return false;
          return null;
        };

        // === FORM ROWS ===
        let rowIdx = 0;
        const alt = () => { rowIdx++; return rowIdx % 2 === 0; };

        drawRow("Documentnummer", certNum, { valueBold: true, altBg: alt() });
        drawRow("Naam ZP kandidaat", getFieldValue("naam"), { altBg: alt() });
        drawRow("Opdrachtgever", check.opdrachtgever || check.client_name || "", { altBg: alt() });
        drawRow("Eindopdrachtgever", check.eindopdrachtgever || getFieldValue("eindopdrachtgever") || "-", { altBg: alt() });
        drawRow("Functie", check.functie || getFieldValue("functie") || "-", { altBg: alt() });
        const descAlt = alt();
        drawDescriptionRow("Opdrachtomschrijving", check.rewritten_description || check.project_description || getFieldValue("opdrachtomschrijving") || "-", descAlt);
        drawRow("Project", check.project_name || getFieldValue("project") || "-", { altBg: alt() });
        drawRow("Startdatum", check.startdatum ? formatDate(check.startdatum) : getFieldValue("startdatum") || "-", { altBg: alt() });
        drawRow("Einddatum", check.einddatum ? formatDate(check.einddatum) : getFieldValue("einddatum") || "-", { altBg: alt() });
        drawRow("Optie tot verlenging", check.optie_verlenging || getFieldValue("verlenging") || "-", { altBg: alt() });
        drawRow("Uurtarief", check.uurtarief || getFieldValue("uurtarief") || "-", { altBg: alt() });
        drawRow("Aantal uur per week", check.uren_per_week || getFieldValue("uur per week") || "-", { altBg: alt() });
        drawRow("Specifieke vaardigheden", check.specifieke_vaardigheden || getFieldValue("specifieke vaardigheden") || "-", { altBg: alt() });

        // === Zelfstandigheid rows ===
        const zelfstandigFromField = getFieldBool("zelfstandig naar buiten");
        const eigenMateriaalFromField = getFieldBool("eigen materiaal") ?? getFieldBool("zelfstandigheid");
        const zelfstandig = zelfstandigFromField ?? check.treedt_zelfstandig_op ?? false;
        const eigenMateriaal = eigenMateriaalFromField ?? check.eigen_materiaal_werkwijze ?? false;
        drawRow("Treedt zelfstandig naar buiten", zelfstandig ? "Ja" : "Nee", { valueColor: zelfstandig ? green : aandachtColor, valueBold: true, altBg: alt() });
        drawRow("Eigen materiaal en werkwijze", eigenMateriaal ? "Ja" : "Nee", { valueColor: eigenMateriaal ? green : aandachtColor, valueBold: true, altBg: alt() });

        // === DOSSIER SECTION ===
        const checklist = (check.document_checklist || []) as any[];
        if (checklist.length > 0) {
          y -= 6;
          ensureSpace(24 + checklist.length * 15);
          // Section header
          currentPage.drawRectangle({ x: margin, y: y - 20, width: tableWidth, height: 20, color: rgb(0.92, 0.92, 0.92), borderColor: tableBorder, borderWidth: 0.4 });
          currentPage.drawText("Dossier overzicht", { x: margin + 8, y: y - 14, size: fontSize, font: helveticaBold, color: darkGray });
          y -= 20;
          
          checklist.forEach((item: any) => {
            ensureSpace(16);
            const isPresent = item.status === "aanwezig";
            const icon = isPresent ? "V" : "X";
            const color = isPresent ? green : aandachtColor;
            const statusText = isPresent ? "Aanwezig" : "Niet aanwezig";
            currentPage.drawText(icon, { x: margin + 10, y: y - 12, size: 9, font: helveticaBold, color });
            currentPage.drawText(item.document_name || "", { x: margin + 26, y: y - 12, size: fontSize, font: helvetica, color: darkGray });
            currentPage.drawText(statusText, { x: pageWidth - rightMargin - 80, y: y - 12, size: smallFont, font: helvetica, color });
            y -= 16;
          });
          y -= 4;
        }

        // === AANDACHTSPUNTEN SECTION ===
        const uniqueAandachtspunten = new Set<string>();
        const aiAandachtspunten = suggestions?.[0]?.aandachtspunten as string[] || [];
        aiAandachtspunten.forEach((a: string) => {
          const cleaned = cleanText(a);
          if (cleaned !== "-") uniqueAandachtspunten.add(cleaned);
        });
        checklist.forEach((item: any) => {
          if (item.status !== "aanwezig") {
            const docName = item.document_name || "";
            if (docName) {
              const label = item.status === "niet_aanwezig" ? `${docName} (niet aanwezig)` : `${docName} (niet geverifieerd)`;
              const alreadyCovered = Array.from(uniqueAandachtspunten).some(a => a.toLowerCase().includes(docName.toLowerCase()));
              if (!alreadyCovered) uniqueAandachtspunten.add(label);
            }
          }
        });
        // Add KVK extract age warning
        const kvkForAge = check.kvk_check_result as any;
        if (kvkForAge?.kvk_extract_expired === true) {
          const dateStr = kvkForAge.kvk_extract_date || "onbekend";
          uniqueAandachtspunten.add(`KVK-uittreksel is ouder dan 3 maanden (datum: ${dateStr})`);
        } else if (kvkForAge && kvkForAge.kvk_extract_date === null && kvkForAge.kvk_extract_expired === null) {
          uniqueAandachtspunten.add("Datum KVK-uittreksel kon niet worden vastgesteld");
        }

        // Add insurance policy warning
        const insurancePolicyDate = suggestions?.[0]?.insurance_policy_date;
        const certInsuranceExpired = suggestions?.[0]?.insurance_policy_expired;
        const certInsuranceMissing = suggestions?.[0]?.insurance_missing;
        if (certInsuranceMissing) {
          uniqueAandachtspunten.add("Polis beroeps- en bedrijfsaansprakelijkheid is niet aangeleverd");
        } else if (certInsuranceExpired === true) {
          uniqueAandachtspunten.add(`Polis beroeps-/bedrijfsaansprakelijkheid is ouder dan 1 jaar (datum: ${insurancePolicyDate})`);
        } else if (!certInsuranceMissing && (insurancePolicyDate === null || insurancePolicyDate === undefined)) {
          uniqueAandachtspunten.add("Datum polis beroeps-/bedrijfsaansprakelijkheid kon niet worden vastgesteld");
        }

        const aandachtspunten = Array.from(uniqueAandachtspunten);

        if (aandachtspunten.length > 0) {
          y -= 4;
          ensureSpace(24 + aandachtspunten.length * 14);
          currentPage.drawRectangle({ x: margin, y: y - 20, width: tableWidth, height: 20, color: rgb(1, 0.95, 0.9), borderColor: aandachtColor, borderWidth: 0.4 });
          currentPage.drawText("Aandachtspunten", { x: margin + 8, y: y - 14, size: fontSize, font: helveticaBold, color: aandachtColor });
          y -= 20;

          aandachtspunten.forEach((punt) => {
            ensureSpace(14);
            let text = punt;
            while (helvetica.widthOfTextAtSize(`- ${text}`, smallFont) > tableWidth - 20 && text.length > 10) {
              text = text.substring(0, text.length - 4) + "...";
            }
            currentPage.drawText(`- ${text}`, { x: margin + 10, y: y - 11, size: smallFont, font: helvetica, color: aandachtColor });
            y -= 14;
          });
          y -= 4;
        }

        // === KVK CHECK CONCLUSIE ===
        const kvkResult = check.kvk_check_result as any;
        if (kvkResult) {
          const kvkMatch = kvkResult.match === true;
          const kvkColor = kvkMatch ? green : aandachtColor;
          const kvkBgColor = kvkMatch ? rgb(0.93, 0.98, 0.93) : rgb(1, 0.95, 0.9);
          const kvkTitle = kvkMatch ? "KVK Check: Positief - Activiteiten komen overeen" : "KVK Check: Afwijking geconstateerd";

          y -= 6;
          ensureSpace(26);
          currentPage.drawRectangle({ x: margin, y: y - 22, width: tableWidth, height: 22, color: kvkBgColor, borderColor: kvkColor, borderWidth: 0.6 });
          currentPage.drawText(kvkTitle, { x: margin + 10, y: y - 15, size: 9, font: helveticaBold, color: kvkColor });
          y -= 24;

          const kvkExplanation = kvkResult.explanation || "";
          if (kvkExplanation) {
            const expLines = wrapText(kvkExplanation, helvetica, smallFont, tableWidth - 16);
            expLines.forEach((line: string) => {
              ensureSpace(13);
              currentPage.drawText(line, { x: margin + 8, y: y - 10, size: smallFont, font: helvetica, color: darkGray });
              y -= 12;
            });
          }

          if (!kvkMatch && kvkResult.suggestions && kvkResult.suggestions.length > 0) {
            y -= 4;
            ensureSpace(16);
            currentPage.drawText("Suggesties:", { x: margin + 8, y: y - 10, size: smallFont, font: helveticaBold, color: aandachtColor });
            y -= 14;
            kvkResult.suggestions.forEach((sug: string) => {
              const sugLines = wrapText(sug, helvetica, smallFont, tableWidth - 30);
              sugLines.forEach((line: string) => {
                ensureSpace(13);
                currentPage.drawText(`- ${line}`, { x: margin + 14, y: y - 10, size: smallFont, font: helvetica, color: aandachtColor });
                y -= 12;
              });
            });
          }
          y -= 4;
        }

        // === COMPLIANCE SCORE ===
        const score = suggestions?.[0]?.score;
        const summary = suggestions?.[0]?.summary;
        if (score !== undefined) {
          y -= 8;
          ensureSpace(32);
          const scoreColor = score >= 80 ? green : aandachtColor;
          const scoreBgColor = score >= 80 ? rgb(0.93, 0.98, 0.93) : rgb(1, 0.95, 0.9);
          const scoreBoxH = 30;
          currentPage.drawRectangle({ x: margin, y: y - scoreBoxH, width: tableWidth, height: scoreBoxH, color: scoreBgColor, borderColor: scoreColor, borderWidth: 0.6 });
          currentPage.drawText(`Compliance score: ${score}%`, { x: margin + 12, y: y - 20, size: 12, font: helveticaBold, color: scoreColor });
          y -= scoreBoxH + 4;
        }

        if (summary) {
          const summaryLines = wrapText(summary, helvetica, smallFont, tableWidth - 14);
          summaryLines.forEach((line) => {
            ensureSpace(13);
            currentPage.drawText(line, { x: margin + 6, y: y - 10, size: smallFont, font: helvetica, color: darkGray });
            y -= 12;
          });
          y -= 6;
        }

        // === VOOR AKKOORD section (always rendered, new page if needed) ===
        ensureSpace(110);
        y -= 10;

        // Dark header bar
        currentPage.drawRectangle({ x: margin, y: y - 24, width: tableWidth, height: 24, color: headerBg });
        currentPage.drawText("Voor akkoord", { x: margin + 8, y: y - 17, size: 10, font: helveticaBold, color: white });
        y -= 24;

        // Afgiftedatum row
        const dateRowH = 24;
        currentPage.drawRectangle({ x: margin, y: y - dateRowH, width: tableWidth, height: dateRowH, borderColor: tableBorder, borderWidth: 0.4, color: white });
        currentPage.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - dateRowH }, thickness: 0.4, color: tableBorder });
        currentPage.drawText("Afgiftedatum", { x: margin + 8, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });
        currentPage.drawText(formatLongDate(certifiedAt), { x: valueColX + 8, y: y - 16, size: fontSize, font: helveticaBold, color: black });
        y -= dateRowH;

        // Signature row — bigger for signature image
        const sigRowH = 60;
        currentPage.drawRectangle({ x: margin, y: y - sigRowH, width: tableWidth, height: sigRowH, borderColor: tableBorder, borderWidth: 0.4, color: white });
        currentPage.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - sigRowH }, thickness: 0.4, color: tableBorder });
        currentPage.drawText("Ondertekend door", { x: margin + 8, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });
        currentPage.drawText("Gert-Jan Schellingerhout", { x: valueColX + 8, y: y - 16, size: fontSize, font: helvetica, color: black });

        // Draw signature image
        if (sigImage) {
          currentPage.drawImage(sigImage, { x: valueColX + 8, y: y - sigRowH + 8, width: 120, height: 35 });
        }
        y -= sigRowH;


        // === FOOTER on every page ===
        const pages = pdfDoc.getPages();
        for (const p of pages) {
          const footerY = 35;
          p.drawLine({ start: { x: margin, y: footerY + 15 }, end: { x: pageWidth - rightMargin, y: footerY + 15 }, thickness: 0.5, color: tableBorder });
          const footerTitle = "TOETSING ZP KANDIDAAT - WET DBA / VERSIE 2.1";
          const footerTitleWidth = helveticaBold.widthOfTextAtSize(footerTitle, 6.5);
          const footerTitleX = margin + (tableWidth - footerTitleWidth) / 2;
          p.drawText(footerTitle, {
            x: footerTitleX, y: footerY + 4, size: 6.5, font: helveticaBold, color: darkGray,
          });
          p.drawLine({ start: { x: margin, y: footerY }, end: { x: pageWidth - rightMargin, y: footerY }, thickness: 0.5, color: tableBorder });
          const footerLines = [
            "Onefellow B.V. | Tupolevlaan 41, 1119 NW, Schiphol-Rijk",
            "KvK: 81550022 | Bank: NL08 RABO 0343814471 | BTW: NL862134754B01",
            "Tel: 06 - 270 20 140 | E-mail: info@onefellow.nl | Web: www.onefellow.nl",
          ];
          footerLines.forEach((line, i) => {
            p.drawText(line, { x: margin + 30, y: footerY - 10 - i * 8, size: 5.5, font: helvetica, color: gray });
          });
        }

        // Save & upload
        const pdfBytes = await pdfDoc.save();
        const fileName = `dba/${certNum}.pdf`;
        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        const { error: uploadError } = await supabase.storage
          .from("certificates")
          .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: true });

        if (uploadError) {
          console.error("PDF upload error:", uploadError);
        } else {
          pdfPath = fileName;
        }
      } catch (pdfErr) {
        console.error("PDF generation error:", pdfErr);
      }

      // Update check record
      await supabase.from("dba_checks").update({
        status: "certified",
        certificate_number: certNum,
        certificate_pdf_url: pdfPath,
        verification_token: verificationToken,
        certified_at: certifiedAt,
        certified_by: user.id,
      }).eq("id", check_id);

      return new Response(JSON.stringify({
        success: true,
        certificate_number: certNum,
        verification_token: verificationToken,
        pdf_path: pdfPath,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
