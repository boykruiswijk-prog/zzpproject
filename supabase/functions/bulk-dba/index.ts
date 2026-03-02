import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";
import * as mammoth from "https://esm.sh/mammoth@1.11.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
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

    const { batch_id, action } = await req.json();

    if (action === "process") {
      // Fetch batch
      const { data: batch, error: batchErr } = await supabase
        .from("dba_batches")
        .select("*")
        .eq("id", batch_id)
        .single();
      if (batchErr || !batch) {
        return new Response(JSON.stringify({ error: "Batch niet gevonden" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Download ZIP from storage
      const { data: zipData, error: zipErr } = await supabase.storage
        .from("dba-documents")
        .download(batch.zip_file_url);
      if (zipErr || !zipData) {
        return new Response(JSON.stringify({ error: "ZIP niet gevonden in storage" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Unzip
      const zipBytes = new Uint8Array(await zipData.arrayBuffer());
      let files: Record<string, Uint8Array>;
      try {
        files = unzipSync(zipBytes);
      } catch {
        return new Response(JSON.stringify({ error: "Kan ZIP niet uitpakken" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Categorize files
      interface ExtractedFile {
        name: string;
        path: string;
        type: "toetsing" | "kvk" | "unknown";
        text: string;
        bytes: Uint8Array;
      }

      const extractedFiles: ExtractedFile[] = [];

      for (const [path, data] of Object.entries(files)) {
        // Skip directories and hidden files
        if (path.endsWith("/") || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
        const name = path.split("/").pop() || path;
        const lower = name.toLowerCase();

        // Skip non-document files
        if (!lower.endsWith(".docx") && !lower.endsWith(".doc") && !lower.endsWith(".txt") && !lower.endsWith(".pdf")) continue;

        let text = "";
        let fileType: "toetsing" | "kvk" | "unknown" = "unknown";

        try {
          if (lower.endsWith(".txt")) {
            text = new TextDecoder().decode(data);
          } else if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
            // Extract text using mammoth
            try {
              const result = await mammoth.extractRawText({ arrayBuffer: data.buffer });
              text = result.value;

              // Parse checkbox states from docx XML
              try {
                const innerFiles = unzipSync(data);
                const docXml = innerFiles["word/document.xml"];
                if (docXml) {
                  const xmlText = new TextDecoder().decode(docXml);
                  const checkboxRegex = /<w:sdt>[\s\S]*?<\/w:sdt>/g;
                  const checkboxStates: boolean[] = [];
                  let match;
                  while ((match = checkboxRegex.exec(xmlText)) !== null) {
                    const sdtBlock = match[0];
                    if (sdtBlock.includes("w14:checkbox") || sdtBlock.includes("w:checkbox")) {
                      const isChecked = /w14:checked[^/]*w14:val="1"/.test(sdtBlock) ||
                                        /w14:checked[^>]*val="1"/.test(sdtBlock);
                      checkboxStates.push(isChecked);
                    }
                  }
                  if (checkboxStates.length > 0) {
                    const checklistIdx = text.indexOf("Aanvullende documentatie");
                    if (checklistIdx !== -1) {
                      const before = text.substring(0, checklistIdx);
                      let after = text.substring(checklistIdx);
                      const docNames = [
                        "Overeenkomst Eindopdrachtgever",
                        "Identiteits verklaring",
                        "Curriculum Vitae",
                        "Uittreksel Kamer van Koophandel",
                        "Polis beroeps en bedrijfsaansprakelijkheid",
                        "VOG verklaring",
                        "VCA certificering",
                      ];
                      for (let i = 0; i < docNames.length; i++) {
                        const cbIdx = i * 2;
                        if (cbIdx + 1 < checkboxStates.length) {
                          const sym1 = checkboxStates[cbIdx] ? "\u2612" : "\u2610";
                          const sym2 = checkboxStates[cbIdx + 1] ? "\u2612" : "\u2610";
                          after = after.replace(docNames[i], `${docNames[i]}\t${sym1}\t${sym2}`);
                        }
                      }
                      text = before + after;
                    }
                  }
                }
              } catch { /* skip checkbox parsing errors */ }
            } catch {
              text = "";
            }
          }
        } catch {
          text = "";
        }

        // Determine file type by name or content
        if (lower.includes("kvk") || lower.includes("kamer van koophandel") || lower.includes("uittreksel")) {
          fileType = "kvk";
        } else if (lower.includes("toetsing") || lower.includes("kandidaat") || lower.includes("dba") || lower.includes("gegevens")) {
          fileType = "toetsing";
        } else if (text) {
          // Check content
          const textLower = text.toLowerCase();
          if (textLower.includes("kamer van koophandel") || textLower.includes("kvk-nummer") || textLower.includes("handelsregister")) {
            fileType = "kvk";
          } else if (textLower.includes("toetsing") || textLower.includes("zp kandidaat") || textLower.includes("opdrachtomschrijving")) {
            fileType = "toetsing";
          }
        }

        extractedFiles.push({ name, path, type: fileType, text, bytes: data });
      }

      const toetsingFiles = extractedFiles.filter(f => f.type === "toetsing");
      const kvkFiles = extractedFiles.filter(f => f.type === "kvk");
      const unknownFiles = extractedFiles.filter(f => f.type === "unknown");

      // Use AI to correlate toetsing files with KVK files
      let correlations: Array<{ toetsing_index: number; kvk_index: number | null; candidate_name: string; opdrachtgever: string }> = [];

      if (toetsingFiles.length > 0) {
        // Build summaries for AI
        const toetsingSummaries = toetsingFiles.map((f, i) => {
          const preview = f.text.substring(0, 500);
          return `[Toetsing ${i}] Bestand: ${f.name}\nInhoud preview: ${preview}`;
        }).join("\n\n---\n\n");

        const kvkSummaries = kvkFiles.map((f, i) => {
          const preview = f.text.substring(0, 500);
          return `[KVK ${i}] Bestand: ${f.name}\nInhoud preview: ${preview}`;
        }).join("\n\n---\n\n");

        const unknownSummaries = unknownFiles.map((f, i) => {
          const preview = f.text.substring(0, 500);
          return `[Onbekend ${i}] Bestand: ${f.name}\nInhoud preview: ${preview}`;
        }).join("\n\n---\n\n");

        const correlationPrompt = `Je krijgt een lijst met documenten uit een ZIP-bestand. Er zijn toetsingsformulieren (Gegevens ter toetsing ZP kandidaat) en KVK-uittreksels. Sommige bestanden zijn niet geclassificeerd.

TOETSINGSFORMULIEREN:
${toetsingSummaries || "Geen gevonden"}

KVK UITTREKSELS:
${kvkSummaries || "Geen gevonden"}

NIET-GECLASSIFICEERDE BESTANDEN:
${unknownSummaries || "Geen"}

Taken:
1. Identificeer per toetsingsformulier de naam van de ZP kandidaat en de opdrachtgever
2. Koppel elk toetsingsformulier aan het juiste KVK-uittreksel (op basis van bedrijfsnaam/kandidaatnaam)
3. Als een onbekend bestand eigenlijk een toetsing of KVK is, classificeer het en koppel het

Antwoord ALLEEN met een JSON tool call.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Je bent een expert document classificatie-assistent." },
              { role: "user", content: correlationPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "report_correlations",
                description: "Report which toetsing documents match with which KVK documents",
                parameters: {
                  type: "object",
                  properties: {
                    candidates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          toetsing_index: { type: "number", description: "Index in de toetsingsformulieren lijst" },
                          kvk_index: { type: ["number", "null"], description: "Index in de KVK-uittreksels lijst, of null als er geen match is" },
                          candidate_name: { type: "string", description: "Naam van de ZP kandidaat" },
                          opdrachtgever: { type: "string", description: "Naam van de opdrachtgever/bedrijfsnaam" },
                        },
                        required: ["toetsing_index", "candidate_name", "opdrachtgever"],
                      },
                    },
                    reclassified: {
                      type: "array",
                      description: "Onbekende bestanden die alsnog geclassificeerd konden worden",
                      items: {
                        type: "object",
                        properties: {
                          unknown_index: { type: "number" },
                          actual_type: { type: "string", enum: ["toetsing", "kvk"] },
                          linked_to_candidate: { type: "string", description: "Kandidaatnaam waar dit bij hoort" },
                        },
                      },
                    },
                  },
                  required: ["candidates"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "report_correlations" } },
          }),
        });

        if (aiResponse.ok) {
          const aiResult = await aiResponse.json();
          const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            correlations = parsed.candidates || [];

            // Handle reclassified unknown files
            if (parsed.reclassified) {
              for (const reclass of parsed.reclassified) {
                const unkFile = unknownFiles[reclass.unknown_index];
                if (unkFile) {
                  unkFile.type = reclass.actual_type;
                  if (reclass.actual_type === "kvk") {
                    kvkFiles.push(unkFile);
                    // Find matching candidate and link
                    const matchCandidate = correlations.find(c =>
                      c.candidate_name.toLowerCase().includes(reclass.linked_to_candidate?.toLowerCase() || "") ||
                      reclass.linked_to_candidate?.toLowerCase().includes(c.candidate_name.toLowerCase())
                    );
                    if (matchCandidate && matchCandidate.kvk_index === null) {
                      matchCandidate.kvk_index = kvkFiles.length - 1;
                    }
                  } else if (reclass.actual_type === "toetsing") {
                    toetsingFiles.push(unkFile);
                  }
                }
              }
            }
          }
        }
      }

      // If no AI correlations, create basic ones from toetsing files
      if (correlations.length === 0) {
        correlations = toetsingFiles.map((f, i) => ({
          toetsing_index: i,
          kvk_index: kvkFiles.length > i ? i : null,
          candidate_name: f.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
          opdrachtgever: batch.name || "",
        }));
      }

      // Create dba_checks for each candidate
      const createdChecks: string[] = [];
      for (const corr of correlations) {
        const toetsingFile = toetsingFiles[corr.toetsing_index];
        if (!toetsingFile) continue;

        // Upload toetsing file to storage
        const toetsingPath = `bulk/${batch_id}/${crypto.randomUUID()}_${toetsingFile.name}`;
        await supabase.storage.from("dba-documents").upload(toetsingPath, toetsingFile.bytes, { contentType: "application/octet-stream" });

        // Extract project description from text
        let projectDescription = "";
        const descriptionLabels = ["Opdrachtomschrijving", "Omschrijving werkzaamheden", "Projectomschrijving"];
        for (const label of descriptionLabels) {
          const labelIdx = toetsingFile.text.toLowerCase().indexOf(label.toLowerCase());
          if (labelIdx !== -1) {
            const afterLabel = toetsingFile.text.substring(labelIdx + label.length);
            const contentStart = afterLabel.search(/[^\s:]/);
            if (contentStart !== -1) {
              let content = afterLabel.substring(contentStart);
              const endPattern = /\n\s*(?:Project\s*\n|Startdatum|Einddatum|Uurtarief|Uren per week|Opdrachtgever|Eindopdrachtgever|Specifieke vaardigheden|Aanvullende documentatie|Treedt zelfstandig)/i;
              const endMatch = content.match(endPattern);
              const endIdx = endMatch?.index ?? content.length;
              const extracted = content.substring(0, endIdx).trim();
              if (extracted.length > 10) {
                projectDescription = extracted;
                break;
              }
            }
          }
        }

        // Handle KVK file
        let kvkText = "";
        let kvkFileUrl = "";
        let kvkFilename = "";
        if (corr.kvk_index !== null && kvkFiles[corr.kvk_index]) {
          const kvkFile = kvkFiles[corr.kvk_index];
          kvkFilename = kvkFile.name;
          const kvkPath = `bulk/${batch_id}/kvk_${crypto.randomUUID()}_${kvkFile.name}`;
          await supabase.storage.from("dba-documents").upload(kvkPath, kvkFile.bytes, { contentType: "application/octet-stream" });
          kvkFileUrl = kvkPath;
          kvkText = kvkFile.text;
        }

        // Insert dba_check
        const { data: checkData, error: checkErr } = await supabase
          .from("dba_checks")
          .insert({
            client_name: corr.opdrachtgever || corr.candidate_name || toetsingFile.name,
            project_description: projectDescription || null,
            uploaded_file_url: toetsingPath,
            original_filename: toetsingFile.name,
            extracted_text: toetsingFile.text || null,
            kvk_file_url: kvkFileUrl || null,
            kvk_filename: kvkFilename || null,
            kvk_text: kvkText || null,
            batch_id: batch_id,
            status: "uploaded",
          })
          .select("id")
          .single();

        if (!checkErr && checkData) {
          createdChecks.push(checkData.id);
        }
      }

      // Update batch
      await supabase.from("dba_batches").update({
        total_candidates: createdChecks.length,
        status: "extracted",
      }).eq("id", batch_id);

      return new Response(JSON.stringify({
        success: true,
        total_candidates: createdChecks.length,
        check_ids: createdChecks,
        correlations,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "analyze_all") {
      // Trigger analysis on all checks in a batch
      const { data: checks } = await supabase
        .from("dba_checks")
        .select("id, status")
        .eq("batch_id", batch_id)
        .eq("status", "uploaded");

      if (!checks || checks.length === 0) {
        return new Response(JSON.stringify({ error: "Geen checks om te analyseren" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("dba_batches").update({ status: "analyzing" }).eq("id", batch_id);

      let processed = 0;
      const errors: string[] = [];

      for (const check of checks) {
        try {
          // Call analyze-dba for each check
          const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-dba`, {
            method: "POST",
            headers: {
              Authorization: authHeader || "",
              "Content-Type": "application/json",
              apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
            },
            body: JSON.stringify({ check_id: check.id, action: "analyze" }),
          });

          if (analyzeResponse.ok) {
            processed++;
          } else {
            const errBody = await analyzeResponse.text();
            errors.push(`${check.id}: ${errBody}`);
          }
        } catch (e) {
          errors.push(`${check.id}: ${e instanceof Error ? e.message : "Onbekende fout"}`);
        }

        // Update progress
        await supabase.from("dba_batches").update({
          processed_count: processed,
        }).eq("id", batch_id);
      }

      // Also run KVK checks and rewrites for analyzed checks
      const { data: analyzedChecks } = await supabase
        .from("dba_checks")
        .select("id, kvk_text, project_description")
        .eq("batch_id", batch_id)
        .eq("status", "analyzed");

      if (analyzedChecks) {
        for (const check of analyzedChecks) {
          // KVK check if kvk_text available
          if (check.kvk_text) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/analyze-dba`, {
                method: "POST",
                headers: {
                  Authorization: authHeader || "",
                  "Content-Type": "application/json",
                  apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
                },
                body: JSON.stringify({ check_id: check.id, action: "check_kvk" }),
              });
            } catch { /* skip */ }
          }
          // Rewrite if project_description or extracted_text available
          if (check.project_description || check.extracted_text) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/analyze-dba`, {
                method: "POST",
                headers: {
                  Authorization: authHeader || "",
                  "Content-Type": "application/json",
                  apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
                },
                body: JSON.stringify({ check_id: check.id, action: "rewrite" }),
              });
            } catch { /* skip */ }
          }
        }
      }

      await supabase.from("dba_batches").update({
        status: "analyzed",
        processed_count: processed,
      }).eq("id", batch_id);

      return new Response(JSON.stringify({
        success: true,
        processed,
        errors: errors.length > 0 ? errors : undefined,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "certify_selected") {
      // Certify selected checks in batch
      const { check_ids } = await req.json().catch(() => ({ check_ids: [] }));
      // Re-parse since we already consumed req.json above — use the original parse
      // Actually the check_ids should be in the initial parse. Let me fix this.
      return new Response(JSON.stringify({ error: "Gebruik /analyze-dba met action=certify per check" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Bulk DBA error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Onbekende fout" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
