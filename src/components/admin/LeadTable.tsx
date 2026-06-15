import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeads, useUpdateLead, useDeleteLead } from "@/hooks/useLeads";
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

const statusLabels: Record<LeadStatus, string> = {
  nieuw: "Nieuw",
  in_behandeling: "In behandeling",
  afspraak_gepland: "Afspraak gepland",
  offerte_verstuurd: "Offerte verstuurd",
  klant: "Klant",
  afgewezen: "Afgewezen",
};

const statusColors: Record<LeadStatus, string> = {
  nieuw: "bg-blue-100 text-blue-800",
  in_behandeling: "bg-yellow-100 text-yellow-800",
  afspraak_gepland: "bg-purple-100 text-purple-800",
  offerte_verstuurd: "bg-orange-100 text-orange-800",
  klant: "bg-green-100 text-green-800",
  afgewezen: "bg-red-100 text-red-800",
};

export function LeadTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { user } = useAuth();
  const canDelete = user?.email === AUTHORIZED_DELETE_EMAIL;

  const { data: leads, isLoading, isFetching } = useLeads({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
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
            placeholder="Zoeken op naam, email of bedrijf..."
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
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Naam</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Verzekering</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead className="w-20">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                  </TableCell>
                  <TableCell>{lead.email}</TableCell>
                  <TableCell>
                    {lead.verzekering_type ? (
                      <Badge variant="outline">{lead.verzekering_type}</Badge>
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
                          className={statusColors[lead.status]}
                          variant="secondary"
                        >
                          {statusLabels[lead.status]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusLabels).map(([value, label]) => (
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
                      <Button variant="ghost" size="icon" asChild>
                        <Link to={`/admin/leads/${lead.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
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
