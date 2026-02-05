 import { useParams, Link } from "react-router-dom";
 import { Helmet } from "react-helmet-async";
 import { Layout } from "@/components/layout/Layout";
 import { useArticle } from "@/hooks/useArticles";
 import { ArrowLeft, Calendar, Clock, ExternalLink, Shield } from "lucide-react";
 import { Button } from "@/components/ui/button";
 import { Skeleton } from "@/components/ui/skeleton";
 import ReactMarkdown from "react-markdown";
 import remarkGfm from "remark-gfm";
 
 export default function ArtikelDetail() {
   const { slug } = useParams<{ slug: string }>();
   const { data: article, isLoading, error } = useArticle(slug || "");
 
   if (isLoading) {
     return (
       <Layout>
         <div className="container-wide section-padding">
           <Skeleton className="h-8 w-32 mb-6" />
           <Skeleton className="h-12 w-3/4 mb-4" />
           <Skeleton className="h-6 w-1/2 mb-8" />
           <div className="space-y-4">
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-full" />
             <Skeleton className="h-4 w-3/4" />
           </div>
         </div>
       </Layout>
     );
   }
 
   if (error || !article) {
     return (
       <Layout>
         <div className="container-wide section-padding text-center">
           <h1 className="text-2xl font-bold mb-4">Artikel niet gevonden</h1>
           <p className="text-muted-foreground mb-6">
             Het artikel dat je zoekt bestaat niet of is verwijderd.
           </p>
           <Button asChild>
             <Link to="/kennisbank">
               <ArrowLeft className="h-4 w-4 mr-2" />
               Terug naar kennisbank
             </Link>
           </Button>
         </div>
       </Layout>
     );
   }
 
   const formattedDate = article.published_at
     ? new Date(article.published_at).toLocaleDateString("nl-NL", {
         day: "numeric",
         month: "long",
         year: "numeric",
       })
     : null;
 
   // Structured data for article
   const articleSchema = {
     "@context": "https://schema.org",
     "@type": "Article",
     headline: article.seo_title || article.title,
     description: article.seo_description || article.excerpt,
     datePublished: article.published_at,
     author: {
       "@type": "Organization",
       name: "ZP Zaken",
     },
     publisher: {
       "@type": "Organization",
       name: "ZP Zaken",
       logo: {
         "@type": "ImageObject",
         url: "https://zpzaken.nl/favicon.png",
       },
     },
     mainEntityOfPage: {
       "@type": "WebPage",
       "@id": `https://zpzaken.nl/kennisbank/${article.slug}`,
     },
     image: article.image_url || "https://zpzaken.nl/favicon.png",
   };
 
   return (
     <Layout>
       <Helmet>
         <title>{article.seo_title || article.title} | ZP Zaken Kennisbank</title>
         <meta
           name="description"
           content={article.seo_description || article.excerpt || ""}
         />
         <meta property="og:title" content={article.seo_title || article.title} />
         <meta
           property="og:description"
           content={article.seo_description || article.excerpt || ""}
         />
         <meta property="og:type" content="article" />
         {article.image_url && (
           <meta property="og:image" content={article.image_url} />
         )}
         <link
           rel="canonical"
           href={`https://zpzaken.nl/kennisbank/${article.slug}`}
         />
         <script type="application/ld+json">
           {JSON.stringify(articleSchema)}
         </script>
       </Helmet>
 
       <article className="container-wide section-padding max-w-4xl mx-auto">
         {/* Back button */}
         <Link
           to="/kennisbank"
           className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
         >
           <ArrowLeft className="h-4 w-4" />
           Terug naar kennisbank
         </Link>
 
         {/* Category badge */}
         <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 text-accent px-3 py-1.5 rounded-lg text-sm font-medium mb-4">
           <Shield className="h-3.5 w-3.5" />
           {article.category}
         </div>
 
         {/* Title */}
         <h1 className="text-3xl md:text-4xl font-bold mb-4">{article.title}</h1>
 
         {/* Meta */}
         <div className="flex flex-wrap items-center gap-4 text-muted-foreground mb-8">
           {formattedDate && (
             <span className="inline-flex items-center gap-1.5">
               <Calendar className="h-4 w-4" />
               {formattedDate}
             </span>
           )}
           {article.read_time && (
             <span className="inline-flex items-center gap-1.5">
               <Clock className="h-4 w-4" />
               {article.read_time} leestijd
             </span>
           )}
           {article.source_name && article.source_url && (
             <a
               href={article.source_url}
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
             >
               <ExternalLink className="h-4 w-4" />
               Bron: {article.source_name}
             </a>
           )}
         </div>
 
         {/* Featured image */}
         {article.image_url && (
           <img
             src={article.image_url}
             alt={article.title}
             className="w-full h-64 md:h-96 object-cover rounded-2xl mb-8"
           />
         )}
 
         {/* Content */}
         <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary hover:prose-a:text-accent prose-strong:text-foreground">
           <ReactMarkdown remarkPlugins={[remarkGfm]}>
             {article.content || ""}
           </ReactMarkdown>
         </div>
 
         {/* CTA */}
         <div className="mt-12 p-6 bg-secondary rounded-2xl text-center">
           <h3 className="text-xl font-semibold mb-2">Vragen over dit onderwerp?</h3>
           <p className="text-muted-foreground mb-4">
             Onze adviseurs helpen je graag met persoonlijk advies.
           </p>
           <Button variant="accent" asChild>
             <Link to="/contact">Neem contact op</Link>
           </Button>
         </div>
       </article>
     </Layout>
   );
 }