import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Loader2 } from "lucide-react";

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = usePortalAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/portal/login?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return <>{children}</>;
}
