import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";

export type ServiceAanvraag = {
  id: string;
  type: "certificaat" | "pauzeren" | "documenten" | "opzeggen";
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
};

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
  onResend: (aanvraag: ServiceAanvraag) => void;
}

export function ServiceAanvraagDetailHeader({ aanvraag }: { aanvraag: ServiceAanvraag }) {
  return (
    <span className="flex items-center gap-2">
      <Badge className={SERVICE_TYPE_COLOR[aanvraag.type]}>
        {SERVICE_TYPE_LABEL[aanvraag.type] ?? aanvraag.type}
      </Badge>
      {aanvraag.voornaam} {aanvraag.achternaam}
    </span>
  );
}

export function ServiceAanvraagDetail({ aanvraag, onSaveNotes, onMarkAfgerond, onResend }: Props) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-muted-foreground">Datum</div>
          <div>{formatDateNL(aanvraag.created_at)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Status</div>
          <div>
            <Badge className={SERVICE_STATUS_COLOR[aanvraag.status]}>{aanvraag.status}</Badge>
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Email</div>
          <div>{aanvraag.email}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Telefoon</div>
          <div>{aanvraag.telefoon}</div>
        </div>
        <div className="col-span-2">
          <div className="text-muted-foreground">Polisnummer</div>
          <div className="font-mono">{aanvraag.polisnummer}</div>
        </div>
      </div>
      {aanvraag.details && Object.keys(aanvraag.details).length > 0 && (
        <div>
          <div className="text-muted-foreground mb-1">Details</div>
          <ul className="bg-muted/50 rounded p-3 space-y-1">
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
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onResend(aanvraag)} variant="outline">
          <Mail className="h-4 w-4 mr-2" />
          Stuur notificatie opnieuw
        </Button>
        <Button onClick={() => onMarkAfgerond(aanvraag.id)} variant="default">
          Markeer als afgerond
        </Button>
      </div>
    </div>
  );
}
