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

      await supabase.from("dba_checks").update({
        field_results: analysis.form_fields,
        missing_fields: missingFields,
        document_checklist: analysis.checklist_items,
        suggestions: [{ score: analysis.overall_score, summary: analysis.summary, aandachtspunten: analysis.aandachtspunten }],
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
      const rewritten = aiResult.choices?.[0]?.message?.content || "";

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
Vergelijk de KVK bedrijfsomschrijving/activiteiten met de feitelijke werkzaamheden uit de overeenkomst.
Beoordeel of de werkzaamheden passen binnen de KVK-omschrijving.

Dit is belangrijk voor Wet DBA compliance: als een zzp'er werkzaamheden verricht die niet passen bij zijn/haar KVK-registratie, kan dit wijzen op een schijnconstructie.`;

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
              description: "Report whether the KVK activities match the work being performed",
              parameters: {
                type: "object",
                properties: {
                  match: { type: "boolean", description: "Of de werkzaamheden passen bij de KVK-omschrijving" },
                  kvk_activities: { type: "string", description: "Samenvatting van de KVK-activiteiten" },
                  work_description: { type: "string", description: "Samenvatting van de feitelijke werkzaamheden" },
                  explanation: { type: "string", description: "Uitleg waarom het wel of niet matcht" },
                  suggestions: { type: "array", items: { type: "string" }, description: "Eventuele suggesties als het niet matcht" },
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

        // === PAGE 1 ===
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

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

        // Draw logos
        if (zpLogoImage) {
          page.drawImage(zpLogoImage, { x: margin, y: pageHeight - 110, width: 90, height: 90 });
        }
        if (ofLogoImage) {
          page.drawImage(ofLogoImage, { x: pageWidth - rightMargin - 160, y: pageHeight - 72, width: 160, height: 35 });
        }

        // --- Table helper ---
        let y = pageHeight - 140;
        const lineHeight = 12;
        const valueMaxW = tableWidth - labelColWidth - 12;

        const drawRow = (label: string, value: string, opts?: { headerRow?: boolean; valueColor?: typeof black; valueBold?: boolean; altBg?: boolean }): void => {
          const valFont = opts?.valueBold ? helveticaBold : helvetica;
          const lines = wrapText(value || "-", valFont, fontSize, valueMaxW);
          const cellH = Math.max(22, lines.length * lineHeight + rowPadding * 2);

          // Check page overflow
          if (y - cellH < 80) return; // safety: don't draw below footer

          // Background
          if (opts?.headerRow) {
            page.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, color: headerBg });
          } else if (opts?.altBg) {
            page.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, color: lightGrayBg });
          }

          // Border
          page.drawRectangle({ x: margin, y: y - cellH, width: tableWidth, height: cellH, borderColor: tableBorder, borderWidth: 0.4 });

          if (!opts?.headerRow) {
            // Vertical divider
            page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - cellH }, thickness: 0.4, color: tableBorder });
            // Label
            page.drawText(label, { x: margin + 8, y: y - 15, size: fontSize, font: helveticaBold, color: darkGray });
            // Value lines
            const valColor = opts?.valueColor || black;
            lines.forEach((line, i) => {
              page.drawText(line, { x: valueColX + 8, y: y - 15 - i * lineHeight, size: fontSize, font: valFont, color: valColor });
            });
          } else {
            // Header: centered text
            page.drawText(label, { x: margin + 8, y: y - 15, size: 9, font: helveticaBold, color: white });
          }

          y -= cellH;
        };

        // === HEADER ROW ===
        drawRow("TOETSING ZP KANDIDAAT – WET DBA", "", { headerRow: true });

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
        drawRow("Opdrachtomschrijving", check.rewritten_description || check.project_description || getFieldValue("opdrachtomschrijving") || "-", { altBg: alt() });
        drawRow("Project", check.project_name || getFieldValue("project") || "-", { altBg: alt() });
        drawRow("Startdatum", check.startdatum ? formatDate(check.startdatum) : getFieldValue("startdatum") || "-", { altBg: alt() });
        drawRow("Einddatum", check.einddatum ? formatDate(check.einddatum) : getFieldValue("einddatum") || "-", { altBg: alt() });
        drawRow("Optie tot verlenging", check.optie_verlenging || getFieldValue("verlenging") || "-", { altBg: alt() });
        drawRow("Uurtarief", check.uurtarief || getFieldValue("uurtarief") || "-", { altBg: alt() });
        drawRow("Aantal uur per week", check.uren_per_week || getFieldValue("uur per week") || "-", { altBg: alt() });
        drawRow("Specifieke vaardigheden", check.specifieke_vaardigheden || getFieldValue("specifieke vaardigheden") || "-", { altBg: alt() });

        // === AANDACHTSPUNTEN - deduplicated ===
        const checklist = (check.document_checklist || []) as any[];
        const uniqueAandachtspunten = new Set<string>();

        // From AI analysis suggestions (primary source)
        const aiAandachtspunten = suggestions?.[0]?.aandachtspunten as string[] || [];
        aiAandachtspunten.forEach((a: string) => {
          const cleaned = cleanText(a);
          if (cleaned !== "-") uniqueAandachtspunten.add(cleaned);
        });

        // From checklist: missing docs
        checklist.forEach((item: any) => {
          if (item.status !== "aanwezig") {
            const docName = item.document_name || "";
            if (docName) {
              const label = item.status === "niet_aanwezig" ? `${docName} (niet aanwezig)` : `${docName} (niet geverifieerd)`;
              // Only add if not already covered
              const alreadyCovered = Array.from(uniqueAandachtspunten).some(a => a.toLowerCase().includes(docName.toLowerCase()));
              if (!alreadyCovered) uniqueAandachtspunten.add(label);
            }
          }
        });

        const aandachtspunten = Array.from(uniqueAandachtspunten);

        // === DOSSIER + AANDACHTSPUNTEN combined section ===
        const dossierItems = checklist.length > 0 ? checklist : [];
        const dossierLineCount = Math.max(dossierItems.length, 1);
        const aandachtLineCount = Math.max(aandachtspunten.length, 1);
        const maxLines = Math.max(dossierLineCount, aandachtLineCount);
        const sectionHeight = Math.max(maxLines * 14 + 30, 50);

        // Only draw if fits
        if (y - sectionHeight > 80) {
          page.drawRectangle({ x: margin, y: y - sectionHeight, width: tableWidth, height: sectionHeight, borderColor: tableBorder, borderWidth: 0.4, color: white });
          page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - sectionHeight }, thickness: 0.4, color: tableBorder });

          // Dossier header + items
          page.drawText("Dossier:", { x: margin + 8, y: y - 14, size: fontSize, font: helveticaBold, color: darkGray });
          if (dossierItems.length > 0) {
            dossierItems.forEach((item: any, i: number) => {
              const yItem = y - 30 - i * 14;
              if (yItem > y - sectionHeight + 5) {
                const isPresent = item.status === "aanwezig";
                const icon = isPresent ? "V" : "X";
                const color = isPresent ? green : aandachtColor;
                page.drawText(icon, { x: margin + 12, y: yItem, size: 8, font: helveticaBold, color });
                page.drawText(item.document_name || "", { x: margin + 26, y: yItem, size: smallFont, font: helvetica, color: darkGray });
              }
            });
          }

          // Aandachtspunten header + items
          page.drawText("Aandachtspunten:", { x: valueColX + 8, y: y - 14, size: fontSize, font: helveticaBold, color: aandachtColor });
          if (aandachtspunten.length > 0) {
            aandachtspunten.forEach((punt, i) => {
              const yItem = y - 30 - i * 14;
              if (yItem > y - sectionHeight + 5) {
                // Truncate if too wide
                let text = punt;
                while (helvetica.widthOfTextAtSize(`• ${text}`, smallFont) > valueMaxW - 10 && text.length > 10) {
                  text = text.substring(0, text.length - 4) + "...";
                }
                page.drawText(`• ${text}`, { x: valueColX + 10, y: yItem, size: smallFont, font: helvetica, color: aandachtColor });
              }
            });
          } else {
            page.drawText("Geen aandachtspunten", { x: valueColX + 10, y: y - 30, size: smallFont, font: helvetica, color: green });
          }

          y -= sectionHeight;
        }

        // === Zelfstandigheid rows ===
        const zelfstandigFromField = getFieldBool("zelfstandig naar buiten");
        const eigenMateriaalFromField = getFieldBool("eigen materiaal") ?? getFieldBool("zelfstandigheid");
        const zelfstandig = zelfstandigFromField ?? check.treedt_zelfstandig_op ?? false;
        const eigenMateriaal = eigenMateriaalFromField ?? check.eigen_materiaal_werkwijze ?? false;
        drawRow("Treedt zelfstandig naar buiten", zelfstandig ? "Ja" : "Nee", { valueColor: zelfstandig ? green : aandachtColor, valueBold: true, altBg: true });
        drawRow("Eigen materiaal en werkwijze", eigenMateriaal ? "Ja" : "Nee", { valueColor: eigenMateriaal ? green : aandachtColor, valueBold: true });

        // === COMPLIANCE SCORE ===
        const score = suggestions?.[0]?.score;
        const summary = suggestions?.[0]?.summary;
        if (score !== undefined && y - 30 > 80) {
          y -= 5;
          const scoreColor = score >= 80 ? green : aandachtColor;
          const scoreBgColor = score >= 80 ? rgb(0.93, 0.98, 0.93) : rgb(1, 0.95, 0.9);
          const scoreBoxH = 28;
          page.drawRectangle({ x: margin, y: y - scoreBoxH, width: tableWidth, height: scoreBoxH, color: scoreBgColor, borderColor: scoreColor, borderWidth: 0.6 });
          page.drawText(`Compliance score: ${score}%`, { x: margin + 10, y: y - 18, size: 11, font: helveticaBold, color: scoreColor });
          y -= scoreBoxH + 3;
        }

        if (summary && y - 30 > 80) {
          const summaryLines = wrapText(summary, helvetica, smallFont, tableWidth - 10);
          summaryLines.forEach((line) => {
            if (y - 12 > 80) {
              page.drawText(line, { x: margin + 5, y: y - 10, size: smallFont, font: helvetica, color: darkGray });
              y -= 11;
            }
          });
          y -= 3;
        }

        // === VOOR AKKOORD section ===
        if (y - 90 > 80) {
          y -= 10;
          // Dark header bar
          page.drawRectangle({ x: margin, y: y - 22, width: tableWidth, height: 22, color: headerBg });
          page.drawText("Voor akkoord", { x: margin + 8, y: y - 15, size: 9, font: helveticaBold, color: white });
          y -= 22;

          // Afgiftedatum row
          const dateRowH = 22;
          page.drawRectangle({ x: margin, y: y - dateRowH, width: tableWidth, height: dateRowH, borderColor: tableBorder, borderWidth: 0.4, color: white });
          page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - dateRowH }, thickness: 0.4, color: tableBorder });
          page.drawText("Afgiftedatum", { x: margin + 8, y: y - 15, size: fontSize, font: helveticaBold, color: darkGray });
          page.drawText(formatLongDate(certifiedAt), { x: valueColX + 8, y: y - 15, size: fontSize, font: helveticaBold, color: black });
          y -= dateRowH;

          // Signature row
          const sigRowH = 50;
          page.drawRectangle({ x: margin, y: y - sigRowH, width: tableWidth, height: sigRowH, borderColor: tableBorder, borderWidth: 0.4, color: white });
          page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - sigRowH }, thickness: 0.4, color: tableBorder });
          page.drawText("Ondertekend door", { x: margin + 8, y: y - 15, size: fontSize, font: helveticaBold, color: darkGray });
          page.drawText("Gert-Jan Schellingerhout", { x: valueColX + 8, y: y - 15, size: fontSize, font: helvetica, color: black });

          // Draw signature image
          if (sigImage) {
            page.drawImage(sigImage, { x: valueColX + 8, y: y - sigRowH + 5, width: 100, height: 30 });
          }
          y -= sigRowH;
        }

        // === Verification URL ===
        if (y - 20 > 60) {
          y -= 8;
          const verifyUrl = `https://zzpproject.lovable.app/verificatie/dba/${verificationToken}`;
          page.drawText(`Verificatie: ${verifyUrl}`, { x: margin, y, size: 6, font: helvetica, color: gray });
          y -= 12;
        }

        // === FOOTER ===
        const footerY = 40;
        page.drawLine({ start: { x: margin, y: footerY + 15 }, end: { x: pageWidth - rightMargin, y: footerY + 15 }, thickness: 0.5, color: tableBorder });
        page.drawText("TOETSING ZP KANDIDAAT – WET DBA / VERSIE 2.1", {
          x: margin + 60, y: footerY + 4, size: 6.5, font: helveticaBold, color: darkGray,
        });
        page.drawLine({ start: { x: margin, y: footerY }, end: { x: pageWidth - rightMargin, y: footerY }, thickness: 0.5, color: tableBorder });
        const footerLines = [
          "Onefellow B.V. | Tupolevlaan 41, 1119 NW, Schiphol-Rijk",
          "KvK: 81550022 | Bank: NL08 RABO 0343814471 | BTW: NL862134754B01",
          "Tel: 06 – 270 20 140 | E-mail: info@onefellow.nl | Web: www.onefellow.nl",
        ];
        footerLines.forEach((line, i) => {
          page.drawText(line, { x: margin + 30, y: footerY - 10 - i * 8, size: 5.5, font: helvetica, color: gray });
        });

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
