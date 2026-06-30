import { Badge } from "@/components/ui/badge";
import { formatDateNL } from "@/lib/dateFormat";

export interface ScreeningAanvraagFull {
  id: string;
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string | null;
  bedrijfsnaam: string | null;
  kvk_nummer: string | null;
  beroep: string | null;
  sector: string | null;
  screening_type: string | null;
  status: string;
  otentica_status: string;
  otentica_flow_id: string | null;
  otentica_rapport_url: string | null;
  notities: string | null;
  aangemeld_op: string;
  bijgewerkt_op: string;
}

export const SCREENING_STATUS_COLOR: Record<string, string> = {
  nieuw: "bg-muted text-muted-foreground",
  verzonden: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-orange-100 text-orange-800",
  afgerond: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

export const SCREENING_PAKKET_LABELS: Record<string, string> = {
  basis: "Basis",
  uitgebreid: "Uitgebreid",
  compleet: "Compleet",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}

export function ScreeningAanvraagDetailHeader({ aanvraag }: { aanvraag: ScreeningAanvraagFull }) {
  return (
    <span className="flex items-center gap-2">
      <Badge variant="outline" className={SCREENING_STATUS_COLOR[aanvraag.status] || ""}>
        {aanvraag.status.replace("_", " ")}
      </Badge>
      {aanvraag.voornaam} {aanvraag.achternaam}
    </span>
  );
}

export function ScreeningAanvraagDetail({ aanvraag }: { aanvraag: ScreeningAanvraagFull }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Aangemeld op" value={formatDateNL(aanvraag.aangemeld_op)} />
        <Field label="Bijgewerkt op" value={formatDateNL(aanvraag.bijgewerkt_op)} />
        <Field label="Naam" value={`${aanvraag.voornaam} ${aanvraag.achternaam}`} />
        <Field label="Email" value={aanvraag.email} />
        <Field label="Telefoon" value={aanvraag.telefoon} />
        <Field label="Bedrijfsnaam" value={aanvraag.bedrijfsnaam} />
        <Field label="KvK-nummer" value={aanvraag.kvk_nummer} />
        <Field label="Beroep" value={aanvraag.beroep} />
        <Field label="Sector" value={aanvraag.sector} />
        <Field
          label="Pakket"
          value={
            aanvraag.screening_type
              ? SCREENING_PAKKET_LABELS[aanvraag.screening_type] ?? aanvraag.screening_type
              : "—"
          }
        />
        <Field
          label="Status"
          value={
            <Badge variant="outline" className={SCREENING_STATUS_COLOR[aanvraag.status] || ""}>
              {aanvraag.status.replace("_", " ")}
            </Badge>
          }
        />
        <Field label="Otentica status" value={aanvraag.otentica_status?.replace("_", " ")} />
        <Field label="Otentica flow ID" value={aanvraag.otentica_flow_id} />
        <Field
          label="Otentica rapport"
          value={
            aanvraag.otentica_rapport_url ? (
              <a
                href={aanvraag.otentica_rapport_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Open rapport
              </a>
            ) : (
              "—"
            )
          }
        />
      </div>
      {aanvraag.notities && (
        <div>
          <div className="text-muted-foreground text-xs mb-1">Notities</div>
          <div className="bg-muted/50 rounded p-3 whitespace-pre-wrap">{aanvraag.notities}</div>
        </div>
      )}
    </div>
  );
}
