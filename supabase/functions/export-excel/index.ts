import ExcelJS from "npm:exceljs@4.4.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth - only team members can export
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is team member
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some(({ role }) => ["admin", "supervisor", "verzekering"].includes(role));
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch all data in parallel
    const [leadsRes, signupsRes, newsletterRes, articlesRes] = await Promise.all([
      admin.from("leads").select("*").order("created_at", { ascending: false }),
      admin.from("collective_signups").select("*").order("created_at", { ascending: false }),
      admin.from("collective_newsletter").select("*").order("created_at", { ascending: false }),
      admin.from("articles").select("*").order("created_at", { ascending: false }),
    ]);

    const leads = leadsRes.data || [];
    const signups = signupsRes.data || [];
    const newsletter = newsletterRes.data || [];
    const articles = articlesRes.data || [];

    // Create workbook
    const wb = new ExcelJS.Workbook();
    const addSheet = (name: string, rows: Record<string, unknown>[]) => {
      const ws = wb.addWorksheet(name);
      if (rows.length === 0) return;
      ws.columns = Object.keys(rows[0]).map((key) => ({ header: key, key }));
      for (const row of rows) ws.addRow(row);
    };

    // --- Tab 1: Alle Leads (overview) ---
    const allLeadsRows = leads.map((l: any) => ({
      "Voornaam": l.voornaam,
      "Achternaam": l.achternaam,
      "Email": l.email,
      "Telefoon": l.telefoon || "",
      "Bedrijfsnaam": l.bedrijfsnaam || "",
      "KvK": l.kvk_nummer || "",
      "Beroep": l.beroep || "",
      "Type": l.type,
      "Status": l.status,
      "Bron": l.bron,
      "Verzekering type": l.verzekering_type || "",
      "Verzekerd bedrag": l.verzekerd_bedrag || "",
      "Eigen risico": l.eigen_risico || "",
      "Omzet": l.omzet || "",
      "Geboortedatum": l.geboortedatum || "",
      "Ingangsdatum": l.ingangsdatum || "",
      "Opmerkingen": l.opmerkingen || "",
      "Aangemaakt": l.created_at,
      "Bijgewerkt": l.updated_at,
    }));
    addSheet("Alle Leads", allLeadsRows);

    // --- Tab 2: Verzekeringsaanvragen ---
    const verzekeringLeads = leads.filter((l: any) => l.type === "verzekering_aanvraag");
    addSheet("Verzekeringen",
      verzekeringLeads.map((l: any) => ({
        "Voornaam": l.voornaam,
        "Achternaam": l.achternaam,
        "Email": l.email,
        "Telefoon": l.telefoon || "",
        "Bedrijfsnaam": l.bedrijfsnaam || "",
        "Beroep": l.beroep || "",
        "Verzekering type": l.verzekering_type || "",
        "Verzekerd bedrag": l.verzekerd_bedrag || "",
        "Eigen risico": l.eigen_risico || "",
        "Geboortedatum": l.geboortedatum || "",
        "Ingangsdatum": l.ingangsdatum || "",
        "Status": l.status,
        "Omzet": l.omzet || "",
        "Opmerkingen": l.opmerkingen || "",
        "Aangemaakt": l.created_at,
      }))
    ));

    // --- Tab 3: Contactaanvragen ---
    const contactLeads = leads.filter((l: any) => l.type === "contact");
    addSheet("Contactaanvragen",
      contactLeads.map((l: any) => ({
        "Voornaam": l.voornaam,
        "Achternaam": l.achternaam,
        "Email": l.email,
        "Telefoon": l.telefoon || "",
        "Bedrijfsnaam": l.bedrijfsnaam || "",
        "Beroep": l.beroep || "",
        "Status": l.status,
        "Opmerkingen": l.opmerkingen || "",
        "Aangemaakt": l.created_at,
      }))
    ));

    // --- Tab 4: Collectieve Inkoop ---
    addSheet("Collectieve Inkoop",
      signups.map((s: any) => ({
        "Naam": s.naam,
        "Email": s.email,
        "Telefoon": s.telefoon || "",
        "Postcode": s.postcode || "",
        "Pilot": s.pilot_slug,
        "Type": s.type || "",
        "Huidige leverancier": s.huidige_leverancier || "",
        "Interesse gebieden": (s.interesse_gebieden || []).join(", "),
        "Aangemaakt": s.created_at,
      }))
    ));

    // --- Tab 5: Nieuwsbrief ---
    addSheet("Nieuwsbrief",
      newsletter.map((n: any) => ({
        "Email": n.email,
        "Aangemeld op": n.created_at,
      }))
    ));

    // --- Tab 6: Artikelen ---
    addSheet("Artikelen",
      articles.map((a: any) => ({
        "Titel": a.title,
        "Slug": a.slug,
        "Categorie": a.category,
        "Excerpt": a.excerpt || "",
        "Gepubliceerd": a.is_published ? "Ja" : "Nee",
        "Publicatiedatum": a.published_at || "",
        "Leestijd": a.read_time || "",
        "Bron": a.source_name || "",
        "Aangemaakt": a.created_at,
      }))
    ));

    // Generate buffer
    const buf = await wb.xlsx.writeBuffer();

    const now = new Date().toISOString().slice(0, 10);
    await admin.from("sensitive_audit_log").insert({
      target_table: "export", actie: "klantlijsten_exporteren", uitgevoerd_door: user.id,
      uitgevoerd_door_email: user.email ?? null,
      details: { leads: leads.length, signups: signups.length, newsletter: newsletter.length, articles: articles.length },
    });
    return new Response(buf as ArrayBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="zpzaken-export-${now}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
