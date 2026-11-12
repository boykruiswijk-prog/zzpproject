import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeadNotes, useCreateLeadNote, useDeleteLeadNote } from "@/hooks/useLeadNotes";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, Calendar, Trash2, Loader2, Activity } from "lucide-react";
import { formatDateTimeNL } from "@/lib/dateFormat";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { bouwDraden, filterDraden, heeftNieuweReactie, type NotitieFilter } from "@/lib/notitieDraad";
import { ReactieInvoer, ReactieLijst, FilterKeuze } from "@/components/admin/NotitieReacties";

type NoteType = Database["public"]["Enums"]["note_type"];

const noteTypeLabels: Record<NoteType, string> = {
  notitie: "Notitie",
  follow_up: "Follow-up",
  telefoongesprek: "Telefoongesprek",
};

const noteTypeIcons: Record<NoteType, typeof MessageSquare> = {
  notitie: MessageSquare,
  follow_up: Calendar,
  telefoongesprek: Phone,
};

interface LeadNotesProps {
  leadId: string;
}

export function LeadNotes({ leadId }: LeadNotesProps) {
  const { user } = useAuth();
  const { data: notes, isLoading, refetch } = useLeadNotes(leadId);
  const { data: activiteiten, isLoading: activiteitenLoading } = useQuery({
    queryKey: ["lead-activiteiten", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activiteiten_log")
        .select("id, actie_type, omschrijving, uitgevoerd_door_naam, aangemaakt_op")
        .eq("lead_id", leadId)
        .order("aangemaakt_op", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!leadId,
  });
  const uids = Array.from(new Set((notes ?? []).map((n) => n.user_id))).sort();
  const { data: namen } = useQuery({
    queryKey: ["lead-notes-namen", uids.join(",")],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", uids);
      return new Map((data ?? []).map((p: any) => [p.id as string, (p.full_name as string) || "teamlid"]));
    },
    enabled: uids.length > 0,
  });
  const createNote = useCreateLeadNote();
  const deleteNote = useDeleteLeadNote();

  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<NoteType>("notitie");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    await createNote.mutateAsync({
      lead_id: leadId,
      user_id: user.id,
      content: content.trim(),
      type: noteType,
    });

    setContent("");
    setNoteType("notitie");
  };

  const handleReactie = async (parentId: string, tekst: string) => {
    if (!user) return false;
    try {
      await createNote.mutateAsync({ lead_id: leadId, user_id: user.id, content: tekst, type: "notitie", parent_id: parentId } as any);
      toast.success("Reactie geplaatst");
      return true;
    } catch (e: any) { toast.error(e?.message ?? "Plaatsen mislukt"); return false; }
  };

  const handleIntrekken = async (id: string) => {
    const reden = window.prompt("Reden van intrekken (de reactie blijft bewaard):");
    if (!reden) return;
    const { error } = await supabase.rpc("lead_notitie_intrekken" as any, { _id: id, _reden: reden } as any);
    if (error) toast.error(error.message); else { toast.success("Reactie ingetrokken"); refetch(); }
  };

  const handleDelete = async (noteId: string) => {
    if (confirm("Weet je zeker dat je deze notitie wilt verwijderen?")) {
      await deleteNote.mutateAsync({ id: noteId, leadId });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notities & activiteit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add note form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Voeg een notitie, follow-up of gespreksverslag toe..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex gap-4">
            <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(noteTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!content.trim() || createNote.isPending}>
              {createNote.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Toevoegen
            </Button>
          </div>
        </form>

        {/* Timeline: notes + activities */}
        <div className="border-t pt-6">
          <TimelineList
            notes={notes ?? []}
            activiteiten={activiteiten ?? []}
            isLoading={isLoading || activiteitenLoading}
            currentUserId={user?.id}
            onDelete={handleDelete}
            onReactie={handleReactie}
            onIntrekken={handleIntrekken}
            namen={namen}
          />
        </div>
      </CardContent>
    </Card>
  );
}

type NoteRow = { id: string; type: NoteType; content: string; created_at: string; user_id: string; parent_id?: string | null; ingetrokken_op?: string | null; intrek_reden?: string | null };
type ActRow = { id: string; actie_type: string; omschrijving: string; uitgevoerd_door_naam: string | null; aangemaakt_op: string };
type Rij = { id: string; parent_id: string | null; datum: string; auteur_id: string | null; systeem: boolean; note?: NoteRow; act?: ActRow };

interface TimelineListProps {
  notes: NoteRow[];
  activiteiten: ActRow[];
  isLoading: boolean;
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
  onReactie: (parentId: string, tekst: string) => Promise<boolean>;
  onIntrekken: (id: string) => void;
  namen?: Map<string, string>;
}

function TimelineList({ notes, activiteiten, isLoading, currentUserId, onDelete, onReactie, onIntrekken, namen }: TimelineListProps) {
  const [filter, setFilter] = useState<NotitieFilter>("alles");
  const draden = useMemo(() => {
    const rijen: Rij[] = [
      ...notes.map((n) => ({ id: `note-${n.id}`, parent_id: n.parent_id ? `note-${n.parent_id}` : null, datum: n.created_at, auteur_id: n.user_id, systeem: false, note: n })),
      ...activiteiten.map((a) => ({ id: `act-${a.id}`, parent_id: null, datum: a.aangemaakt_op, auteur_id: null, systeem: true, act: a })),
    ];
    return bouwDraden(rijen);
  }, [notes, activiteiten]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (draden.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">Nog geen notities of activiteiten</p>;
  }

  const renderNote = (note: NoteRow, isReactie: boolean, nieuw: boolean, aantalReacties: number) => {
    const Icon = noteTypeIcons[note.type];
    const ingetrokken = !!note.ingetrokken_op;
    return (
      <div className={`flex gap-4 rounded-lg bg-secondary/50 ${isReactie ? "p-2" : "p-4"} ${ingetrokken ? "opacity-60" : ""}`}>
        {!isReactie && (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {!isReactie && <Badge variant="outline" className="text-xs">Notitie · {noteTypeLabels[note.type]}</Badge>}
            <span className="text-xs font-medium">{namen?.get(note.user_id) ?? "teamlid"}</span>
            <span className="text-xs text-muted-foreground">{formatDateTimeNL(note.created_at)}</span>
            {nieuw && <Badge variant="outline" className="text-xs border-primary text-primary">nieuwe reactie</Badge>}
            {ingetrokken && <Badge variant="outline" className="text-xs">ingetrokken: {note.intrek_reden}</Badge>}
          </div>
          <p className={`text-sm whitespace-pre-wrap ${ingetrokken ? "line-through" : ""}`}>{note.content}</p>
          {isReactie && !ingetrokken && note.user_id === currentUserId && (
            <button type="button" className="mt-1 text-xs text-muted-foreground hover:text-primary" onClick={() => onIntrekken(note.id)}>intrekken</button>
          )}
          {!isReactie && <div className="mt-2"><ReactieInvoer onPlaatsen={(t) => onReactie(note.id, t)} /></div>}
        </div>
        {!isReactie && aantalReacties === 0 && note.user_id === currentUserId && (
          <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={() => onDelete(note.id)} aria-label="Notitie verwijderen">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><FilterKeuze waarde={filter} onChange={setFilter} /></div>
      {filterDraden(draden, filter).map((d) => {
        if (d.hoofd.note) {
          return (
            <div key={d.hoofd.id}>
              {renderNote(d.hoofd.note, false, heeftNieuweReactie(d, currentUserId), d.reacties.length)}
              <ReactieLijst reacties={d.reacties} render={(r) => <div key={r.id}>{r.note && renderNote(r.note, true, false, 0)}</div>} />
            </div>
          );
        }
        const act = d.hoofd.act!;
        return (
          <div key={d.hoofd.id} className="flex gap-3 p-3 rounded-lg border border-dashed bg-muted/30 text-muted-foreground">
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Activity className="h-3 w-3" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">Activiteit · {act.actie_type}</Badge>
                <span className="text-xs">{formatDateTimeNL(act.aangemaakt_op)}</span>
                {act.uitgevoerd_door_naam && <span className="text-xs">· {act.uitgevoerd_door_naam}</span>}
              </div>
              <p className="text-xs whitespace-pre-wrap">{act.omschrijving}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
