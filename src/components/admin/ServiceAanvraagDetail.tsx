import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import { Link } from "react-router-dom";
import { KoppelZoeker } from "@/components/admin/KoppelZoeker";
import { PortaltoegangStappen } from "@/components/admin/PortaltoegangStappen";
const KOPPELING_LABEL: Record<string, string> = { zeker: "Automatisch zeker", voorstel: "Voorstel", niet_gekoppeld: "Niet gekoppeld" };

export type ServiceAanvraag = {
  id: string;
  type: "certificaat" | "pauzeren" | "documenten" | "opzeggen" | "portaltoegang" | "factuur_opvragen";
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string;
  polisnummer: string;
  status: string;
  details: Record<string, any> | null;
  notities: string | null;
  behandeld_door: string | null;
  behandeld_op: string | null;
  created_at: string;
  geverifieerd?: boolean;
  onderneming_id?: string | null;
  koppeling_status?: string | null;
  opzegging_verwerkt_op?: string | null;
};

/** Debiteurnummer uit het formulierveld of uit vrije tekst ("Debiteurnummer 2006364"). */
export function debiteurnummerVan(a: Pick<ServiceAanvraag, "polisnummer" | "details">): string | null {
  const d = a.details?.debiteurnummer ?? a.details?.relatiecode;
  if (d) return String(d);
  const tekst = [a.polisnummer, a.details?.toelichting, a.details?.opmerkingen].filter(Boolean).join(" ");
  return tekst.match(/debiteur(?:en)?(?:nummer|nr)?\.?\s*:?\s*(\d{4,})/i)?.[1] ?? null;
}

export const SERVICE_TYPE_COLOR: Record<string, string> = {
  certificaat: "bg-blue-100 text-blue-800",
  pauzeren: "bg-amber-100 text-amber-800",
  documenten: "bg-emerald-100 text-emerald-800",
  opzeggen: "bg-red-100 text-red-800",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  certificaat: "Polis",
  pauzeren: "Pauzeren",
  documenten: "Documenten",
  opzeggen: "Opzeggen",
  portaltoegang: "Portaltoegang",
  factuur_opvragen: "Factuur opvragen",
};

export const SERVICE_STATUS_COLOR: Record<string, string> = {
  nieuw: "bg-red-100 text-red-800",
  in_behandeling: "bg-amber-100 text-amber-800",
  afgerond: "bg-emerald-100 text-emerald-800",
  gearchiveerd: "bg-gray-100 text-gray-700",
};

interface Props {
  aanvraag: ServiceAanvraag;
  onSaveNotes: (id: string, notities: string) => void;
  onMarkAfgerond: (id: string) => void;
  onResend?: (aanvraag: ServiceAanvraag) => void;
  onGekoppeld?: () => void;
}

export function ServiceAanvraagDetailHeader({ aanvraag }: { aanvraag: ServiceAanvraag }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2 pr-8">
      <Badge className={SERVICE_TYPE_COLOR[aanvraag.type]}>
        {SERVICE_TYPE_LABEL[aanvraag.type] ?? aanvraag.type}
      </Badge>
      {aanvraag.voornaam} {aanvraag.achternaam}
    </span>
  );
}

export function ServiceAanvraagDetail({ aanvraag, onSaveNotes, onMarkAfgerond, onResend, onGekoppeld }: Props) {
  const d = aanvraag.details ?? {};
  const veld = (label: string, waarde: any) => (
    <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{waarde === null || waarde === undefined || waarde === "" ? "—" : String(waarde)}</dd></div>
  );
  const opzeg = aanvraag.type === "opzeggen";
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md border border-border p-3">
        <p className="mb-2 font-medium">Formuliervelden</p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {veld("Naam", `${aanvraag.voornaam ?? ""} ${aanvraag.achternaam ?? ""}`.trim())}
          {veld("Bedrijfsnaam", d.bedrijfsnaam)}
          {veld("E-mail", aanvraag.email)}
          {veld("Telefoon", aanvraag.telefoon)}
          {veld("Polisnummer / BAV-nummer", aanvraag.polisnummer)}
          {veld("Debiteurnummer (Exact-relatiecode)", debiteurnummerVan(aanvraag))}
          {opzeg && veld("Opzegdatum", d.opzegdatum ? formatDateNL(d.opzegdatum) : null)}
          {opzeg && veld("Reden", d.reden)}
          {veld("Opmerkingen", d.toelichting ?? d.opmerkingen)}
          {veld("Ontvangen op", formatDateNL(aanvraag.created_at))}
          {opzeg && veld("Koppeling", KOPPELING_LABEL[aanvraag.koppeling_status ?? "niet_gekoppeld"] ?? aanvraag.koppeling_status)}
          {aanvraag.onderneming_id && <div className="min-w-0"><dt className="text-xs text-muted-foreground">Gekoppelde klant</dt><dd><Link to={`/admin/klanten/${aanvraag.onderneming_id}`} className="text-primary hover:underline">Klant openen</Link></dd></div>}
        </dl>
      </div>
      {opzeg && !aanvraag.opzegging_verwerkt_op && (
        <div className="rounded-md border border-border p-3">
          <p className="mb-2 font-medium">Koppelen aan klant</p>
          <KoppelZoeker aanvraagId={aanvraag.id} kanKoppelen onGekoppeld={onGekoppeld} />
        </div>
      )}
      {aanvraag.type === "portaltoegang" && <PortaltoegangStappen aanvraag={aanvraag} onGewijzigd={onGekoppeld} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-muted-foreground">Datum</div>
          <div>{formatDateNL(aanvraag.created_at)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Status</div>
          <div className="flex flex-wrap gap-1">
            <Badge className={SERVICE_STATUS_COLOR[aanvraag.status]}>{aanvraag.status}</Badge>
            <Badge variant={aanvraag.geverifieerd ? "secondary" : "outline"}>{aanvraag.geverifieerd ? "Geverifieerd" : "Ongeverifieerd"}</Badge>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Email</div>
          <div className="break-all">{aanvraag.email}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Telefoon</div>
          <div>{aanvraag.telefoon}</div>
        </div>
        <div className="col-span-2">
          <div className="text-muted-foreground">BAV-nummer (opgegeven door klant)</div>
          <div className="font-mono">{aanvraag.polisnummer}</div>
        </div>
      </div>
      {aanvraag.details && Object.keys(aanvraag.details).length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1">Details</div>
          <ul className="space-y-1 break-words rounded bg-muted/50 p-3">
            {Object.entries(aanvraag.details).map(([k, v]) => (
              <li key={k}>
                <span className="font-medium">{k}:</span>{" "}
                {Array.isArray(v) ? v.join(", ") : String(v ?? "-")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <div className="text-muted-foreground mb-1">Notities</div>
        <Textarea
          defaultValue={aanvraag.notities ?? ""}
          rows={3}
          onBlur={(e) => onSaveNotes(aanvraag.id, e.target.value)}
        />
      </div>
      {aanvraag.type !== "portaltoegang" && <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        {onResend && <Button onClick={() => onResend(aanvraag)} variant="outline" className="min-h-10 w-full sm:w-auto">
          <Mail className="h-4 w-4 mr-2" />
          Stuur notificatie opnieuw
        </Button>}
        <Button onClick={() => onMarkAfgerond(aanvraag.id)} variant="default" className="min-h-10 w-full sm:w-auto">
          Markeer als afgerond
        </Button>
      </div>}
    </div>
  );
}
