import { ReactNode } from "react";
import teamHero from "@/assets/team-hero.jpg";

interface PageHeroProps {
  title: ReactNode;
  subtitle?: string;
  badge?: {
    icon?: ReactNode;
    text: string;
  };
  children?: ReactNode;
  showBackgroundImage?: boolean;
}

export function PageHero({ 
  title, 
  subtitle, 
  badge, 
  children,
  showBackgroundImage = true 
}: PageHeroProps) {
  return (
    <section className="relative min-h-[40vh] flex items-center overflow-hidden">
      {/* Background Image */}
      {showBackgroundImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={teamHero}
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
        <div className="max-w-3xl">
          {badge && (
            <div className="inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm border border-primary/30 text-primary-foreground px-4 py-2 rounded-full mb-6">
              {badge.icon}
              <span className="text-sm font-medium">{badge.text}</span>
            </div>
          )}

          <h1 className="mb-6 text-primary-foreground leading-tight">
            {title}
          </h1>

          {subtitle && (
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8">
              {subtitle}
            </p>
          )}

          {children}
        </div>
      </div>
    </section>
  );
}
