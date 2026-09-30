import { MapPin } from "lucide-react";
import type { PdokAdres } from "@/hooks/usePdokAdres";

export function AdresGevonden({ adres }: { adres: PdokAdres | null }) {
  if (!adres) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      Adres gevonden: {adres.straat} {adres.huisnummer}, {adres.plaats}
    </p>
  );
}
