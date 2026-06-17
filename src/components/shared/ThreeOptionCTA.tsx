import { ArrowRight, FileText, MessageCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalizedLink } from "@/components/LocalizedLink";
import { cn } from "@/lib/utils";

interface ThreeOptionCTAProps {
  variant?: "default" | "hero";
  showHelperText?: boolean;
  className?: string;
}

/**
 * Drie-keuze CTA blok: direct afsluiten, offerte aanvragen, persoonlijk gesprek.
 * Wordt op homepage hero en op productpagina's getoond.
 */
export function ThreeOptionCTA({
  variant = "default",
  showHelperText = true,
  className,
}: ThreeOptionCTAProps) {
  const isHero = variant === "hero";

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
        <Button variant="accent" size="lg" asChild className="shadow-lg">
          <LocalizedLink to="/verzekeringen">
            <Zap className="h-5 w-5" />
            Direct afsluiten
            <ArrowRight className="h-5 w-5" />
          </LocalizedLink>
        </Button>

        <Button
          variant={isHero ? "heroOutline" : "outline"}
          size="lg"
          asChild
        >
          <LocalizedLink to="/offerte">
            <FileText className="h-5 w-5" />
            Offerte aanvragen
          </LocalizedLink>
        </Button>

        <Button
          variant="ghost"
          size="lg"
          asChild
          className={isHero ? "text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" : ""}
        >
          <LocalizedLink to="/contact">
            <MessageCircle className="h-5 w-5" />
            Persoonlijk gesprek
          </LocalizedLink>
        </Button>
      </div>

      {showHelperText && (
        <p
          className={cn(
            "text-sm text-center mt-4",
            isHero ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          Niet zeker wat je zoekt? Bel ons direct:{" "}
          <a
            href="tel:+31204573077"
            className={cn(
              "font-medium hover:underline underline-offset-2",
              isHero ? "text-primary-foreground" : "text-foreground",
            )}
          >
            020 - 457 3077
          </a>
        </p>
      )}
    </div>
  );
}
