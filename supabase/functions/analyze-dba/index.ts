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
      // Generate DBA certificate with PDF
      const verificationToken = crypto.randomUUID();
      const { data: seqData } = await supabase.rpc("nextval_text", { seq_name: "dba_cert_seq" });
      const certNum = "ZPDBA" + (seqData || Math.floor(Math.random() * 9000 + 1000));
      const certifiedAt = new Date().toISOString();

      // === Generate PDF ===
      let pdfPath: string | null = null;
      try {
        // Load template
        const { data: templateData, error: templateError } = await supabase.storage
          .from("certificates")
          .download("templates/certificate-template.png");

        if (templateError || !templateData) {
          console.error("Template load error:", templateError);
        } else {
          const templateBytes = new Uint8Array(await templateData.arrayBuffer());
          const pdfDoc = await PDFDocument.create();
          const templateImage = await pdfDoc.embedPng(templateBytes);

          const pageWidth = 595.28;
          const pageHeight = 841.89;
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // Draw template background
          page.drawImage(templateImage, { x: 0, y: 0, width: pageWidth, height: pageHeight });

          const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
          const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

          const black = rgb(0, 0, 0);
          const gray = rgb(0.35, 0.35, 0.35);
          const brandRed = rgb(0.76, 0.07, 0.16);
          const green = rgb(0.1, 0.55, 0.1);

          const labelX = 56;
          const valueX = 195;
          const fontSize = 9;
          const lineHeight = 13;
          const maxValueWidth = pageWidth - valueX - 40;

          // Helper: wrap text
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

          const drawRow = (label: string, value: string, yPos: number, opts?: { bold?: boolean; color?: typeof black }) => {
            page.drawText(label, { x: labelX, y: yPos, size: fontSize, font: helvetica, color: gray });
            page.drawText(value, { x: valueX, y: yPos, size: fontSize, font: opts?.bold ? helveticaBold : helvetica, color: opts?.color || black });
          };

          // Cover original title area with white
          page.drawRectangle({ x: 0, y: pageHeight - 250, width: pageWidth, height: 120, color: rgb(1, 1, 1) });

          // Title
          page.drawText("WET DBA CERTIFICAAT", {
            x: labelX, y: pageHeight - 175, size: 24, font: helveticaBold, color: black,
          });
          page.drawText("COMPLIANCE VERKLARING", {
            x: labelX, y: pageHeight - 200, size: 14, font: helveticaBold, color: brandRed,
          });

          // Subtitle
          const subtitleText = `Dit certificaat verklaart dat de overeenkomst van opdracht is getoetst aan de Wet DBA en voldoet aan de gestelde eisen.`;
          const subLines = wrapText(subtitleText, helvetica, 8, pageWidth - labelX * 2);
          subLines.forEach((line, i) => {
            page.drawText(line, { x: labelX, y: pageHeight - 225 - i * 11, size: 8, font: helvetica, color: gray });
          });

          // Fields
          let y = 570;
          drawRow("Opdrachtgever:", check.client_name, y, { bold: true });
          y -= 22;
          drawRow("Certificaatnummer:", certNum, y, { bold: true, color: brandRed });
          y -= 22;

          const formatDate = (d: string) => {
            const dt = new Date(d);
            const dd = String(dt.getDate()).padStart(2, "0");
            const mm = String(dt.getMonth() + 1).padStart(2, "0");
            return `${dd}-${mm}-${dt.getFullYear()}`;
          };
          drawRow("Afgiftedatum:", formatDate(certifiedAt), y, { bold: true });

          // Score
          const score = check.suggestions?.[0]?.score;
          if (score !== undefined) {
            y -= 30;
            drawRow("Compliance score:", `${score}%`, y, { bold: true, color: score >= 80 ? green : brandRed });
          }

          // Field results summary
          if (check.field_results && check.field_results.length > 0) {
            y -= 30;
            page.drawText("Gecontroleerde velden:", { x: labelX, y, size: fontSize, font: helveticaBold, color: black });
            y -= 5;
            for (const field of check.field_results as any[]) {
              y -= lineHeight + 2;
              const icon = field.present ? "✓" : "✗";
              const color = field.present ? green : brandRed;
              page.drawText(icon, { x: valueX, y, size: 10, font: helveticaBold, color });
              page.drawText(field.field_name, { x: valueX + 14, y, size: fontSize, font: helvetica, color: black });
            }
          }

          // KVK check result
          if (check.kvk_check_result) {
            const kvk = check.kvk_check_result as any;
            y -= 25;
            page.drawText("KVK Verificatie:", { x: labelX, y, size: fontSize, font: helveticaBold, color: black });
            const kvkStatus = kvk.match ? "Werkzaamheden passen bij KVK-registratie" : "Werkzaamheden passen NIET bij KVK-registratie";
            page.drawText(kvkStatus, { x: valueX, y, size: fontSize, font: helveticaBold, color: kvk.match ? green : brandRed });
          }

          // Verification info
          y -= 35;
          page.drawText("Verificatie:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
          const verifyUrl = `https://zzpproject.lovable.app/verificatie/dba/${verificationToken}`;
          const verifyLines = wrapText(`Dit certificaat kan online geverifieerd worden via: ${verifyUrl}`, helvetica, 7.5, maxValueWidth);
          verifyLines.forEach((line, i) => {
            page.drawText(line, { x: valueX, y: y - i * 10, size: 7.5, font: helvetica, color: gray });
          });

          // Footer
          page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 60, color: rgb(1, 1, 1) });
          const footerLines = [
            "Dit Wet DBA certificaat is afgegeven door ZP Zaken B.V. op basis van een AI-gestuurde analyse van de overeenkomst.",
            "ZP Zaken is ingeschreven in het register Wft bij de AFM onder vergunningsnummer: 12050363.",
          ];
          footerLines.forEach((line, i) => {
            page.drawText(line, { x: labelX, y: 35 - i * 9, size: 6.5, font: helvetica, color: gray });
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
