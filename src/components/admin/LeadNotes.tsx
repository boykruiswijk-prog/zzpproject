import { useState } from "react";
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
import { MessageSquare, Phone, Calendar, Trash2, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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
  const { data: notes, isLoading } = useLeadNotes(leadId);
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

        {/* Notes list */}
        <div className="border-t pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes?.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Nog geen notities toegevoegd
            </p>
          ) : (
            <div className="space-y-4">
              {notes?.map((note) => {
                const Icon = noteTypeIcons[note.type];
                return (
                  <div
                    key={note.id}
                    className="flex gap-4 p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {noteTypeLabels[note.type]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleString("nl-NL")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    </div>
                    {note.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-8 w-8"
                        onClick={() => handleDelete(note.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
