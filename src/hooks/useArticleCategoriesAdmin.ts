import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ArticleCategory {
  slug: string;
  label: string;
  hub_slug: string | null;
  sort_order: number;
}

export function useArticleCategoryList() {
  return useQuery({
    queryKey: ["article-category-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("article_categories")
        .select("slug,label,hub_slug,sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ArticleCategory[];
    },
  });
}
