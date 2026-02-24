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
- E-mailadres
- Telefoonnummer
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

Controleer het ingevulde formulier en rapporteer voor elk veld of het is ingevuld.
Als een veld leeg is, niet ingevuld is, of als documentatie ontbreekt/niet aanwezig is: markeer dit als aandachtspunt.

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
      // Generate ZP Approved stempel PDF
      const verificationToken = crypto.randomUUID();
      const { data: seqData } = await supabase.rpc("nextval_text", { seq_name: "dba_cert_seq" });
      const certNum = "ZPDBA" + (seqData || Math.floor(Math.random() * 9000 + 1000));
      const certifiedAt = new Date().toISOString();

      let pdfPath: string | null = null;
      try {
        const pdfDoc = await PDFDocument.create();
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const black = rgb(0, 0, 0);
        const gray = rgb(0.35, 0.35, 0.35);
        const brandColor = rgb(0.76, 0.07, 0.16);
        const green = rgb(0.1, 0.55, 0.1);
        const lightGray = rgb(0.92, 0.92, 0.92);

        const labelX = 56;
        const valueX = 220;
        const fontSize = 9;
        const lineHeight = 16;
        const maxValueWidth = pageWidth - valueX - 40;

        const formatDate = (d: string) => {
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2, "0")}-${String(dt.getMonth() + 1).padStart(2, "0")}-${dt.getFullYear()}`;
        };

        const wrapText = (text: string, font: typeof helvetica, size: number, maxW: number): string[] => {
          const words = text.split(" ");
          const lines: string[] = [];
          let cur = "";
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (font.widthOfTextAtSize(test, size) > maxW && cur) { lines.push(cur); cur = w; }
            else cur = test;
          }
          if (cur) lines.push(cur);
          return lines;
        };

        const drawField = (label: string, value: string, yPos: number): number => {
          page.drawText(label, { x: labelX, y: yPos, size: fontSize, font: helveticaBold, color: gray });
          const lines = wrapText(value || "-", helvetica, fontSize, maxValueWidth);
          lines.forEach((line, i) => {
            page.drawText(line, { x: valueX, y: yPos - i * 12, size: fontSize, font: helvetica, color: black });
          });
          return yPos - Math.max(lines.length, 1) * lineHeight;
        };

        // === Header ===
        // Try to load template for background/logo
        try {
          const { data: templateData } = await supabase.storage.from("certificates").download("templates/certificate-template.png");
          if (templateData) {
            const templateBytes = new Uint8Array(await templateData.arrayBuffer());
            const templateImage = await pdfDoc.embedPng(templateBytes);
            page.drawImage(templateImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });
          }
        } catch { /* continue without template */ }

        // White header area for title
        page.drawRectangle({ x: 0, y: pageHeight - 130, width: pageWidth, height: 130, color: rgb(1, 1, 1) });

        // Title
        page.drawText("Toetsing ZP kandidaat - Wet DBA", {
          x: labelX, y: pageHeight - 50, size: 18, font: helveticaBold, color: black,
        });
        page.drawText(`Documentnummer: ${certNum}`, {
          x: labelX, y: pageHeight - 72, size: 10, font: helvetica, color: gray,
        });

        // Separator line
        page.drawRectangle({ x: labelX, y: pageHeight - 85, width: pageWidth - labelX * 2, height: 1, color: lightGray });

        // === Form Fields ===
        let y = pageHeight - 110;

        // Extract values from form_fields analysis
        const fieldResults = (check.field_results || []) as any[];
        const getFieldValue = (name: string) => {
          const field = fieldResults.find((f: any) => f.field_name?.toLowerCase().includes(name.toLowerCase()));
          return field?.value || "";
        };

        y = drawField("Naam ZP kandidaat:", getFieldValue("naam"), y);
        y = drawField("Rechtsvorm:", check.rechtsvorm || getFieldValue("rechtsvorm") || "-", y);
        y = drawField("Opdrachtgever:", check.opdrachtgever || check.client_name || "", y);
        y = drawField("Eindopdrachtgever:", check.eindopdrachtgever || getFieldValue("eindopdrachtgever") || "-", y);
        y = drawField("Functie:", check.functie || getFieldValue("functie") || "-", y);

        // Opdrachtomschrijving (potentially longer)
        const omschrijving = check.project_description || getFieldValue("opdrachtomschrijving") || "-";
        page.drawText("Opdrachtomschrijving:", { x: labelX, y, size: fontSize, font: helveticaBold, color: gray });
        const omschLines = wrapText(omschrijving, helvetica, 8, pageWidth - labelX - 60);
        y -= 2;
        omschLines.slice(0, 4).forEach((line, i) => {
          y -= 11;
          page.drawText(line, { x: labelX + 10, y, size: 8, font: helvetica, color: black });
        });
        y -= 8;

        y = drawField("Project:", check.project_name || getFieldValue("project") || "-", y);
        y = drawField("Startdatum:", check.startdatum ? formatDate(check.startdatum) : getFieldValue("startdatum") || "-", y);
        y = drawField("Einddatum:", check.einddatum ? formatDate(check.einddatum) : getFieldValue("einddatum") || "-", y);
        y = drawField("Optie tot verlenging:", check.optie_verlenging || getFieldValue("verlenging") || "-", y);

        // === Dossier (checklist) ===
        y -= 8;
        page.drawRectangle({ x: labelX, y: y + 4, width: pageWidth - labelX * 2, height: 1, color: lightGray });
        y -= 4;
        page.drawText("Dossier:", { x: labelX, y, size: 10, font: helveticaBold, color: black });
        y -= 4;

        const checklist = (check.document_checklist || []) as any[];
        for (const item of checklist) {
          y -= lineHeight;
          const icon = item.status === "aanwezig" ? "✓" : "✗";
          const color = item.status === "aanwezig" ? green : brandColor;
          page.drawText(icon, { x: labelX + 10, y, size: 10, font: helveticaBold, color });
          page.drawText(item.document_name || "", { x: labelX + 26, y, size: fontSize, font: helvetica, color: black });
        }

        // === Aandachtspunten ===
        const suggestions = check.suggestions as any[];
        const aandachtspunten: string[] = suggestions?.[0]?.aandachtspunten || [];
        
        y -= 12;
        page.drawRectangle({ x: labelX, y: y + 4, width: pageWidth - labelX * 2, height: 1, color: lightGray });
        y -= 4;
        page.drawText("Aandachtspunten:", { x: labelX, y, size: 10, font: helveticaBold, color: brandColor });

        if (aandachtspunten.length === 0) {
          y -= lineHeight;
          page.drawText("Geen aandachtspunten.", { x: labelX + 10, y, size: fontSize, font: helvetica, color: green });
        } else {
          for (const punt of aandachtspunten) {
            const puntLines = wrapText(`• ${punt}`, helvetica, 8, pageWidth - labelX - 70);
            for (const line of puntLines) {
              y -= 12;
              if (y < 80) break;
              page.drawText(line, { x: labelX + 10, y, size: 8, font: helvetica, color: brandColor });
            }
            if (y < 80) break;
          }
        }

        // === Zelfstandigheid ===
        y -= 12;
        const zelfstandig = check.treedt_zelfstandig_op;
        const eigenMateriaal = check.eigen_materiaal_werkwijze;
        page.drawText(zelfstandig ? "✓" : "✗", { x: labelX + 10, y, size: 10, font: helveticaBold, color: zelfstandig ? green : brandColor });
        page.drawText("Treedt zelfstandig naar buiten", { x: labelX + 26, y, size: fontSize, font: helvetica, color: black });
        y -= lineHeight;
        page.drawText(eigenMateriaal ? "✓" : "✗", { x: labelX + 10, y, size: 10, font: helveticaBold, color: eigenMateriaal ? green : brandColor });
        page.drawText("Eigen materiaal en werkwijze", { x: labelX + 26, y, size: fontSize, font: helvetica, color: black });

        // === Approval section ===
        y -= 20;
        page.drawRectangle({ x: labelX, y: y + 4, width: pageWidth - labelX * 2, height: 1, color: lightGray });
        y -= 8;
        drawField("Toetsingsdatum:", formatDate(certifiedAt), y);
        y -= lineHeight;
        drawField("Afgiftedatum:", formatDate(certifiedAt), y);

        // Score
        const score = suggestions?.[0]?.score;
        if (score !== undefined) {
          y -= lineHeight + 4;
          page.drawText("Compliance score:", { x: labelX, y, size: fontSize, font: helveticaBold, color: gray });
          page.drawText(`${score}%`, { x: valueX, y, size: 12, font: helveticaBold, color: score >= 80 ? green : brandColor });
        }

        // Verification
        y -= 20;
        const verifyUrl = `https://zzpproject.lovable.app/verificatie/dba/${verificationToken}`;
        page.drawText("Verificatie:", { x: labelX, y, size: 7.5, font: helvetica, color: gray });
        page.drawText(verifyUrl, { x: valueX, y, size: 7, font: helvetica, color: gray });

        // Footer
        page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 50, color: rgb(1, 1, 1) });
        const footerLines = [
          "Deze toetsing is uitgevoerd door ZP Zaken B.V. op basis van een AI-gestuurde analyse van het toetsingsformulier.",
          "ZP Zaken is ingeschreven in het register Wft bij de AFM onder vergunningsnummer: 12050363.",
        ];
        footerLines.forEach((line, i) => {
          page.drawText(line, { x: labelX, y: 30 - i * 9, size: 6.5, font: helvetica, color: gray });
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
