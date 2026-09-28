import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export function ExactKoppelingAlarm() {
  const [fout, setFout] = useState<string | null>(null);
  useEffect(() => {
    // deno-lint-ignore no-explicit-any
    (supabase.rpc as any)("get_exact_koppeling_fout").then(({ data }: { data: string | null }) => setFout(data ?? null));
  }, []);
  if (!fout) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        Exact-koppeling werkt niet: {fout}. Facturen en machtigingen gaan niet naar Exact.{" "}
        <Link to="/admin/exact-koppeling" className="font-semibold underline">Naar Exact-koppeling</Link>
      </AlertDescription>
    </Alert>
  );
}
