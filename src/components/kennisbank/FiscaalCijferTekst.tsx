/**
 * Toont een fiscaal cijfer uit src/data/fiscaleCijfers.ts met het bijbehorende
 * belastingjaar. In artikeltekst gebruik je het token {{fiscaal:<sleutel>}};
 * in JSX gebruik je deze component.
 */

import { formatFiscaleWaarde, getFiscaalCijfer } from "@/data/fiscaleCijfers";

interface FiscaalCijferTekstProps {
  sleutel: string;
  /** Jaartal achter de waarde tonen. Standaard aan. */
  metJaar?: boolean;
  /** Label ervoor tonen, bijv. "Zelfstandigenaftrek: € 1.200 (2026)". */
  metLabel?: boolean;
  className?: string;
}

export function FiscaalCijferTekst({
  sleutel,
  metJaar = true,
  metLabel = false,
  className,
}: FiscaalCijferTekstProps) {
  const cijfer = getFiscaalCijfer(sleutel);
  if (!cijfer) return <span className={className}>{`{{fiscaal:${sleutel}}}`}</span>;

  const waarde = formatFiscaleWaarde(cijfer.waarde, cijfer.eenheid);
  return (
    <span className={className}>
      {metLabel && `${cijfer.label}: `}
      <span className="font-semibold">{waarde}</span>
      {metJaar && (
        <>
          {" "}
          <span className="text-muted-foreground">({cijfer.belastingjaar})</span>
        </>
      )}
    </span>
  );
}
