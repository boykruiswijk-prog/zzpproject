 import { ArrowRight, Calendar, Clock, Shield } from "lucide-react";
 import { motion } from "framer-motion";
 import type { Article } from "@/hooks/useArticles";
 import { LocalizedLink } from "@/components/LocalizedLink";
 
 // Default images based on category
 const categoryImages: Record<string, string> = {
   Wetgeving: "/placeholder.svg",
   Verzekeringen: "/placeholder.svg",
   Fiscaal: "/placeholder.svg",
   "ZP Radio": "/placeholder.svg",
   "ZP Facts": "/placeholder.svg",
   Nieuws: "/placeholder.svg",
   Administratie: "/placeholder.svg",
   Algemeen: "/placeholder.svg",
 };
 
 interface ArticleCardProps {
   article: Article;
   index: number;
 }
 
 export function ArticleCard({ article, index }: ArticleCardProps) {
   const imageUrl = article.image_url || categoryImages[article.category] || "/placeholder.svg";
   const formattedDate = article.published_at
     ? new Date(article.published_at).toLocaleDateString("nl-NL", {
         day: "numeric",
         month: "long",
         year: "numeric",
       })
     : null;
 
   return (
     <motion.article
       initial={{ opacity: 0, y: 20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.4, delay: index * 0.1 }}
       className="bg-card rounded-2xl overflow-hidden shadow-card border border-border/50 hover:shadow-lg hover:border-accent/30 transition-all duration-300 group cursor-pointer flex flex-col"
       itemScope
       itemType="https://schema.org/Article"
     >
       <LocalizedLink to={`/kennisbank/${article.slug}`} className="flex flex-col flex-1">
         {/* Article Image */}
         <div className="relative h-48 overflow-hidden">
           <img
             src={imageUrl}
             alt={article.title}
             className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
             loading="lazy"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent" />
           <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 bg-accent/90 backdrop-blur-sm text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium">
             <Shield className="h-3.5 w-3.5" />
             <span itemProp="articleSection">{article.category}</span>
           </div>
         </div>
 
         <div className="p-6 flex flex-col flex-1">
           <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors line-clamp-2" itemProp="headline">
             {article.title}
           </h3>
           <p className="text-muted-foreground mb-4 flex-1 line-clamp-3" itemProp="description">
             {article.excerpt}
           </p>
           <div className="flex items-center gap-3 pt-4 border-t border-border/50 mt-auto">
             {formattedDate && (
               <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-md text-xs text-muted-foreground">
                 <Calendar className="h-3 w-3" />
                 <time itemProp="datePublished">{formattedDate}</time>
               </span>
             )}
             {article.read_time && (
               <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-md text-xs text-muted-foreground">
                 <Clock className="h-3 w-3" />
                 {article.read_time}
               </span>
             )}
           </div>
         </div>
 
         <div className="px-6 pb-6">
           <span className="inline-flex items-center gap-2 text-sm font-medium text-primary group-hover:text-accent transition-colors">
             Lees artikel
             <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
           </span>
         </div>
       </LocalizedLink>
     </motion.article>
   );
 }
