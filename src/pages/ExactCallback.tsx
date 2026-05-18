// Redirect page voor /api/exact/callback — Exact OAuth redirect URI.
// Stuurt de browser door naar de Supabase edge function met
// behoud van alle query parameters.
import { useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ExactCallback() {
  useEffect(() => {
    const qs = window.location.search;
    window.location.replace(
      `${SUPABASE_URL}/functions/v1/exact-oauth-callback${qs}`
    );
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Bezig met verwerken van Exact autorisatie…</p>
    </div>
  );
}
