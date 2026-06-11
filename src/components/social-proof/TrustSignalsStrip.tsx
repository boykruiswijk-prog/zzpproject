import { ShieldCheck, Scale, Building2, Star, ExternalLink } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SITE_CONFIG } from "@/config/site";
import { googleReviewsData } from "@/data/googleReviews";

interface Props {
  compact?: boolean;
  kifidNumber?: string;
  className?: string;
}

export function TrustSignalsStrip({
  compact = false,
  kifidNumber,
  className = "",
}: Props) {
  const kifid = kifidNumber || SITE_CONFIG.registrations.kifid || "Aansluitnummer volgt";

  const items = [
    {
      key: "afm",
      icon: ShieldCheck,
      iconClass: "text-accent",
      label: "AFM-geregistreerd",
      sublabel: SITE_CONFIG.registrations.afm,
      tooltip: `ZP Zaken is geregistreerd bij de AFM onder nummer ${SITE_CONFIG.registrations.afm}.`,
    },
    {
      key: "kifid",
      icon: Scale,
      iconClass: "text-accent",
      label: "Kifid-aansluiting",
      sublabel: kifid,
      href: "https://www.kifid.nl/",
    },
    {
      key: "kvk",
      icon: Building2,
      iconClass: "text-accent",
      label: "Kamer van Koophandel",
      sublabel: SITE_CONFIG.registrations.kvk,
      tooltip: `ZP Zaken is ingeschreven in de KvK onder nummer ${SITE_CONFIG.registrations.kvk}.`,
    },
    {
      key: "google",
      icon: Star,
      iconClass: "text-yellow-400 fill-yellow-400",
      label: `${googleReviewsData.averageRating.toFixed(1).replace(".", ",")} sterren op Google`,
      sublabel: "Onafhankelijke beoordelingen",
      href: googleReviewsData.googleReviewsUrl,
    },
  ];

  if (compact) {
    return (
      <div
        className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground ${className}`}
      >
        {items.map((it) => (
          <span key={it.key} className="inline-flex items-center gap-1.5">
            <span className="font-medium text-foreground">{it.label}</span>
            <span>{it.sublabel}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 ${className}`}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const inner = (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-transparent hover:bg-secondary/60 transition-colors cursor-pointer h-full">
            <Icon className={`h-6 w-6 flex-shrink-0 ${it.iconClass}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground leading-tight">
                {it.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {it.sublabel}
              </p>
            </div>
            {it.href && (
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 ml-auto flex-shrink-0" />
            )}
          </div>
        );

        if (it.href) {
          return (
            <a
              key={it.key}
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {inner}
            </a>
          );
        }
        return (
          <Tooltip key={it.key}>
            <TooltipTrigger asChild>
              <div>{inner}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{it.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
