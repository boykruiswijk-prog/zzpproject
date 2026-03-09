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
${fieldNames || `- Naam ZP kandidaat
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
- Zelfstandigheid - eigen materiaal, werkwijze enz. (ja/nee)`}

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
6. Het veld "Tarief en facturatie" of "Uurtarief": als er een uurtarief of projectprijs is vermeld, is dit veld VOLLEDIG VOLDAAN. Facturatievoorwaarden, betaalafspraken of betalingstermijnen zijn NIET vereist. Meld NOOIT dat facturatievoorwaarden ontbreken als er een tarief staat.

Controleer het ingevulde formulier en rapporteer voor elk veld of het is ingevuld.
Alleen als een veld ECHT leeg is of ontbreekt in het document: markeer dit als aandachtspunt.

KRITIEKE INSTRUCTIE VOOR AANDACHTSPUNTEN:
- Aandachtspunten mogen UITSLUITEND gaan over velden uit de bovenstaande lijsten (VERPLICHTE VELDEN en DOCUMENTATIE CHECKLIST) die daadwerkelijk LEEG of NIET INGEVULD zijn in het document.
- Verzin GEEN aandachtspunten over zaken die niet in de veldlijst staan (zoals adresgegevens, bedrijfsgegevens, rechtsvorm van partijen, specifieke contractbepalingen, facturatievoorwaarden, etc.).
- Verzin ABSOLUUT GEEN aandachtspunten over aansprakelijkheid, intellectueel eigendom, geheimhouding, vervanging, of andere contractuele bepalingen. Dit zijn GEEN onderdeel van de DBA-toetsing.
- Als een veld IS ingevuld, mag het NIET als aandachtspunt worden vermeld, ook al lijkt de inhoud kort of onvolledig.
- Baseer je ALLEEN op feitelijke data uit het document. Voeg geen interpretaties, suggesties of aannames toe.
- De enige aandachtspunten die zijn toegestaan zijn: "Veld X is niet ingevuld" of "Document Y is niet aanwezig/aangevinkt". NIETS ANDERS.

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
      const txt = check.extracted_text || "";

      // Filter aandachtspunten: only keep items that reference known fields/documents
      // and are about MISSING/EMPTY fields, not about content quality or contract clauses
      const allowedKeywords = [
        "naam", "kandidaat", "opdrachtgever", "eindopdrachtgever", "functie",
        "opdrachtomschrijving", "project", "startdatum", "einddatum", "verlenging",
        "uurtarief", "tarief", "uur per week", "vaardigheden", "kennis", "opleiding",
        "zelfstandig", "eigen materiaal", "werkwijze",
        "overeenkomst eindopdrachtgever", "identiteit", "curriculum", "cv", "kamer van koophandel", "kvk",
        "polis", "vog", "vca",
      ];
      // Block hallucinated topics about contract clauses, legal content, etc.
      const blockedKeywords = [
        "aansprakelijkheid", "intellectueel eigendom", "geheimhouding", "vervanging",
        "contractbepaling", "regeling", "clausule", "ontbreekt in de tekst",
        "expliciet", "bepaling", "verzekering" /* but not "polis" which is allowed */,
        "facturatie", "betalingsvoorwaarden", "betaalafspraken", "betalingstermijn",
      ];
      const rawAandachtspunten: string[] = analysis.aandachtspunten || [];
      const missingFields = rawAandachtspunten.filter((item: string) => {
        const lower = item.toLowerCase();
        // Block hallucinated contract/legal clause observations
        if (blockedKeywords.some(k => lower.includes(k))) {
          // Exception: allow "polis" related items about missing documents
          if (lower.includes("polis") && (lower.includes("niet aangeleverd") || lower.includes("niet aanwezig") || lower.includes("ouder dan"))) {
            return true;
          }
          return false;
        }
        return allowedKeywords.some(k => lower.includes(k));
      });
      if (missingFields.length < rawAandachtspunten.length) {
        console.log(`Filtered ${rawAandachtspunten.length - missingFields.length} hallucinated aandachtspunten`);
      }

      // Fix KVK-nummer: mark as filled if KVK file uploaded OR if KVK number exists in form text
      const hasKvkUploaded = !!(check.kvk_file_url || check.kvk_text);
      const kvkInText = !!(txt.match(/\b\d{8}\b/) || txt.toLowerCase().match(/kvk[\s\-]*(nummer|nr)/));
      const shouldFixKvk = hasKvkUploaded || kvkInText;
      
      if (shouldFixKvk) {
        if (analysis.form_fields) {
          for (const field of analysis.form_fields) {
            const name = field.field_name?.toLowerCase() || "";
            if (name.includes("kvk") && !field.filled) {
              field.filled = true;
              field.value = hasKvkUploaded ? "Zie apart geüpload KVK-uittreksel" : (field.value || "Aanwezig in formulier");
              field.issue = undefined;
            }
          }
        }
        if (analysis.checklist_items) {
          for (const item of analysis.checklist_items) {
            if (item.document_name?.toLowerCase().includes("kamer van koophandel") || item.document_name?.toLowerCase().includes("kvk")) {
              if (hasKvkUploaded) {
                item.status = "aanwezig";
                item.issue = undefined;
              }
            }
          }
        }
        const kvkFiltered = missingFields.filter((f: string) => !f.toLowerCase().includes("kvk") && !f.toLowerCase().includes("kamer van koophandel"));
        missingFields.length = 0;
        missingFields.push(...kvkFiltered);
      }

      // If polis is uploaded separately, mark polis checklist item as aanwezig
      const hasPolisFile = !!(check.polis_file_url || check.polis_text);
      if (hasPolisFile && analysis.checklist_items) {
        for (const item of analysis.checklist_items) {
          if (item.document_name?.toLowerCase().includes("polis") || item.document_name?.toLowerCase().includes("aansprakelijkheid")) {
            item.status = "aanwezig";
            item.issue = undefined;
          }
        }
      }

      // Check insurance policy status from checklist
      const insuranceChecklist = analysis.checklist_items?.find(
        (item: any) => item.document_name?.toLowerCase().includes("polis") || item.document_name?.toLowerCase().includes("aansprakelijkheid")
      );
      const insuranceMissing = insuranceChecklist?.status === "niet_aanwezig" || insuranceChecklist?.status === "niet_ingevuld";

      // Check insurance policy age (older than 1 year = aandachtspunt)
      let insurancePolicyExpired: boolean | null = null;
      const hasPolisUploaded = !!check.polis_text;
      
      if (insuranceMissing && !hasPolisUploaded) {
        // Policy not provided at all and no separate polis uploaded
        insurancePolicyExpired = null;
        if (!missingFields.some((f: string) => f.toLowerCase().includes("polis") && f.toLowerCase().includes("niet aangeleverd"))) {
          missingFields.push("Polis beroeps- en bedrijfsaansprakelijkheid is niet aangeleverd");
        }
      } else if (analysis.insurance_policy_date && analysis.insurance_policy_date !== "null" && analysis.insurance_policy_date !== "undefined") {
        const policyDate = new Date(analysis.insurance_policy_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        insurancePolicyExpired = policyDate < oneYearAgo;
        if (insurancePolicyExpired) {
          missingFields.push(`Polis beroeps-/bedrijfsaansprakelijkheid is ouder dan 1 jaar (datum: ${analysis.insurance_policy_date})`);
        }
      } else if (!hasPolisUploaded) {
        // No date found in form and no separate polis uploaded
        if (!missingFields.some((f: string) => f.toLowerCase().includes("polisdatum") || (f.toLowerCase().includes("polis") && f.toLowerCase().includes("datum")))) {
          missingFields.push("Datum polis beroeps- en bedrijfsaansprakelijkheid kon niet worden vastgesteld - upload de polis apart");
        }
      }
      // If polis is uploaded separately, the check_polis action will handle date extraction

      // Extract structured field values directly from the extracted text (more reliable than AI field names)
      const extractFromText = (label: string, text: string): string | null => {
        // Match "Label [optional extra words]\n\nValue" or "Label: Value" patterns
        // The label may have additional text on the same line (e.g. "Uurtarief ZZP'er")
        const patterns = [
          new RegExp(`${label}[^\\n]*\\n\\s*\\n\\s*([^\\n]+)`, "i"),  // label...blank line...value
          new RegExp(`${label}[^\\n]*\\n\\s*([^\\n]+)`, "i"),          // label...value on next line
          new RegExp(`${label}\\s*:\\s*([^\\n]+)`, "i"),               // label: value
        ];
        for (const pat of patterns) {
          const match = text.match(pat);
          if (match && match[1]?.trim() && match[1].trim().length > 0) {
            // Skip if captured value looks like another label
            const val = match[1].trim();
            if (val.length > 0 && val !== "-") return val;
          }
        }
        return null;
      };

      // Also check AI field results as fallback
      const getAnalyzedValue = (name: string): string | null => {
        const field = (analysis.form_fields || []).find((f: any) => f.field_name?.toLowerCase().includes(name.toLowerCase()));
        const val = field?.value || field?.excerpt || "";
        return val && val !== "null" ? val.trim() : null;
      };

      const extractedColumns: Record<string, any> = {};

      // Parse DD-MM-YYYY dates common in Dutch documents
      const parseDutchDate = (val: string): string | null => {
        const m = val.match(/(\d{2})-(\d{2})-(\d{4})/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`; // YYYY-MM-DD
        const parsed = new Date(val);
        return !isNaN(parsed.getTime()) ? parsed.toISOString().split("T")[0] : null;
      };

      // Extract from text first, then AI results as fallback
      if (!check.opdrachtgever) {
        const val = extractFromText("Opdrachtgever", txt) || getAnalyzedValue("opdrachtgever");
        if (val && !val.toLowerCase().includes("eindopdrachtgever")) extractedColumns.opdrachtgever = val;
      }
      if (!check.eindopdrachtgever) {
        const val = extractFromText("Eindopdrachtgever", txt) || getAnalyzedValue("eindopdrachtgever");
        if (val) extractedColumns.eindopdrachtgever = val;
      }
      if (!check.functie) {
        const val = extractFromText("Functie", txt) || getAnalyzedValue("functie");
        if (val) extractedColumns.functie = val;
      }
      if (!check.project_name) {
        let val = extractFromText("Project", txt) || getAnalyzedValue("project");
        if (val) {
          // Stop-markers: truncate if we accidentally grabbed text from the next section
          const stopMarkers = [
            "de navolgende", "resultaatgebieden", "maken onderdeel",
            "onderdeel uit van", "werkzaamheden", "taken en verantwoordelijkheden",
            "beschrijving van de opdracht", "opdrachtomschrijving",
          ];
          const lowerVal = val.toLowerCase();
          for (const marker of stopMarkers) {
            if (lowerVal.includes(marker)) {
              val = null;
              break;
            }
          }
          if (val) extractedColumns.project_name = val;
        }
        // Fallback: try to find project name in rewritten_description or opdrachtomschrijving field
        if (!extractedColumns.project_name) {
          const descText = check.rewritten_description || check.project_description || txt || "";
          const projectMatch = descText.match(/[Pp]roject[:\s]+([A-Z][A-Za-z0-9\-\s]{2,40})(?:\n|\.|\s{2,}|$)/);
          if (projectMatch) {
            extractedColumns.project_name = projectMatch[1].trim();
          }
        }
      }
      if (!check.startdatum) {
        const val = extractFromText("Startdatum", txt);
        if (val) {
          const d = parseDutchDate(val);
          if (d) extractedColumns.startdatum = d;
        }
      }
      if (!check.einddatum) {
        const val = extractFromText("Einddatum", txt);
        if (val) {
          const d = parseDutchDate(val);
          if (d) extractedColumns.einddatum = d;
        }
      }
      if (!check.optie_verlenging) {
        const val = extractFromText("Optie tot verlenging", txt) || getAnalyzedValue("verlenging");
        if (val) extractedColumns.optie_verlenging = val;
      }
      if (!check.uurtarief) {
        const val = extractFromText("Uurtarief", txt) || getAnalyzedValue("uurtarief");
        if (val) extractedColumns.uurtarief = val;
      }
      if (!check.uren_per_week) {
        const val = extractFromText("Aantal uur per week", txt) || getAnalyzedValue("uur per week");
        if (val) extractedColumns.uren_per_week = val;
      }
      if (!check.specifieke_vaardigheden) {
        const val = extractFromText("Specifieke vaardigheden", txt) || getAnalyzedValue("specifieke vaardigheden");
        if (val) extractedColumns.specifieke_vaardigheden = val;
      }

      // Extract boolean fields: treedt_zelfstandig_op and eigen_materiaal_werkwijze
      // Check extracted text for "Ja" answers, then AI field results as fallback
      const parseBooleanField = (labels: string[]): boolean | null => {
        for (const label of labels) {
          // Look for "Label\n\nJa" or "Label: Ja" or checkbox patterns "☒ Ja"
          const patterns = [
            new RegExp(`${label}[^\\n]*\\n\\s*\\n\\s*(ja|nee)`, "i"),
            new RegExp(`${label}[^\\n]*\\n\\s*(ja|nee)`, "i"),
            new RegExp(`${label}[^\\n]*:\\s*(ja|nee)`, "i"),
            new RegExp(`${label}[^\\n]*☒\\s*ja`, "i"),
            new RegExp(`${label}[^\\n]*ja\\s*☒`, "i"),
          ];
          for (const pat of patterns) {
            const match = txt.match(pat);
            if (match) {
              const val = match[1] || "ja"; // If matched a checkbox pattern, it's ja
              return val.toLowerCase() === "ja";
            }
          }
        }
        // Fallback: check AI results
        for (const label of labels) {
          const aiField = (analysis.form_fields || []).find((f: any) => 
            f.field_name?.toLowerCase().includes(label.toLowerCase())
          );
          if (aiField?.value) {
            return aiField.value.toLowerCase().includes("ja");
          }
        }
        return null;
      };

      const zelfstandigVal = parseBooleanField(["zelfstandig naar buiten", "treedt zelfstandig"]);
      if (zelfstandigVal !== null) {
        extractedColumns.treedt_zelfstandig_op = zelfstandigVal;
      }
      
      const eigenMateriaalVal = parseBooleanField(["eigen materiaal", "zelfstandigheid"]);
      if (eigenMateriaalVal !== null) {
        extractedColumns.eigen_materiaal_werkwijze = eigenMateriaalVal;
      }

      console.log("Extracted columns from text:", JSON.stringify(extractedColumns));

      // Deterministic score: count unfilled fields + missing checklist items + extra penalties
      // Only count fields from our known required field list — ignore AI-hallucinated extras
      const knownFieldNames = [
        "naam", "kandidaat", "opdrachtgever", "eindopdrachtgever", "functie",
        "opdrachtomschrijving", "project", "startdatum", "einddatum", "verlenging",
        "uurtarief", "tarief", "uur per week", "vaardigheden", "kennis", "opleiding",
        "zelfstandig", "eigen materiaal", "werkwijze",
      ];
      const knownChecklistNames = [
        "overeenkomst", "identiteit", "curriculum", "cv", "kamer van koophandel", "kvk",
        "polis", "aansprakelijkheid", "vog", "vca",
      ];
      const isKnownField = (name: string) => knownFieldNames.some(k => name.toLowerCase().includes(k));
      const isKnownChecklist = (name: string) => knownChecklistNames.some(k => name.toLowerCase().includes(k));

      const unfilledFieldCount = (analysis.form_fields || []).filter((f: any) => {
        const name = (f.field_name || "").toLowerCase();
        if (name.includes("rechtsvorm")) return false;
        if (name.includes("specifieke vaardigheden")) return false;
        if (!isKnownField(f.field_name || "")) return false;
        return !f.filled;
      }).length;

      // Use pre-parsed document_checklist from upload if available (deterministic)
      // Fall back to AI-parsed checklist_items only when no pre-parsed data exists
      const preChecklist = check.document_checklist as Record<string, string> | null;
      let missingChecklistCount = 0;
      let finalChecklistItems = analysis.checklist_items || [];
      
      if (preChecklist && typeof preChecklist === "object" && Object.keys(preChecklist).length > 0) {
        // Use deterministic client-parsed checklist
        console.log("Using pre-parsed checklist from upload:", JSON.stringify(preChecklist));
        finalChecklistItems = Object.entries(preChecklist).map(([name, status]) => ({
          document_name: name,
          status: status,
        }));
        missingChecklistCount = Object.values(preChecklist).filter(
          (s: string) => s === "niet_aanwezig" || s === "niet_ingevuld"
        ).length;
        
        // Override KVK if uploaded separately
        if (shouldFixKvk) {
          const kvkKey = Object.keys(preChecklist).find(k => k.toLowerCase().includes("kamer van koophandel") || k.toLowerCase().includes("kvk"));
          if (kvkKey && preChecklist[kvkKey] !== "aanwezig") {
            missingChecklistCount = Math.max(0, missingChecklistCount - 1);
            finalChecklistItems = finalChecklistItems.map((item: any) => 
              (item.document_name?.toLowerCase().includes("kamer van koophandel") || item.document_name?.toLowerCase().includes("kvk"))
                ? { ...item, status: "aanwezig" }
                : item
            );
          }
        }
        // Override polis if uploaded separately
        if (hasPolisFile) {
          const polisKey = Object.keys(preChecklist).find(k => k.toLowerCase().includes("polis") || k.toLowerCase().includes("aansprakelijkheid"));
          if (polisKey && preChecklist[polisKey] !== "aanwezig") {
            missingChecklistCount = Math.max(0, missingChecklistCount - 1);
            finalChecklistItems = finalChecklistItems.map((item: any) =>
              (item.document_name?.toLowerCase().includes("polis") || item.document_name?.toLowerCase().includes("aansprakelijkheid"))
                ? { ...item, status: "aanwezig" }
                : item
            );
          }
        }
      } else {
        // Fallback: use AI-parsed checklist (less reliable)
        console.log("No pre-parsed checklist, using AI checklist");
        missingChecklistCount = (analysis.checklist_items || []).filter((item: any) => {
          if (!isKnownChecklist(item.document_name || "")) return false;
          return item.status === "niet_aanwezig" || item.status === "niet_ingevuld";
        }).length;
      }

      // Extra penalties: expired polis, expired KVK, missing BAV coverage
      let extraPenalties = 0;
      if (insurancePolicyExpired) extraPenalties++;
      const hasBavMissing = missingFields.some((f: string) => f.toLowerCase().includes("bav") && f.toLowerCase().includes("ontbreekt"));
      if (hasBavMissing) extraPenalties++;
      
      // Check KVK expiry if kvk_check_result already available from a previous check_kvk run
      const kvkCheckResult = check.kvk_check_result as any;
      if (kvkCheckResult?.kvk_extract_expired === true) {
        extraPenalties++;
        if (!missingFields.some((f: string) => f.toLowerCase().includes("kvk") && f.toLowerCase().includes("verouderd"))) {
          missingFields.push(`KVK-uittreksel is ouder dan 3 maanden (datum: ${kvkCheckResult.kvk_extract_date})`);
        }
      }

      const totalIssues = unfilledFieldCount + missingChecklistCount + extraPenalties;
      const deterministicScore = Math.max(0, 100 - totalIssues * 10);
      
      console.log(`Score calculation: ${unfilledFieldCount} unfilled fields + ${missingChecklistCount} missing checklist + ${extraPenalties} extra = ${totalIssues} issues → score ${deterministicScore}`);

      // Filter field_results: only keep known fields, remove hallucinated ones like "Geheimhouding"
      const blockedFieldNames = [
        "geheimhouding", "aansprakelijkheid", "intellectueel eigendom", "vervanging",
        "boeteclausule", "concurrentiebeding", "relatiebeding", "geschillen",
        "toepasselijk recht", "opzegtermijn", "beëindiging", "overmacht",
        "gezagsverhouding", "geen gezagsverhouding",
      ];
      const filteredFieldResults = (analysis.form_fields || []).filter((f: any) => {
        const name = (f.field_name || "").toLowerCase();
        return !blockedFieldNames.some(b => name.includes(b));
      });

      await supabase.from("dba_checks").update({
        field_results: filteredFieldResults,
        missing_fields: missingFields,
        document_checklist: finalChecklistItems,
        suggestions: [{
          score: deterministicScore,
          aandachtspunten: missingFields,
          insurance_policy_date: (analysis.insurance_policy_date && analysis.insurance_policy_date !== "null" && analysis.insurance_policy_date !== "undefined") ? analysis.insurance_policy_date : null,
          insurance_policy_expired: insurancePolicyExpired,
          insurance_missing: insuranceMissing || false,
        }],
        status: "analyzed",
        // Reset certificate fields so a new certificate can be generated
        certificate_number: null,
        certificate_pdf_url: null,
        verification_token: null,
        certified_at: null,
        certified_by: null,
        ...extractedColumns,
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
          temperature: 0,
          seed: 42,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Herschrijf deze projectomschrijving:\n\n${check.project_description || check.extracted_text}` },
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
      const todayStr = new Date().toISOString().split("T")[0];
      const systemPrompt = `Je bent een expert op het gebied van KVK-registraties en de Wet DBA in Nederland.
De huidige datum is ${todayStr}.

Je hebt TWEE taken:
1. Vergelijk de KVK bedrijfsomschrijving/activiteiten met de feitelijke werkzaamheden uit de overeenkomst.
   Beoordeel of de werkzaamheden passen binnen de KVK-omschrijving.
2. Zoek de datum van het KVK-uittreksel in de tekst (vaak staat er "Datum uittreksel", "Uittreksel d.d.", "Datum" of een vergelijkbare aanduiding).
   Als je een datum vindt, geef deze terug in het formaat YYYY-MM-DD.

BELANGRIJK over de ouderdom van het uittreksel:
- Vergelijk de gevonden datum ALTIJD met de huidige datum (${todayStr}).
- Een KVK-uittreksel dat ouder is dan 3 maanden ten opzichte van vandaag is een aandachtspunt.
- Vermeld in je uitleg of het uittreksel recent of verouderd is, gebaseerd op de werkelijke datum en vandaag.
- Zeg NOOIT dat een uittreksel "recent" is als het ouder is dan 3 maanden.

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

      // Update KVK check result and recalculate score if KVK is expired
      const currentSuggestionsKvk = check.suggestions as any[] || [];
      const kvkSuggestion = currentSuggestionsKvk[0] || {};
      let kvkMissingFields = ((check.missing_fields as string[]) || []).filter(
        (f: string) => !(f.toLowerCase().includes("kvk") && f.toLowerCase().includes("verouderd"))
      );
      
      if (kvkResult.kvk_extract_expired === true) {
        kvkMissingFields.push(`KVK-uittreksel is ouder dan 3 maanden (datum: ${kvkResult.kvk_extract_date})`);
      }
      
      // Recalculate score deterministically
      kvkSuggestion.score = Math.max(0, 100 - kvkMissingFields.length * 10);
      kvkSuggestion.aandachtspunten = kvkMissingFields;
      delete kvkSuggestion._original_ai_score;

      await supabase.from("dba_checks").update({
        kvk_check_result: kvkResult,
        suggestions: [kvkSuggestion],
        missing_fields: kvkMissingFields,
      }).eq("id", check_id);

      return new Response(JSON.stringify({ success: true, kvk_check_result: kvkResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "check_polis") {
      // Extract date from uploaded insurance policy
      if (!check.polis_text) {
        return new Response(JSON.stringify({ error: "Geen polistekst beschikbaar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const polisSystemPrompt = `Je bent een expert op het gebied van verzekeringen in Nederland.
De huidige datum is ${todayStr}.

Analyseer de tekst van een polis beroeps- en/of bedrijfsaansprakelijkheidsverzekering.

Je taak:
1. Zoek de afgiftedatum, ingangsdatum of datum van het polisblad. Dit kan staan als "Datum", "Ingangsdatum", "Afgiftedatum", "Datum polisblad", "Polisdatum", "Datum polis", of vergelijkbare aanduidingen.
2. Als er meerdere datums zijn, gebruik dan de AFGIFTEDATUM of DATUM POLISBLAD (niet de ingangsdatum van de verzekering zelf, tenzij er geen afgiftedatum is).
3. Geef de datum terug in YYYY-MM-DD formaat.
4. Beoordeel of de polis ouder is dan 1 jaar ten opzichte van vandaag (${todayStr}).
5. Geef een korte samenvatting van wat de polis dekt.

CRUCIAAL - DEKKINGSCONTROLE:
6. Controleer of de polis ZOWEL beroepsaansprakelijkheid (BAV) ALS bedrijfsaansprakelijkheid (AVB) dekt.
   - Een combinatiepolis die beide dekt is correct.
   - Als de polis ALLEEN beroepsaansprakelijkheid (BAV) dekt maar GEEN bedrijfsaansprakelijkheid (AVB): dit is een afwijking.
   - Als de polis ALLEEN bedrijfsaansprakelijkheid (AVB) dekt maar GEEN beroepsaansprakelijkheid (BAV): dit is een afwijking.
   - Zoek naar termen als: "beroepsaansprakelijkheid", "bedrijfsaansprakelijkheid", "BAV", "AVB", "combinatiepolis", "combi polis", "beroeps- en bedrijfsaansprakelijkheid".
   - Stel has_bav op true als beroepsaansprakelijkheid gedekt is.
   - Stel has_avb op true als bedrijfsaansprakelijkheid gedekt is.

BELANGRIJK:
- Een polis die ouder is dan 1 jaar is een aandachtspunt.
- Zeg NOOIT dat een polis "actueel" is als de afgiftedatum ouder is dan 1 jaar.
- Een polis die niet BEIDE dekkingen (BAV + AVB) bevat is een aandachtspunt.`;

      const polisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0,
          messages: [
            { role: "system", content: polisSystemPrompt },
            { role: "user", content: `Analyseer deze polistekst:\n\n${check.polis_text}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "report_polis_check",
              description: "Report the insurance policy analysis results",
              parameters: {
                type: "object",
                properties: {
                  polis_date: { type: "string", description: "Afgiftedatum van de polis in YYYY-MM-DD formaat, of null als niet gevonden" },
                  coverage_summary: { type: "string", description: "Korte samenvatting van de dekking" },
                  has_bav: { type: "boolean", description: "Of de polis beroepsaansprakelijkheid (BAV) dekt" },
                  has_avb: { type: "boolean", description: "Of de polis bedrijfsaansprakelijkheid (AVB) dekt" },
                  explanation: { type: "string", description: "Uitleg over de gevonden datum, dekkingstype en beoordeling" },
                },
                required: ["explanation"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "report_polis_check" } },
        }),
      });

      if (!polisResponse.ok) {
        return new Response(JSON.stringify({ error: "AI polis check mislukt" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const polisAiResult = await polisResponse.json();
      const polisToolCall = polisAiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!polisToolCall) {
        return new Response(JSON.stringify({ error: "Geen polis check resultaat" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const polisResult = JSON.parse(polisToolCall.function.arguments);

      // Check if policy is older than 1 year
      let polisExpired: boolean | null = null;
      if (polisResult.polis_date) {
        const polisDate = new Date(polisResult.polis_date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        polisExpired = polisDate < oneYearAgo;
      } else {
        polisExpired = null;
      }
      polisResult.polis_expired = polisExpired;

      // Update the suggestions with the polis check result
      const currentSuggestions = check.suggestions as any[] || [];
      const updatedSuggestion = currentSuggestions[0] || {};
      updatedSuggestion.insurance_policy_date = polisResult.polis_date || null;
      updatedSuggestion.insurance_policy_expired = polisExpired;
      updatedSuggestion.insurance_missing = false;
      updatedSuggestion.polis_check_result = polisResult;

      // Update missing_fields: remove old polis-related issues and add new if needed
      let updatedMissingFields = ((check.missing_fields as string[]) || []).filter(
        (f: string) => !f.toLowerCase().includes("polis") || (!f.toLowerCase().includes("datum") && !f.toLowerCase().includes("aangeleverd") && !f.toLowerCase().includes("ouder") && !f.toLowerCase().includes("bav") && !f.toLowerCase().includes("avb") && !f.toLowerCase().includes("dekking"))
      );
      if (polisExpired === true) {
        updatedMissingFields.push(`Polis beroeps-/bedrijfsaansprakelijkheid is ouder dan 1 jaar (datum: ${polisResult.polis_date})`);
      } else if (polisExpired === null) {
        updatedMissingFields.push("Datum polis beroeps- en bedrijfsaansprakelijkheid kon niet worden vastgesteld");
      }

      // Check BAV + AVB coverage
      const hasBav = polisResult.has_bav === true;
      const hasAvb = polisResult.has_avb === true;
      if (!hasBav && !hasAvb) {
        updatedMissingFields.push("Polis dekt geen beroepsaansprakelijkheid (BAV) noch bedrijfsaansprakelijkheid (AVB)");
      } else if (!hasBav) {
        updatedMissingFields.push("Polis dekt alleen bedrijfsaansprakelijkheid (AVB) — beroepsaansprakelijkheid (BAV) ontbreekt");
      } else if (!hasAvb) {
        updatedMissingFields.push("Polis dekt alleen beroepsaansprakelijkheid (BAV) — bedrijfsaansprakelijkheid (AVB) ontbreekt");
      }

      // Recalculate score deterministically: 100 - (number of issues * 10)
      updatedSuggestion.score = Math.max(0, 100 - updatedMissingFields.length * 10);
      // Remove legacy _original_ai_score if present
      delete updatedSuggestion._original_ai_score;
      updatedSuggestion.aandachtspunten = updatedMissingFields;

      await supabase.from("dba_checks").update({
        suggestions: [updatedSuggestion],
        missing_fields: updatedMissingFields,
      }).eq("id", check_id);

      return new Response(JSON.stringify({ success: true, polis_check_result: polisResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "certify") {
      // Generate ZP Approved certificate PDF
      const verificationToken = crypto.randomUUID();
      const { data: seqData, error: seqError } = await supabase.rpc("nextval_text", { seq_name: "dba_cert_seq" });
      if (seqError || !seqData) {
        console.error("Sequence error:", seqError);
        return new Response(JSON.stringify({ error: "Certificaatnummer kon niet worden gegenereerd. Controleer of de sequence 'dba_cert_seq' bestaat." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const certNum = "ZPDBA" + seqData;
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
          // Strip control chars AND non-Latin1 characters (pdf-lib WinAnsi only supports 0x00-0xFF)
          return text.replace(/[\n\r\t\x00-\x1F]/g, " ").replace(/[^\x20-\xFF]/g, "").replace(/\s+/g, " ").trim() || "-";
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

          // Pre-calculate all lines
          const renderedBlocks: Array<{ type: string; lines: string[]; spaceBefore: number }> = [];
          blocks.forEach((block, idx) => {
            const spaceBefore = idx > 0 ? paragraphSpacing : 0;
            const maxW = block.type === "bullet" ? valueMaxW - bulletIndent : valueMaxW;
            const lines = wrapText(block.text, helvetica, fontSize, maxW);
            renderedBlocks.push({ type: block.type, lines, spaceBefore });
          });

          // Flatten all drawable items into a sequential list
          const items: Array<{ text: string; xOffset: number; bullet: boolean; spaceBefore: number }> = [];
          renderedBlocks.forEach((block) => {
            block.lines.forEach((line, li) => {
              items.push({
                text: line,
                xOffset: block.type === "bullet" ? bulletIndent : 0,
                bullet: block.type === "bullet" && li === 0,
                spaceBefore: li === 0 ? block.spaceBefore : 0,
              });
            });
          });

          // Calculate total height
          const totalExtraSpacing = items.reduce((sum, item) => sum + item.spaceBefore, 0);
          const totalH = Math.max(24, items.length * lineHeight + totalExtraSpacing + rowPadding * 2);

          // Available space on current page
          const availableH = y - footerZone;

          if (totalH <= availableH) {
            // Fits on one page — draw single cell
            ensureSpace(totalH);
            if (altBg) currentPage.drawRectangle({ x: margin, y: y - totalH, width: tableWidth, height: totalH, color: lightGrayBg });
            currentPage.drawRectangle({ x: margin, y: y - totalH, width: tableWidth, height: totalH, borderColor: tableBorder, borderWidth: 0.4 });
            currentPage.drawLine({ start: { x: valueColX, y }, end: { x: valueColX, y: y - totalH }, thickness: 0.4, color: tableBorder });
            const labelLines = label.split("\n");
            labelLines.forEach((ll, li) => {
              currentPage.drawText(ll, { x: margin + 8, y: y - 16 - li * lineHeight, size: fontSize, font: helveticaBold, color: darkGray });
            });
            let drawY = y - 16;
            items.forEach((item) => {
              drawY -= item.spaceBefore;
              if (item.bullet) currentPage.drawText("\u2022", { x: valueColX + 8, y: drawY, size: fontSize, font: helvetica, color: darkGray });
              currentPage.drawText(item.text, { x: valueColX + 8 + item.xOffset, y: drawY, size: fontSize, font: helvetica, color: black });
              drawY -= lineHeight;
            });
            y -= totalH;
          } else {
            // Multi-page: draw items line by line with page breaks
            const drawCellBorders = (topY: number, bottomY: number) => {
              const h = topY - bottomY;
              if (altBg) currentPage.drawRectangle({ x: margin, y: bottomY, width: tableWidth, height: h, color: lightGrayBg });
              currentPage.drawRectangle({ x: margin, y: bottomY, width: tableWidth, height: h, borderColor: tableBorder, borderWidth: 0.4 });
              currentPage.drawLine({ start: { x: valueColX, y: topY }, end: { x: valueColX, y: bottomY }, thickness: 0.4, color: tableBorder });
            };

            let cellTopY = y;
            // Label on first page
            currentPage.drawText(label, { x: margin + 8, y: y - 16, size: fontSize, font: helveticaBold, color: darkGray });
            let drawY = y - 16;

            for (const item of items) {
              drawY -= item.spaceBefore;
              if (drawY - lineHeight < footerZone) {
                // Close current cell segment
                drawCellBorders(cellTopY, footerZone);
                addNewPage();
                cellTopY = y;
                drawY = y - 16;
              }
              if (item.bullet) currentPage.drawText("\u2022", { x: valueColX + 8, y: drawY, size: fontSize, font: helvetica, color: darkGray });
              currentPage.drawText(item.text, { x: valueColX + 8 + item.xOffset, y: drawY, size: fontSize, font: helvetica, color: black });
              drawY -= lineHeight;
            }
            // Close final segment
            drawCellBorders(cellTopY, drawY + lineHeight - rowPadding);
            y = drawY + lineHeight - rowPadding;
          }
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
            // Try PNG first, fall back to JPG (uploaded file may be JPEG with .png extension)
            try {
              zpLogoImage = await pdfDoc.embedPng(zpLogoBytes);
            } catch {
              zpLogoImage = await pdfDoc.embedJpg(zpLogoBytes);
            }
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
          const { data: sigData } = await supabase.storage.from("certificates").download("templates/signature-gertjan.jpg");
          if (sigData) {
            const sigBytes = new Uint8Array(await sigData.arrayBuffer());
            sigImage = await pdfDoc.embedJpg(sigBytes);
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
          const ofOrigW = ofLogoImage.width;
          const ofOrigH = ofLogoImage.height;
          const ofTargetH = 35;
          const ofTargetW = (ofOrigW / ofOrigH) * ofTargetH;
          page.drawImage(ofLogoImage, { x: pageWidth - rightMargin - ofTargetW, y: logoY - 5, width: ofTargetW, height: ofTargetH });
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
        drawRow("Naam ZP kandidaat", check.client_name || getFieldValue("naam") || "-", { altBg: alt() });
        drawRow("Opdrachtgever", check.opdrachtgever || getFieldValue("opdrachtgever") || "-", { altBg: alt() });
        drawRow("Eindopdrachtgever", check.eindopdrachtgever || getFieldValue("eindopdrachtgever") || "-", { altBg: alt() });
        drawRow("Functie", check.functie || getFieldValue("functie") || "-", { altBg: alt() });
        const descAlt = alt();
        const descriptionText = check.rewritten_description || check.project_description || getFieldValue("opdrachtomschrijving") || "-";
        const descLabel = check.rewritten_description ? "Opdrachtomschrijving\n(DBA-proof)" : "Opdrachtomschrijving";
        console.log("Description source:", check.rewritten_description ? "rewritten_description" : check.project_description ? "project_description" : "field_value");
        console.log("Description text length:", descriptionText.length, "First 300 chars:", descriptionText.substring(0, 300));
        drawDescriptionRow(descLabel, descriptionText, descAlt);
        console.log("After drawDescriptionRow, y =", y, "page count =", pdfDoc.getPageCount());
        drawRow("Project", check.project_name || getFieldValue("project") || "-", { altBg: alt() });
        drawRow("Startdatum", check.startdatum ? formatDate(check.startdatum) : getFieldValue("startdatum") || "-", { altBg: alt() });
        drawRow("Einddatum", check.einddatum ? formatDate(check.einddatum) : getFieldValue("einddatum") || "-", { altBg: alt() });
        drawRow("Optie tot verlenging", check.optie_verlenging || getFieldValue("verlenging") || "-", { altBg: alt() });
        drawRow("Uurtarief", check.uurtarief || getFieldValue("uurtarief") || "-", { altBg: alt() });
        drawRow("Aantal uur per week", check.uren_per_week || getFieldValue("uur per week") || "-", { altBg: alt() });
        drawRow("Specifieke vaardigheden", check.specifieke_vaardigheden || getFieldValue("specifieke vaardigheden") || "-", { altBg: alt() });

        // === Zelfstandigheid rows — DB columns take priority over AI field_results ===
        const zelfstandig = check.treedt_zelfstandig_op ?? getFieldBool("zelfstandig naar buiten") ?? false;
        const eigenMateriaal = check.eigen_materiaal_werkwijze ?? getFieldBool("eigen materiaal") ?? getFieldBool("zelfstandigheid") ?? false;
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
        // Use manually edited missing_fields as primary source (from CertificatePreviewDialog)
        const manualMissingFields = (check.missing_fields || []) as string[];
        const aandachtspunten: string[] = manualMissingFields
          .map((a: string) => cleanText(a))
          .filter((a: string) => a !== "-" && a.trim() !== "");

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
          const scoreColor = score >= 75 ? green : aandachtColor;
          const scoreBgColor = score >= 75 ? rgb(0.93, 0.98, 0.93) : rgb(1, 0.95, 0.9);
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

      // Only certify if PDF was successfully generated and uploaded
      if (!pdfPath) {
        return new Response(JSON.stringify({ error: "PDF generatie of upload is mislukt. Certificaat is NIET aangemaakt. Probeer opnieuw." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
