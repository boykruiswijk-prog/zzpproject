import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_published_articles",
  title: "List published Kennisbank articles",
  description:
    "List published articles from the ZP Zaken Kennisbank (title, slug, category, published_at, excerpt). Read-only, no authentication required.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of articles to return."),
    category_slug: z.string().optional().describe("Optional category slug to filter by."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, category_slug }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      return { content: [{ type: "text", text: "Backend not configured" }], isError: true };
    }
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    let q = supabase
      .from("articles")
      .select("title, slug, excerpt, published_at, article_categories(slug, name)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (category_slug) q = q.eq("article_categories.slug", category_slug);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { articles: data ?? [] },
    };
  },
});
