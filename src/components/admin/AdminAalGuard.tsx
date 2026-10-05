import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Poort = "check" | "geen_sessie" | "verify" | "enroll" | "ok";

/**
 * Centrale toegangspoort voor alle /admin/*-routes (behalve login en wachtwoordpagina's).
 * Rendert niets van de admin zolang de sessie niet aal2 is: aal1 met factor -> code-scherm,
 * aal1 zonder factor (teamlid) -> MFA-instelflow. Herbeoordeelt bij elke auth-gebeurtenis.
 */
export function AdminAalGuard() {
  const location = useLocation();
  const { isLoading, isTeamMember } = useAuth();
  const [poort, setPoort] = useState<Poort>("check");

  useEffect(() => {
    let actief = true;
    const bepaal = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (actief) setPoort("geen_sessie"); return; }
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!actief) return;
      if (error || !data) { setPoort("verify"); return; }
      if (data.currentLevel === "aal2") { setPoort("ok"); return; }
      if (data.nextLevel === "aal2") { setPoort("verify"); return; }
      setPoort("enroll");
    };
    bepaal();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => { if (actief) bepaal(); }, 0);
    });
    return () => { actief = false; subscription.unsubscribe(); };
  }, []);

  const next = encodeURIComponent(location.pathname + location.search + location.hash);

  if (poort === "check" || (poort === "enroll" && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (poort === "geen_sessie") return <Navigate to={`/admin/login?next=${next}`} replace />;
  if (poort === "verify") return <Navigate to={`/admin/login?stap=code&next=${next}`} replace />;
  // Geen factor: teamleden moeten MFA instellen; overige gebruikers krijgen "geen toegang" van AdminLayout.
  if (poort === "enroll" && isTeamMember) return <Navigate to={`/admin/login?stap=instellen&next=${next}`} replace />;
  return <Outlet />;
}
