 import { Shield } from "lucide-react";
 import { motion } from "framer-motion";
 
 interface CategoryFilterProps {
   categories: string[];
   activeCategory: string;
   onCategoryChange: (category: string) => void;
 }
 
 export function CategoryFilter({
   categories,
   activeCategory,
   onCategoryChange,
 }: CategoryFilterProps) {
   return (
     <section className="bg-background border-b border-border">
       <div className="container-wide py-4">
         <div className="flex flex-wrap gap-2">
           {categories.map((category, index) => (
             <motion.button
               key={category}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.3, delay: index * 0.05 }}
               onClick={() => onCategoryChange(category)}
               className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                 activeCategory === category
                   ? "bg-accent/10 border border-accent/20 text-accent"
                   : "bg-secondary text-muted-foreground hover:bg-accent/10 hover:text-foreground border border-transparent hover:border-accent/20"
               }`}
             >
               <Shield className="h-3.5 w-3.5" />
               {category}
             </motion.button>
           ))}
         </div>
       </div>
     </section>
   );
 }