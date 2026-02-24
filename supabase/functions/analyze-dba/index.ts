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
      // Analyze document for missing fields
      const systemPrompt = `Je bent een juridisch expert op het gebied van de Nederlandse Wet DBA (Wet Deregulering Beoordeling Arbeidsrelaties). 
Je analyseert overeenkomsten tussen opdrachtgevers en opdrachtnemers (zzp'ers) op compliance met de Wet DBA.

Je moet de volgende verplichte velden controleren:
${fieldNames}

Antwoord ALLEEN met een JSON tool call. Voor elk veld geef je aan:
- field_name: de naam van het veld
- present: true/false of het veld aanwezig is in de tekst
- excerpt: een kort citaat uit de tekst als het veld aanwezig is, anders null
- issue: als het veld ontbreekt of onvoldoende is, leg uit wat er mist`;

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
            { role: "user", content: `Analyseer deze overeenkomst:\n\n${check.extracted_text}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_field_analysis",
              description: "Report the analysis of each required field in the contract",
              parameters: {
                type: "object",
                properties: {
                  field_results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        field_name: { type: "string" },
                        present: { type: "boolean" },
                        excerpt: { type: "string" },
                        issue: { type: "string" },
                      },
                      required: ["field_name", "present"],
                    },
                  },
                  overall_score: { type: "number", description: "Score van 0-100 hoe compliant de overeenkomst is" },
                  summary: { type: "string", description: "Korte samenvatting van de analyse" },
                },
                required: ["field_results", "overall_score", "summary"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_field_analysis" } },
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
      const missingFields = analysis.field_results.filter((f: any) => !f.present).map((f: any) => f.field_name);

      await supabase.from("dba_checks").update({
        field_results: analysis.field_results,
        missing_fields: missingFields,
        suggestions: [{ score: analysis.overall_score, summary: analysis.summary }],
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
      // Generate DBA certificate with PDF in Onefellow ZP Approved format
      const verificationToken = crypto.randomUUID();
      const { data: seqData } = await supabase.rpc("nextval_text", { seq_name: "dba_cert_seq" });
      const certNum = "ZPDBA" + (seqData || Math.floor(Math.random() * 9000 + 1000));
      const certifiedAt = new Date().toISOString();

      // Calculate aandachtspunten from document_checklist
      const CHECKLIST_LABELS: Record<string, string> = {
        overeenkomst_eindopdrachtgever: "Overeenkomst Eindopdrachtgever",
        identiteitsverklaring: "Identiteitsverklaring",
        curriculum_vitae: "Curriculum Vitae",
        kvk_uittreksel: "Uittreksel Kamer van Koophandel",
        polis_bav: "Polis beroeps- en bedrijfsaansprakelijkheid",
        vog_verklaring: "VOG verklaring",
        vca_basis: "VCA basis",
        vca_vol: "VCA VOL",
        vil_vcu: "VIL VCU",
      };
      const docChecklist = (check.document_checklist || {}) as Record<string, boolean>;
      const aandachtspunten: string[] = [];
      const dossierItems: string[] = [];
      for (const [key, label] of Object.entries(CHECKLIST_LABELS)) {
        if (docChecklist[key]) {
          dossierItems.push(label);
        } else {
          aandachtspunten.push(label);
        }
      }
      if (!check.treedt_zelfstandig_op) aandachtspunten.push("Treedt zelfstandig naar buiten toe");
      else dossierItems.push("Treedt zelfstandig naar buiten toe");
      if (!check.eigen_materiaal_werkwijze) aandachtspunten.push("Eigen materiaal en werkwijze");
      else dossierItems.push("Eigen materiaal en werkwijze");

      // === Generate PDF ===
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
        const green = rgb(0.1, 0.55, 0.1);
        const red = rgb(0.76, 0.07, 0.16);

        const labelX = 56;
        const valueX = 210;
        const fontSize = 9;
        const lineHeight = 15;

        const formatDate = (d: string) => {
          const dt = new Date(d);
          return `${String(dt.getDate()).padStart(2, "0")}-${String(dt.getMonth() + 1).padStart(2, "0")}-${dt.getFullYear()}`;
        };

        // Header
        let y = pageHeight - 60;
        page.drawText("Onefellow B.V.", { x: labelX, y, size: 14, font: helveticaBold, color: black });
        y -= 30;

        // Title
        page.drawText("Toetsing ZP kandidaat - Wet DBA", { x: labelX, y, size: 18, font: helveticaBold, color: black });
        y -= 30;

        // Document number
        page.drawText("Documentnummer:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
        page.drawText(certNum, { x: valueX, y, size: fontSize, font: helveticaBold, color: black });
        y -= lineHeight * 1.5;

        // Candidate details
        const drawRow = (label: string, value: string) => {
          page.drawText(label, { x: labelX, y, size: fontSize, font: helvetica, color: gray });
          page.drawText(value || "-", { x: valueX, y, size: fontSize, font: helvetica, color: black });
          y -= lineHeight;
        };

        drawRow("Naam ZP kandidaat:", check.client_name);
        drawRow("Rechtsvorm:", check.rechtsvorm || "-");
        drawRow("Opdrachtgever:", check.opdrachtgever || "-");
        drawRow("Eindopdrachtgever:", check.eindopdrachtgever || "-");
        drawRow("Functie:", check.functie || "-");
        y -= 5;

        // Opdrachtomschrijving (wrapped)
        page.drawText("Opdrachtomschrijving:", { x: labelX, y, size: fontSize, font: helvetica, color: gray });
        y -= lineHeight;
        const desc = check.rewritten_description || check.project_description || "-";
        const descWords = desc.split(" ");
        let descLine = "";
        const maxW = pageWidth - labelX - 40;
        for (const w of descWords) {
          const test = descLine ? `${descLine} ${w}` : w;
          if (helvetica.widthOfTextAtSize(test, fontSize) > maxW && descLine) {
            page.drawText(descLine, { x: labelX + 10, y, size: fontSize, font: helvetica, color: black });
            y -= lineHeight;
            descLine = w;
          } else {
            descLine = test;
          }
        }
        if (descLine) {
          page.drawText(descLine, { x: labelX + 10, y, size: fontSize, font: helvetica, color: black });
          y -= lineHeight;
        }
        y -= 5;

        drawRow("Project:", check.project_name || "-");
        drawRow("Startdatum:", check.startdatum ? formatDate(check.startdatum) : "-");
        drawRow("Einddatum:", check.einddatum ? formatDate(check.einddatum) : "-");
        drawRow("Optie tot verlenging:", check.optie_verlenging || "-");
        y -= 10;

        // Dossier
        page.drawText("Dossier:", { x: labelX, y, size: fontSize, font: helveticaBold, color: black });
        y -= lineHeight;
        for (const item of dossierItems) {
          page.drawText("✓", { x: labelX + 10, y, size: 10, font: helveticaBold, color: green });
          page.drawText(item, { x: labelX + 25, y, size: fontSize, font: helvetica, color: black });
          y -= lineHeight;
        }
        y -= 10;

        // Aandachtspunten
        page.drawText("Aandachtspunten:", { x: labelX, y, size: fontSize, font: helveticaBold, color: red });
        y -= lineHeight;
        if (aandachtspunten.length === 0) {
          page.drawText("Geen aandachtspunten", { x: labelX + 10, y, size: fontSize, font: helvetica, color: green });
          y -= lineHeight;
        } else {
          for (const item of aandachtspunten) {
            page.drawText("•", { x: labelX + 10, y, size: 10, font: helveticaBold, color: red });
            page.drawText(item, { x: labelX + 25, y, size: fontSize, font: helvetica, color: black });
            y -= lineHeight;
          }
        }
        y -= 10;

        // Zelfstandigheid
        const selfIcon = check.treedt_zelfstandig_op ? "✓" : "✗";
        const selfColor = check.treedt_zelfstandig_op ? green : red;
        page.drawText(selfIcon, { x: labelX, y, size: 10, font: helveticaBold, color: selfColor });
        page.drawText("Treedt zelfstandig naar buiten", { x: labelX + 15, y, size: fontSize, font: helvetica, color: black });
        y -= lineHeight;
        const matIcon = check.eigen_materiaal_werkwijze ? "✓" : "✗";
        const matColor = check.eigen_materiaal_werkwijze ? green : red;
        page.drawText(matIcon, { x: labelX, y, size: 10, font: helveticaBold, color: matColor });
        page.drawText("Eigen materiaal en werkwijze", { x: labelX + 15, y, size: fontSize, font: helvetica, color: black });
        y -= lineHeight * 2;

        // Approval
        page.drawText("Voor akkoord", { x: labelX, y, size: fontSize, font: helveticaBold, color: black });
        y -= lineHeight;
        drawRow("Toetsingsdatum:", formatDate(certifiedAt));
        drawRow("Afgiftedatum:", formatDate(certifiedAt));
        y -= 10;

        // KVK check result
        if (check.kvk_check_result) {
          const kvk = check.kvk_check_result as any;
          page.drawText("KVK Verificatie:", { x: labelX, y, size: fontSize, font: helveticaBold, color: black });
          const kvkStatus = kvk.match ? "Werkzaamheden passen bij KVK" : "NIET passend bij KVK";
          page.drawText(kvkStatus, { x: valueX, y, size: fontSize, font: helveticaBold, color: kvk.match ? green : red });
          y -= lineHeight * 2;
        }

        // Verification
        const verifyUrl = `https://zzpproject.lovable.app/verificatie/dba/${verificationToken}`;
        page.drawText("Verificatie:", { x: labelX, y, size: 7.5, font: helvetica, color: gray });
        page.drawText(verifyUrl, { x: valueX, y, size: 7.5, font: helvetica, color: gray });
        y -= lineHeight;

        // Footer
        const footerY = 45;
        page.drawText("TOETSING ZP KANDIDAAT – WET DBA / VERSIE 2.1", { x: labelX, y: footerY, size: 6.5, font: helveticaBold, color: gray });
        page.drawText("Onefellow B.V. | Tupolevlaan 41, 1119 NW, Schiphol-Rijk", { x: labelX, y: footerY - 10, size: 6.5, font: helvetica, color: gray });
        page.drawText("KvK: 81550022 | Bank: NL08 RABO 0343814471 | BTW: NL862134754B01", { x: labelX, y: footerY - 20, size: 6.5, font: helvetica, color: gray });

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
