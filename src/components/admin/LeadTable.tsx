import { leadOnderwerp } from "../../../supabase/functions/_shared/leadVelden";
import { AfrondDialoog, magAfronden } from "@/components/admin/LeadAfronden";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadTestSchakelaar } from "@/components/admin/LeadTestSchakelaar";
import { BavNummer } from "@/components/admin/crm/BavNummer";
import { haalBavRijen, kiesBavNummer } from "@/lib/bavNummer";
import { useQuery as useBavQuery } from "@tanstack/react-query";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, statusTitel } from "@/lib/statusLabels";
import { useToonTestrecords } from "@/hooks/useToonTestrecords";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeads, useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
import { formatDateNL } from "@/lib/dateFormat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, Search, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

const AUTHORIZED_DELETE_EMAIL = "boy.kruiswijk@zpzaken.nl";

const statusLabels = LEAD_STATUS_LABELS;
const statusColors = LEAD_STATUS_COLORS;

const pakketLabels: Record<string, string> = {
  "maandelijks": "Maandelijks",
  "jaarlijks": "Jaarlijks",
  "jaarlijks-cyber": "Jaarlijks + Cyber",
};

const pakketColors: Record<string, string> = {
  "maandelijks": "bg-slate-100 text-slate-800 border-slate-300",
  "jaarlijks": "bg-blue-100 text-blue-800 border-blue-300",
  "jaarlijks-cyber": "bg-accent/10 text-accent border-accent/30",
};

