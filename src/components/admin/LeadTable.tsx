import { useState } from "react";
import { Link } from "react-router-dom";
import { useLeads, useUpdateLead } from "@/hooks/useLeads";
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
import { Eye, Search, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type LeadStatus = Database["public"]["Enums"]["lead_status"];

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

  const { data: leads, isLoading } = useLeads({
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const updateLead = useUpdateLead();

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                    {new Date(lead.created_at).toLocaleDateString("nl-NL")}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/admin/leads/${lead.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
