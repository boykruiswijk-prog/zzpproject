import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const MEDEWERKERS_UITLEG =
  "Heb je een bv? Dan tel je jezelf ook mee. Werk je alleen in je bv, vul dan 1 in. Heb je daarnaast mensen in dienst, tel die erbij op.";

/** Klein i-icoon naast het label "Aantal medewerkers": klik, tik, hover en toetsenbord. */
export function MedewerkersUitleg() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Uitleg aantal medewerkers"
          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-[min(18rem,calc(100vw-24px))] text-sm"
      >
        {MEDEWERKERS_UITLEG}
      </PopoverContent>
    </Popover>
  );
}
