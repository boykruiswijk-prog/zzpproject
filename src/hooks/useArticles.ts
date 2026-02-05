 import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 
 export interface Article {
   id: string;
   slug: string;
   title: string;
   excerpt: string | null;
   content: string | null;
   category: string;
   source_url: string | null;
   source_name: string | null;
   image_url: string | null;
   read_time: string | null;
   published_at: string | null;
   seo_title: string | null;
   seo_description: string | null;
 }
 
 export function useArticles(category?: string) {
   return useQuery({
     queryKey: ["articles", category],
     queryFn: async () => {
       let query = supabase
         .from("articles")
         .select("*")
         .eq("is_published", true)
         .order("published_at", { ascending: false });
 
       if (category && category !== "Alle") {
         query = query.eq("category", category);
       }
 
       const { data, error } = await query;
 
       if (error) {
         console.error("Error fetching articles:", error);
         throw error;
       }
 
       return data as Article[];
     },
   });
 }
 
 export function useArticle(slug: string) {
   return useQuery({
     queryKey: ["article", slug],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("articles")
         .select("*")
         .eq("slug", slug)
         .eq("is_published", true)
         .maybeSingle();
 
       if (error) {
         console.error("Error fetching article:", error);
         throw error;
       }
 
       return data as Article | null;
     },
     enabled: !!slug,
   });
 }
 
 export function useArticleCategories() {
   return useQuery({
     queryKey: ["article-categories"],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("articles")
         .select("category")
         .eq("is_published", true);
 
       if (error) {
         console.error("Error fetching categories:", error);
         throw error;
       }
 
       const categories = [...new Set(data?.map((a) => a.category) || [])];
       return ["Alle", ...categories.sort()];
     },
   });
 }