import { ReactNode } from "react";
import { motion } from "framer-motion";
import teamMeeting from "@/assets/team-meeting.jpg";

interface PageHeroProps {
  title: ReactNode;
  subtitle?: string;
  badge?: {
    icon?: ReactNode;
    text: string;
  };
  children?: ReactNode;
  showBackgroundImage?: boolean;
  backgroundImage?: string;
}

export function PageHero({ 
  title, 
  subtitle, 
  badge, 
  children,
  showBackgroundImage = true,
  backgroundImage
}: PageHeroProps) {
  const bgImage = backgroundImage || teamMeeting;
  
  return (
    <section className="relative min-h-[40vh] flex items-center overflow-hidden">
      {/* Background Image */}
      {showBackgroundImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={bgImage}
            alt=""
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/95 via-foreground/90 to-foreground/80" />
        </div>
      )}

      {/* Fallback gradient background */}
      {!showBackgroundImage && (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary via-primary to-primary/90" />
      )}

      <div className="container-wide relative z-10 py-16 md:py-24">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="max-w-3xl"
        >
          {badge && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary-foreground px-4 py-2 rounded-full mb-6"
            >
              {badge.icon}
              <span className="text-sm font-medium">{badge.text}</span>
            </motion.div>
          )}

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-6 text-primary-foreground leading-tight"
          >
            {title}
          </motion.h1>

          {subtitle && (
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-lg md:text-xl text-primary-foreground/80 mb-8"
            >
              {subtitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {children}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
