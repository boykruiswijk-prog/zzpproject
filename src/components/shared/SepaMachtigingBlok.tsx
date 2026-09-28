import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SITE_CONFIG, ADDRESS_FULL_WITH_COUNTRY } from "@/config/site";
import {
  ELEKTRONISCH_ONDERTEKENEN_ZIN,
  formatDebiteurAdres,
  formatIban,
  machtigingCheckboxLabel,
  machtigingTitel,
  machtigingVelden,
  standaardtekst,
  type DebiteurAdres,
  type MachtigingData,
  type MachtigingType,
} from "@/lib/sepaMachtiging";

export function bouwFrontendMachtiging(input: {
  type: MachtigingType;
  mandaatkenmerk: string;
  reden: string;
  debiteurNaam: string;
  debiteurAdres: DebiteurAdres;
  iban: string;
}): MachtigingData {
  return {
    ...input,
    incassantNaam: SITE_CONFIG.legalName,
    incassantAdres: ADDRESS_FULL_WITH_COUNTRY,
    incassantId: SITE_CONFIG.incassantId,
  };
}

interface Props {
  data: MachtigingData;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  error?: string;
}

/** Afgebakend blok met de SEPA-machtiging (los van de algemene voorwaarden). */
export function SepaMachtigingBlok({ data, checked, onCheckedChange, error }: Props) {
  // Lege invoer toont een streepje; de serverversie wordt uit dezelfde functies opgebouwd.
  const velden = machtigingVelden(data).map(([l, w]) => {
    if (l === "Adres rekeninghouder" && !Object.values(data.debiteurAdres).some((x) => x.trim())) return [l, "-"];
    if (l === "IBAN" && !formatIban(data.iban)) return [l, "-"];
    return [l, w || "-"];
  });
  void formatDebiteurAdres;
  return (
    <section
      aria-labelledby="sepa-machtiging-titel"
      className={cn("rounded-lg border-2 bg-card p-4 md:p-5 space-y-4", error ? "border-destructive" : "border-border")}
    >
      <h4 id="sepa-machtiging-titel" className="text-lg font-semibold">{machtigingTitel(data.type)}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        {velden.map(([l, w]) => (
          <div key={l} className="contents">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className={cn("font-medium break-words", l === "Kenmerk machtiging" && "font-mono text-xs sm:text-sm")}>{w}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm font-medium">{ELEKTRONISCH_ONDERTEKENEN_ZIN}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{standaardtekst(data.type, data.incassantNaam)}</p>
      <div className="flex items-start gap-3 rounded-md bg-secondary p-3">
        <Checkbox id="sepaMachtiging" checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} className="mt-0.5" />
        <Label htmlFor="sepaMachtiging" className="text-sm leading-relaxed cursor-pointer">
          {machtigingCheckboxLabel(data.type, data.incassantNaam)}
        </Label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