export function LeadTable({ soort }: { soort?: "aanvragen" | "leads" } = {}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { user, isSupervisorOrAdmin } = useAuth();
  const { toonTest } = useToonTestrecords();
  const [toonAfgerond, setToonAfgerond] = useState(false);
  const [afronden, setAfronden] = useState<any | null>(null);
  // Verwijderen blijft beperkt tot de gemarkeerde admin-mailbox, EN moet supervisor/admin-rol hebben.
  const canDelete = user?.email === AUTHORIZED_DELETE_EMAIL && isSupervisorOrAdmin;

  const { data: alleLeads, isLoading, isFetching } = useLeads({
    // Alleen cijfers: zoeken op BAV-nummer (in de lijst), anders op naam/e-mail/bedrijf.
    search: search && !/^[\d\s.-]+$/.test(search.trim()) ? search : undefined,
    soort,
    status: statusFilter === "all" ? undefined : statusFilter,
    type: typeFilter === "all" ? undefined : typeFilter,
    toonTest,
    toonAfgerond,
  });

  const leadIds = (alleLeads ?? []).map((l) => l.id);
  const { data: bavRijen } = useBavQuery({
    queryKey: ["bav-leads", leadIds.join(",")],
    queryFn: async () => {
      const uit = [];
      for (let i = 0; i < leadIds.length; i += 150) uit.push(...(await haalBavRijen([], leadIds.slice(i, i + 150))));
      return uit;
    },
    enabled: leadIds.length > 0,
  });
  const bavVoor = (id: string) => {
    const rs = (bavRijen ?? []).filter((r) => r.lead_id === id);
    return rs.length ? kiesBavNummer(rs) : null;
  };
  const bavZoek = search && /^[\d\s.-]+$/.test(search.trim()) ? search.replace(/\D/g, "") : "";
  const leads = bavZoek ? (alleLeads ?? []).filter((l) => (bavVoor(l.id)?.nummer ?? "").replace(/\D/g, "").includes(bavZoek)) : alleLeads;
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    if (newStatus === "afgerond") { setAfronden(leads?.find((l) => l.id === leadId) ?? null); return; }
    const updates: { status: LeadStatus; converted_at?: string | null } = {
      status: newStatus,
    };
    
    if (newStatus === "klant") {
      updates.converted_at = new Date().toISOString();
    } else {
      updates.converted_at = null;
    }

    updateLead.mutate({ id: leadId, updates });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteLead.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Lead succesvol verwijderd");
        setDeleteTarget(null);
      },
      onError: () => {
        toast.error("Fout bij het verwijderen van de lead. Probeer het opnieuw.");
        setDeleteTarget(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          {isFetching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          )}
          <Input
            placeholder="Zoeken op naam, e-mail, bedrijf of BAV-nummer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as LeadStatus | "all")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter op status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex min-h-10 items-center gap-2 text-sm"><Checkbox checked={toonAfgerond} onCheckedChange={(v) => setToonAfgerond(v === true)} />Toon afgerond</label>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value)}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filter op type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            {soort !== "aanvragen" && <SelectItem value="contact">Contactverzoek</SelectItem>}
            {soort !== "leads" && <SelectItem value="verzekering_aanvraag">Verzekeringsaanvraag</SelectItem>}
            {soort !== "aanvragen" && <SelectItem value="offerte-aanvraag">Offerteaanvraag</SelectItem>}
          </SelectContent>
        </Select>
      </div>

      {/* Compacte mobiele lijst */}
      <div className="space-y-3 md:hidden">
        {leads?.length === 0 ? (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">Geen leads gevonden</p>
        ) : leads?.map((lead) => (
          <div key={lead.id} className="min-w-0 space-y-3 rounded-lg border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/admin/leads/${lead.id}`} className="block break-words font-medium hover:text-primary">
                  {lead.voornaam} {lead.achternaam}
                </Link>
                {lead.bedrijfsnaam && <p className="break-words text-sm text-muted-foreground">{lead.bedrijfsnaam}</p>}
                {bavVoor(lead.id) && <BavNummer keuze={bavVoor(lead.id)} />}
              </div>
              <Badge variant="outline">{lead.type === "verzekering_aanvraag" ? "Verzekering" : lead.type === "offerte-aanvraag" ? "Offerte" : "Contact"}</Badge>
            </div>
            <div className="space-y-1 text-sm">
              {lead.email && <a href={`mailto:${lead.email}`} className="block break-all text-primary hover:underline">{lead.email}</a>}
              {lead.telefoon && <a href={`tel:${lead.telefoon.replace(/[^\d+]/g, "")}`} className="block text-primary hover:underline">{lead.telefoon}</a>}
              {leadOnderwerp(lead) && <p className="line-clamp-2 break-words text-muted-foreground">{leadOnderwerp(lead)}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Select value={lead.status} onValueChange={(value) => handleStatusChange(lead.id, value as LeadStatus)}>
                <SelectTrigger className="min-h-10 w-44">
                  <Badge title={statusTitel(lead.status)} className={statusColors[lead.status]} variant="secondary">{statusLabels[lead.status]}</Badge>
                </SelectTrigger>
                <SelectContent>{Object.entries(statusLabels).filter(([value]) => (value !== "afgerond" || lead.status === "afgerond" || magAfronden(lead as any)) && (value !== "offerte_verstuurd" || lead.status === value)).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" asChild><Link to={`/admin/leads/${lead.id}`}><Eye className="h-4 w-4" />Bekijken</Link></Button>
                <LeadTestSchakelaar leadId={lead.id} isTest={!!lead.is_test} naam={`${lead.voornaam} ${lead.achternaam}`} compact />
                {canDelete && <Button variant="ghost" size="icon" className="min-h-10 min-w-10 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Lead ${lead.voornaam} verwijderen`} onClick={() => setDeleteTarget({ id: lead.id, name: `${lead.voornaam} ${lead.achternaam}` })}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Ontvangen {formatDateNL(lead.created_at)}</p>
          </div>
        ))}
      </div>

      {/* Tabel vanaf tablet */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Verzekering</TableHead>
              <TableHead>Pakket</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="w-20">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Geen leads gevonden
                </TableCell>
              </TableRow>
            ) : (
              leads?.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    {lead.voornaam} {lead.achternaam}
                    {lead.bedrijfsnaam && (
                      <span className="block text-sm text-muted-foreground">
                        {lead.bedrijfsnaam}
                      </span>
                    )}
                    {bavVoor(lead.id) && <span className="block"><BavNummer keuze={bavVoor(lead.id)} /></span>}
                    {leadOnderwerp(lead) && (
                      <span className="block max-w-[20rem] truncate text-xs font-normal text-muted-foreground" title={leadOnderwerp(lead)}>
                        {leadOnderwerp(lead)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.type === "offerte-aanvraag" ? (
                      <Badge className="bg-purple-100 text-purple-800 border-purple-300" variant="outline">Offerte</Badge>
                    ) : lead.type === "verzekering_aanvraag" ? (
                      <Badge variant="outline">Verzekering</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-slate-100 text-slate-700">Contact</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[16rem] text-sm">
                    {lead.email && <a href={`mailto:${lead.email}`} className="block break-all text-primary hover:underline">{lead.email}</a>}
                    {lead.telefoon && <a href={`tel:${lead.telefoon.replace(/[^\d+]/g, "")}`} className="block text-primary hover:underline">{lead.telefoon}</a>}
                  </TableCell>
                  <TableCell>
                    {lead.verzekering_type ? (
                      <Badge variant="outline">{lead.verzekering_type}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.gekozen_pakket ? (
                      <Badge variant="outline" className={pakketColors[lead.gekozen_pakket] || ""}>
                        {pakketLabels[lead.gekozen_pakket] || lead.gekozen_pakket}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.status}
                      onValueChange={(value) =>
                        handleStatusChange(lead.id, value as LeadStatus)
                      }
                    >
                      <SelectTrigger className="w-40 h-8">
                        <Badge
                          title={statusTitel(lead.status)}
                          className={statusColors[lead.status]}
                          variant="secondary"
                        >
                          {statusLabels[lead.status]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).filter(([value]) => (value !== "afgerond" || lead.status === "afgerond" || magAfronden(lead as any)) && (value !== "offerte_verstuurd" || lead.status === value)).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {formatDateNL(lead.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Lead ${lead.voornaam} bekijken`} asChild>
                        <Link to={`/admin/leads/${lead.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <LeadTestSchakelaar leadId={lead.id} isTest={!!lead.is_test} naam={`${lead.voornaam} ${lead.achternaam}`} compact />
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setDeleteTarget({
                              id: lead.id,
                              name: `${lead.voornaam} ${lead.achternaam}`,
                            })
                          }
                          aria-label={`Lead ${lead.voornaam} verwijderen`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {afronden && <AfrondDialoog lead={afronden} open onOpenChange={(o) => { if (!o) setAfronden(null); }} />}
      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lead verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {deleteTarget?.name} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
