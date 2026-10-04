import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type AllowedRole = "admin" | "supervisor" | "verzekering" | "marketing";

interface RoleGuardProps {
  allow: AllowedRole[];
  children: ReactNode;
}

/**
 * Beperkt een admin-route tot bepaalde functiegroepen.
 * Supervisor heeft altijd toegang (ziet alles).
 */
export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { isLoading, isTeamMember, isAdmin, isSupervisor, isVerzekering, isMarketing, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;
  if (!isTeamMember) return <Navigate to="/admin/login" replace />;

  const adminOnly = allow.length === 1 && allow[0] === "admin";
  const roleMatches = adminOnly ? isAdmin :
    isSupervisor ||
    (allow.includes("verzekering") && isVerzekering) ||
    (allow.includes("marketing") && isMarketing);

  if (!roleMatches) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
