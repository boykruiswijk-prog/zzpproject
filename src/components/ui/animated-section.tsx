 import { motion, useInView } from "framer-motion";
 import { useRef, ReactNode } from "react";
 
 interface AnimatedSectionProps {
   children: ReactNode;
   className?: string;
   delay?: number;
   direction?: "up" | "down" | "left" | "right" | "none";
 }
 
 export function AnimatedSection({ 
   children, 
   className = "", 
   delay = 0,
   direction = "up" 
 }: AnimatedSectionProps) {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-100px" });
 
   const directionOffset = {
     up: { y: 40, x: 0 },
     down: { y: -40, x: 0 },
     left: { y: 0, x: 40 },
     right: { y: 0, x: -40 },
     none: { y: 0, x: 0 },
   };
 
   return (
     <motion.div
       ref={ref}
       initial={{ 
         opacity: 0, 
         y: directionOffset[direction].y,
         x: directionOffset[direction].x 
       }}
       animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
       transition={{ 
         duration: 0.6, 
         delay,
         ease: [0.21, 0.47, 0.32, 0.98]
       }}
       className={className}
     >
       {children}
     </motion.div>
   );
 }
 
 interface StaggerContainerProps {
   children: ReactNode;
   className?: string;
   staggerDelay?: number;
 }
 
 export function StaggerContainer({ 
   children, 
   className = "",
   staggerDelay = 0.1 
 }: StaggerContainerProps) {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true, margin: "-50px" });
 
   return (
     <motion.div
       ref={ref}
       initial="hidden"
       animate={isInView ? "visible" : "hidden"}
       variants={{
         hidden: {},
         visible: {
           transition: {
             staggerChildren: staggerDelay,
           },
         },
       }}
       className={className}
     >
       {children}
     </motion.div>
   );
 }
 
 interface StaggerItemProps {
   children: ReactNode;
   className?: string;
 }
 
 export function StaggerItem({ children, className = "" }: StaggerItemProps) {
   return (
     <motion.div
       variants={{
         hidden: { opacity: 0, y: 20 },
         visible: { 
           opacity: 1, 
           y: 0,
           transition: {
             duration: 0.5,
             ease: [0.21, 0.47, 0.32, 0.98]
           }
         },
       }}
       className={className}
     >
       {children}
     </motion.div>
   );
 }
 
 interface CounterProps {
   from?: number;
   to: number;
   duration?: number;
   suffix?: string;
   prefix?: string;
   className?: string;
 }
 
 export function Counter({ 
   from = 0, 
   to, 
   duration = 2, 
   suffix = "",
   prefix = "",
   className = "" 
 }: CounterProps) {
   const ref = useRef(null);
   const isInView = useInView(ref, { once: true });
 
   return (
     <motion.span
       ref={ref}
       className={className}
       initial={{ opacity: 0 }}
       animate={isInView ? { opacity: 1 } : {}}
     >
       {isInView && (
         <motion.span
           initial={{ opacity: 1 }}
           animate={{ opacity: 1 }}
         >
           {prefix}
           <motion.span
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.3 }}
           >
             {to.toLocaleString()}
           </motion.span>
           {suffix}
         </motion.span>
       )}
     </motion.span>
   );
 }