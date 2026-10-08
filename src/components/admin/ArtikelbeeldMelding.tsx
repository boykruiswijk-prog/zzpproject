import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export function ArtikelbeeldMelding() {
  const [melding, setMelding] = useState<string | null>(null);
  useEffect(() => {
    supabase.rpc("get_artikelbeeld_melding").then(({ data }) => setMelding((data as string | null) ?? null));
  }, []);
  if (!melding) return null;
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        AI-artikelillustraties worden geweigerd ({melding}). Nieuwe kennisbankartikelen krijgen automatisch het huisstijlbeeld.
      </AlertDescription>
    </Alert>
  );
}
