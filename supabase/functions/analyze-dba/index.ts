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

BELANGRIJK BIJ HET BEOORDELEN:
1. De tekst is geëxtraheerd uit een Word-document. Checkboxes en selectievakjes worden NIET bewaard bij extractie.
   In de checklist-sectie staan twee kolommen: "van toepassing / aanwezig" en "niet van toepassing / niet aanwezig".
   Omdat checkboxes niet zichtbaar zijn in platte tekst, kun je NIET bepalen welke kolom is aangevinkt.
   Markeer deze items daarom als "niet_ingevuld" (status: "niet_ingevuld") zodat een medewerker dit handmatig kan controleren.
   Markeer een item ALLEEN als "aanwezig" als er EXPLICIET tekst staat die aangeeft dat het aanwezig is.
2. Beoordeel alleen een veld als NIET ingevuld als het veld echt volledig leeg is (geen tekst na de veldnaam).
3. Als een veld tekst bevat (ook al is het kort), markeer het als ingevuld (filled: true).
4. Het veld "Specifieke vaardigheden" is optioneel - als het leeg is, is dit een OPMERKING maar geen kritisch aandachtspunt.
5. Zoek ook naar het veld "Rechtsvorm" - als dit niet expliciet in het formulier staat, probeer het af te leiden uit bedrijfsnamen (bijv. "B.V.", "V.O.F.", "Eenmanszaak").

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
      // Generate ZP Approved stempel PDF - exact branding match
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
        const headerBg = rgb(0.85, 0.85, 0.85);
        const tableBorder = rgb(0.75, 0.75, 0.75);
        const aandachtColor = rgb(0.8, 0.2, 0.0); // Orange-red for aandachtspunten
        const white = rgb(1, 1, 1);

        const margin = 56;
        const tableWidth = pageWidth - margin * 2;
        const labelColWidth = 170;
        const valueColX = margin + labelColWidth;
        const fontSize = 8.5;
        const rowHeight = 20;

        const formatDate = (d: string) => {
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2, "0")}-${String(dt.getMonth() + 1).padStart(2, "0")}-${dt.getFullYear()}`;
        };

        const wrapText = (text: string, font: typeof helvetica, size: number, maxW: number): string[] => {
          if (!text) return ["-"];
          // Strip newlines and other control characters that pdf-lib cannot encode
          const cleaned = text.replace(/[\n\r\t\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim();
          if (!cleaned) return ["-"];
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

        // --- Logos ---
        try {
          const { data: zpLogoData } = await supabase.storage.from("certificates").download("templates/zp-approved-logo.jpg");
          if (zpLogoData) {
            const zpLogoBytes = new Uint8Array(await zpLogoData.arrayBuffer());
            const zpLogoImage = await pdfDoc.embedJpg(zpLogoBytes);
            page.drawImage(zpLogoImage, { x: margin, y: pageHeight - 130, width: 120, height: 120 });
          }
        } catch { /* skip logo */ }

        try {
          const { data: ofLogoData } = await supabase.storage.from("certificates").download("templates/onefellow-logo.jpg");
          if (ofLogoData) {
            const ofLogoBytes = new Uint8Array(await ofLogoData.arrayBuffer());
            const ofLogoImage = await pdfDoc.embedJpg(ofLogoBytes);
            page.drawImage(ofLogoImage, { x: pageWidth - margin - 200, y: pageHeight - 90, width: 200, height: 45 });
          }
        } catch { /* skip logo */ }

        // --- Table starts below logos ---
        let y = pageHeight - 170;

        // Helper: draw a table row
        const drawTableRow = (label: string, value: string, yPos: number, opts?: { headerRow?: boolean; valueColor?: typeof black; valueBold?: boolean }): number => {
          const valueMaxW = tableWidth - labelColWidth - 10;
          const lines = wrapText(value || "-", opts?.valueBold ? helveticaBold : helvetica, fontSize, valueMaxW);
          const cellHeight = Math.max(rowHeight, lines.length * 13 + 6);

          if (opts?.headerRow) {
            page.drawRectangle({ x: margin, y: yPos - cellHeight, width: tableWidth, height: cellHeight, color: headerBg });
          }

          // Cell borders
          page.drawRectangle({ x: margin, y: yPos - cellHeight, width: tableWidth, height: cellHeight, borderColor: tableBorder, borderWidth: 0.5, color: opts?.headerRow ? headerBg : white });
          // Vertical divider
          page.drawLine({ start: { x: valueColX, y: yPos }, end: { x: valueColX, y: yPos - cellHeight }, thickness: 0.5, color: tableBorder });

          // Label
          page.drawText(label, { x: margin + 6, y: yPos - 14, size: fontSize, font: helveticaBold, color: darkGray });

          // Value
          const valColor = opts?.valueColor || black;
          const valFont = opts?.valueBold ? helveticaBold : helvetica;
          lines.forEach((line, i) => {
            page.drawText(line, { x: valueColX + 6, y: yPos - 14 - i * 13, size: fontSize, font: valFont, color: valColor });
          });

          return yPos - cellHeight;
        };

        // Header row
        y = drawTableRow("Toetsing ZP kandidaat - Wet DBA", "", y, { headerRow: true });

        // Extract values from field_results analysis
        const suggestions = check.suggestions as any[];
        const fieldResults = (check.field_results || []) as any[];
        const getFieldValue = (name: string) => {
          const field = fieldResults.find((f: any) => f.field_name?.toLowerCase().includes(name.toLowerCase()));
          return field?.value || field?.excerpt || "";
        };

        // Derive booleans from field_results if DB columns are null/false
        const getFieldBool = (name: string): boolean | null => {
          const val = getFieldValue(name);
          if (!val) return null;
          const lower = val.toLowerCase().trim();
          if (lower === "ja" || lower === "yes" || lower === "true") return true;
          if (lower === "nee" || lower === "no" || lower === "false") return false;
          return null;
        };

        // Derive rechtsvorm from DB, field_results, or company name
        const deriveRechtsvorm = (): string => {
          if (check.rechtsvorm) return check.rechtsvorm;
          const fromField = getFieldValue("rechtsvorm");
          if (fromField) return fromField;
          // Try to derive from company names
          const names = [check.client_name, check.opdrachtgever, check.eindopdrachtgever, getFieldValue("opdrachtgever")].filter(Boolean).join(" ");
          if (names.includes("B.V.") || names.includes("BV")) return "B.V.";
          if (names.includes("V.O.F.")) return "V.O.F.";
          if (names.includes("N.V.")) return "N.V.";
          return "-";
        };

        // Form fields
        y = drawTableRow("Documentnummer", certNum, y);
        y = drawTableRow("Naam ZP kandidaat", getFieldValue("naam"), y);
        // Rechtsvorm removed per request
        y = drawTableRow("Opdrachtgever", check.opdrachtgever || check.client_name || "", y);
        y = drawTableRow("Eindopdrachtgever", check.eindopdrachtgever || getFieldValue("eindopdrachtgever") || "-", y);
        y = drawTableRow("Functie", check.functie || getFieldValue("functie") || "-", y);
        y = drawTableRow("Opdrachtomschrijving", check.rewritten_description || check.project_description || getFieldValue("opdrachtomschrijving") || "-", y);
        y = drawTableRow("Project", check.project_name || getFieldValue("project") || "-", y);
        y = drawTableRow("Startdatum", check.startdatum ? formatDate(check.startdatum) : getFieldValue("startdatum") || "-", y);
        y = drawTableRow("Einddatum", check.einddatum ? formatDate(check.einddatum) : getFieldValue("einddatum") || "-", y);
        y = drawTableRow("Optie tot verlenging", check.optie_verlenging || getFieldValue("verlenging") || "-", y);

        // Build aandachtspunten from missing fields + missing documents
        const checklist = (check.document_checklist || []) as any[];
        const missingFields = (check.missing_fields || []) as string[];
        
        // Collect all aandachtspunten
        const aandachtspunten: string[] = [];
        
        // 1. Fields not filled in by the client
        fieldResults.forEach((f: any) => {
          if (!(f.present ?? f.filled)) {
            aandachtspunten.push(f.field_name || "Onbekend veld");
          }
        });
        
        // 2. Missing fields from AI analysis
        missingFields.forEach((mf: string) => {
          if (!aandachtspunten.includes(mf)) {
            aandachtspunten.push(mf);
          }
        });
        
        // 3. Missing or unverified documents from checklist
        checklist.forEach((item: any) => {
          if (item.status !== "aanwezig") {
            const docName = item.document_name || "";
            const label = item.status === "niet_aanwezig" ? `${docName} (niet aanwezig)` : `${docName} (niet geverifieerd)`;
            if (docName && !aandachtspunten.some((a: string) => a.includes(docName))) {
              aandachtspunten.push(label);
            }
          }
        });

        // Dossier section - show checklist items
        const dossierItems = checklist.length > 0 ? checklist : [];
        const dossierCount = Math.max(dossierItems.length, 1);
        const aandachtCount = Math.max(aandachtspunten.length, 1);
        const maxItems = Math.max(dossierCount, aandachtCount);
        const combinedHeight = Math.max(maxItems * 14 + 30, 60);

        // Outer border for combined row
        page.drawRectangle({ x: margin, y: y - combinedHeight, width: tableWidth, height: combinedHeight, borderColor: tableBorder, borderWidth: 0.5, color: white });
        page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - combinedHeight }, thickness: 0.5, color: tableBorder });

        // Dossier label
        page.drawText("Dossier:", { x: margin + 6, y: y - 14, size: fontSize, font: helveticaBold, color: darkGray });

        // Aandachtspunten header
        page.drawText("Aandachtspunten:", { x: valueColX + 6, y: y - 14, size: fontSize, font: helveticaBold, color: aandachtColor });

        // Dossier items with checkmarks
        if (dossierItems.length > 0) {
          dossierItems.forEach((item: any, i: number) => {
            const yItem = y - 30 - i * 14;
            if (yItem > y - combinedHeight + 5) {
              const isPresent = item.status === "aanwezig";
              const statusIcon = isPresent ? "V" : "X";
              const statusColor = isPresent ? rgb(0.1, 0.55, 0.1) : aandachtColor;
              page.drawText(statusIcon, { x: margin + 10, y: yItem, size: 8, font: helveticaBold, color: statusColor });
              page.drawText(item.document_name || "", { x: margin + 24, y: yItem, size: 7.5, font: helvetica, color: darkGray });
            }
          });
        } else {
          page.drawText("-", { x: margin + 10, y: y - 30, size: 7.5, font: helvetica, color: gray });
        }

        // Aandachtspunten items
        if (aandachtspunten.length > 0) {
          aandachtspunten.forEach((punt, i) => {
            const yItem = y - 30 - i * 14;
            if (yItem > y - combinedHeight + 5) {
              const cleaned = punt.replace(/[\n\r\t\x00-\x1F]/g, " ").replace(/\s+/g, " ").trim();
              page.drawText(`- ${cleaned}`, { x: valueColX + 10, y: yItem, size: 7.5, font: helvetica, color: aandachtColor });
            }
          });
        } else {
          page.drawText("Geen aandachtspunten", { x: valueColX + 10, y: y - 30, size: 7.5, font: helvetica, color: rgb(0.1, 0.55, 0.1) });
        }

        y -= combinedHeight;

        // Zelfstandigheid rows - prioritize field_results over DB columns
        const zelfstandigFromField = getFieldBool("zelfstandig naar buiten");
        const eigenMateriaalFromField = getFieldBool("eigen materiaal") ?? getFieldBool("zelfstandigheid");
        const zelfstandig = zelfstandigFromField ?? check.treedt_zelfstandig_op ?? false;
        const eigenMateriaal = eigenMateriaalFromField ?? check.eigen_materiaal_werkwijze ?? false;
        y = drawTableRow("Treedt zelfstandig naar buiten", zelfstandig ? "Ja" : "Nee", y, { valueColor: zelfstandig ? rgb(0.1, 0.55, 0.1) : aandachtColor, valueBold: true });
        y = drawTableRow("Eigen materiaal en werkwijze", eigenMateriaal ? "Ja" : "Nee", y, { valueColor: eigenMateriaal ? rgb(0.1, 0.55, 0.1) : aandachtColor, valueBold: true });

        // Voor akkoord header row
        const akkoordHeight = rowHeight;
        page.drawRectangle({ x: margin, y: y - akkoordHeight, width: tableWidth, height: akkoordHeight, color: rgb(0.15, 0.15, 0.15) });
        page.drawRectangle({ x: margin, y: y - akkoordHeight, width: tableWidth, height: akkoordHeight, borderColor: tableBorder, borderWidth: 0.5 });
        page.drawText("Voor akkoord", { x: pageWidth - margin - 80, y: y - 14, size: fontSize, font: helveticaBold, color: white });
        y -= akkoordHeight;

        // Toetsingsdatum & Afgiftedatum
        y = drawTableRow("Toetsingsdatum", formatDate(certifiedAt), y);

        // Afgiftedatum row with signature
        const sigRowHeight = 40;
        page.drawRectangle({ x: margin, y: y - sigRowHeight, width: tableWidth, height: sigRowHeight, borderColor: tableBorder, borderWidth: 0.5, color: white });
        page.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - sigRowHeight }, thickness: 0.5, color: tableBorder });
        page.drawText("Afgiftedatum", { x: margin + 6, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });
        page.drawText(formatDate(certifiedAt), { x: valueColX + 6, y: y - 16, size: fontSize, font: helvetica, color: black });

        // Embed signature
        try {
          const { data: sigData } = await supabase.storage.from("certificates").download("templates/signature-gertjan.jpg");
          if (sigData) {
            const sigBytes = new Uint8Array(await sigData.arrayBuffer());
            const sigImage = await pdfDoc.embedJpg(sigBytes);
            page.drawImage(sigImage, { x: pageWidth - margin - 120, y: y - sigRowHeight + 4, width: 100, height: 32 });
          }
        } catch { /* skip signature */ }

        y -= sigRowHeight;

        // Compliance score
        const score = suggestions?.[0]?.score;
        if (score !== undefined) {
          y -= 15;
          page.drawText(`Compliance score: ${score}%`, { x: margin, y, size: 10, font: helveticaBold, color: score >= 80 ? rgb(0.1, 0.55, 0.1) : aandachtColor });
        }

        // Verification URL
        y -= 15;
        const verifyUrl = `https://zzpproject.lovable.app/verificatie/dba/${verificationToken}`;
        page.drawText(`Verificatie: ${verifyUrl}`, { x: margin, y, size: 6.5, font: helvetica, color: gray });

        // === Footer ===
        const footerY = 55;
        page.drawLine({ start: { x: margin, y: footerY + 18 }, end: { x: pageWidth - margin, y: footerY + 18 }, thickness: 0.5, color: tableBorder });
        page.drawText("TOETSING ZP KANDIDAAT – WET DBA / VERSIE 2.1", {
          x: margin + 80, y: footerY + 5, size: 7, font: helveticaBold, color: darkGray,
        });
        page.drawLine({ start: { x: margin, y: footerY }, end: { x: pageWidth - margin, y: footerY }, thickness: 0.5, color: tableBorder });

        const footerLines = [
          "Onefellow B.V. | Tupolevlaan 41, 1119 NW, Schiphol-Rijk",
          "Kamer van Koophandel: 81550022 | Bank: NL08 RABO 0343814471 | BTW nummer: NL862134754B01",
          "Telefoon: 06 – 270 20 140 | E-mail: info@onefellow.nl | Website: www.onefellow.nl",
        ];
        footerLines.forEach((line, i) => {
          page.drawText(line, { x: margin + 40, y: footerY - 12 - i * 9, size: 6, font: helvetica, color: gray });
        });

        // === PAGE 2 (blank with logos + footer, matching original) ===
        const page2 = pdfDoc.addPage([pageWidth, pageHeight]);
        try {
          const { data: zpLogoData } = await supabase.storage.from("certificates").download("templates/zp-approved-logo.jpg");
          if (zpLogoData) {
            const zpLogoBytes = new Uint8Array(await zpLogoData.arrayBuffer());
            const zpLogoImage = await pdfDoc.embedJpg(zpLogoBytes);
            page2.drawImage(zpLogoImage, { x: margin, y: pageHeight - 130, width: 120, height: 120 });
          }
        } catch {}
        try {
          const { data: ofLogoData } = await supabase.storage.from("certificates").download("templates/onefellow-logo.jpg");
          if (ofLogoData) {
            const ofLogoBytes = new Uint8Array(await ofLogoData.arrayBuffer());
            const ofLogoImage = await pdfDoc.embedJpg(ofLogoBytes);
            page2.drawImage(ofLogoImage, { x: pageWidth - margin - 200, y: pageHeight - 90, width: 200, height: 45 });
          }
        } catch {}
        // Page 2 footer
        page2.drawLine({ start: { x: margin, y: footerY + 18 }, end: { x: pageWidth - margin, y: footerY + 18 }, thickness: 0.5, color: tableBorder });
        page2.drawText("TOETSING ZP KANDIDAAT – WET DBA / VERSIE 2.1", {
          x: margin + 80, y: footerY + 5, size: 7, font: helveticaBold, color: darkGray,
        });
        page2.drawLine({ start: { x: margin, y: footerY }, end: { x: pageWidth - margin, y: footerY }, thickness: 0.5, color: tableBorder });
        footerLines.forEach((line, i) => {
          page2.drawText(line, { x: margin + 40, y: footerY - 12 - i * 9, size: 6, font: helvetica, color: gray });
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
