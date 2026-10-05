import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AdminSidebar } from "./AdminSidebar";
import { MFAEnroll } from "./MFAEnroll";
import { MFAVerify } from "./MFAVerify";
import { Loader2 } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isLoading, isTeamMember, user, isAal2 } = useAuth();
  const [mfaState, setMfaState] = useState<"check" | "enroll" | "verify" | "ok">("check");

  useEffect(() => {
    if (!user || !isTeamMember || isAal2) { setMfaState(user && isTeamMember && isAal2 ? "ok" : "check"); return; }
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp.filter((f) => f.status === "verified") ?? [];
      setMfaState(verified.length > 0 ? "verify" : "enroll");
    });
  }, [user, isTeamMember, isAal2]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (isTeamMember && !isAal2) {
    if (mfaState === "check") {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        {mfaState === "verify" ? (
          <MFAVerify onVerified={() => window.location.reload()} onCancel={() => supabase.auth.signOut()} />
        ) : (
          <MFAEnroll onEnrolled={() => window.location.reload()} />
        )}
      </div>
    );
  }

  if (!isTeamMember) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Geen toegang</h1>
          <p className="text-muted-foreground">
            Je hebt geen toegang tot het admin dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell flex min-h-screen w-full overflow-x-hidden bg-background">
      <AdminSidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden pt-14 lg:pt-0">
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
