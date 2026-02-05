 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
 };
 
 interface Article {
   title: string;
   excerpt: string;
   content: string;
   category: string;
   source_url: string;
   source_name: string;
   slug: string;
 }
 
 function generateSlug(title: string): string {
   return title
     .toLowerCase()
     .replace(/[^a-z0-9\s-]/g, '')
     .replace(/\s+/g, '-')
     .replace(/-+/g, '-')
     .substring(0, 60);
 }
 
 function estimateReadTime(content: string): string {
   const wordsPerMinute = 200;
   const wordCount = content?.split(/\s+/).length || 0;
   const minutes = Math.ceil(wordCount / wordsPerMinute);
   return `${Math.max(1, minutes)} min`;
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
     if (!apiKey) {
       console.error('FIRECRAWL_API_KEY not configured');
       return new Response(
         JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
     const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const supabase = createClient(supabaseUrl, supabaseServiceKey);
 
     const articles: Article[] = [];
 
     // 1. Scrape zpzaken.nl/kennisbank
     console.log('Scraping zpzaken.nl/kennisbank...');
     try {
       const kennisbankResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${apiKey}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           url: 'https://zpzaken.nl/kennisbank',
           formats: ['markdown', 'links'],
           onlyMainContent: true,
         }),
       });
 
       const kennisbankData = await kennisbankResponse.json();
       console.log('Kennisbank scraped:', kennisbankData.success);
 
       // Extract article links
       const links = kennisbankData.data?.links || [];
       const articleLinks = links.filter((link: string) => 
         link.includes('/kennisbank/') && !link.endsWith('/kennisbank')
       ).slice(0, 20);
 
       console.log(`Found ${articleLinks.length} article links`);
 
       // Scrape each article
       for (const link of articleLinks) {
         try {
           console.log(`Scraping article: ${link}`);
           const articleResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${apiKey}`,
               'Content-Type': 'application/json',
             },
             body: JSON.stringify({
               url: link,
               formats: ['markdown'],
               onlyMainContent: true,
             }),
           });
 
           const articleData = await articleResponse.json();
           if (articleData.success && articleData.data?.markdown) {
             const markdown = articleData.data.markdown;
             const title = articleData.data.metadata?.title || markdown.split('\n')[0].replace(/^#\s*/, '');
             const excerpt = markdown.substring(0, 200).replace(/[#*_]/g, '').trim() + '...';
             
             // Determine category based on content
             let category = 'Algemeen';
             const lowerContent = markdown.toLowerCase();
             if (lowerContent.includes('verzekering') || lowerContent.includes('aov')) category = 'Verzekeringen';
             else if (lowerContent.includes('wet ') || lowerContent.includes('dba') || lowerContent.includes('vbar')) category = 'Wetgeving';
             else if (lowerContent.includes('belasting') || lowerContent.includes('kor') || lowerContent.includes('fiscaal')) category = 'Fiscaal';
             else if (lowerContent.includes('administratie')) category = 'Administratie';
             else if (lowerContent.includes('zp radio')) category = 'ZP Radio';
             else if (lowerContent.includes('zp facts')) category = 'ZP Facts';
 
             articles.push({
               title: title.substring(0, 200),
               excerpt,
               content: markdown,
               category,
               source_url: link,
               source_name: 'ZP Zaken',
               slug: generateSlug(title),
             });
           }
         } catch (err) {
           console.error(`Error scraping ${link}:`, err);
         }
       }
     } catch (err) {
       console.error('Error scraping kennisbank:', err);
     }
 
     // 2. Search for external articles about ZP Zaken
     const searchQueries = ['ZP Zaken zzp', 'ZP Radio podcast', 'ZP Facts zzp'];
     
     for (const query of searchQueries) {
       console.log(`Searching: ${query}...`);
       try {
         const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${apiKey}`,
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             query,
             limit: 5,
             lang: 'nl',
             country: 'NL',
             scrapeOptions: { formats: ['markdown'] },
           }),
         });
 
         const searchData = await searchResponse.json();
         console.log(`Search results for "${query}":`, searchData.success);
 
         if (searchData.success && searchData.data) {
           for (const result of searchData.data) {
             if (result.markdown && result.title) {
               let category = 'Nieuws';
               if (query.includes('Radio')) category = 'ZP Radio';
               else if (query.includes('Facts')) category = 'ZP Facts';
 
               const slug = generateSlug(result.title);
               // Avoid duplicates
               if (!articles.some(a => a.slug === slug)) {
                 articles.push({
                   title: result.title.substring(0, 200),
                   excerpt: result.description || result.markdown.substring(0, 200).replace(/[#*_]/g, '').trim() + '...',
                   content: result.markdown,
                   category,
                   source_url: result.url,
                   source_name: new URL(result.url).hostname.replace('www.', ''),
                   slug,
                 });
               }
             }
           }
         }
       } catch (err) {
         console.error(`Error searching "${query}":`, err);
       }
     }
 
     console.log(`Total articles found: ${articles.length}`);
 
     // Insert articles into database
     let insertedCount = 0;
     for (const article of articles) {
       try {
         const { error } = await supabase
           .from('articles')
           .upsert({
             slug: article.slug,
             title: article.title,
             excerpt: article.excerpt,
             content: article.content,
             category: article.category,
             source_url: article.source_url,
             source_name: article.source_name,
             read_time: estimateReadTime(article.content),
             is_published: true,
           }, { onConflict: 'slug' });
 
         if (error) {
           console.error(`Error inserting article "${article.title}":`, error);
         } else {
           insertedCount++;
         }
       } catch (err) {
         console.error(`Error inserting article:`, err);
       }
     }
 
     return new Response(
       JSON.stringify({ 
         success: true, 
         message: `Scraped ${articles.length} articles, inserted ${insertedCount}`,
         articles: articles.map(a => ({ title: a.title, category: a.category, source: a.source_name }))
       }),
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
 
   } catch (error) {
     console.error('Error in scrape-articles:', error);
     return new Response(
       JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });