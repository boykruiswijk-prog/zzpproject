import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { MAATWERK_KNOP, MAATWERK_LABEL, MAATWERK_TEKST, MAATWERK_TITEL, heeftMaatwerkVlag } from "@/lib/maatwerk";

export function MaatwerkMelding({ open, onSluit }: { open: boolean; onSluit: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onSluit()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{MAATWERK_TITEL}</AlertDialogTitle>
          <AlertDialogDescription>{MAATWERK_TEKST}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onSluit}>{MAATWERK_KNOP}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MaatwerkLabel({ extraData }: { extraData: unknown }) {
  if (!heeftMaatwerkVlag(extraData)) return null;
  return <Badge className="border-oranje bg-oranje text-oranje-foreground hover:bg-oranje">{MAATWERK_LABEL}</Badge>;
}
