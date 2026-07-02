import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminTakenCount } from "@/hooks/useAdminTaken";
import {
  LayoutDashboard,
  Users,
  UserCog,
  LogOut,
  ChevronLeft,
  ShieldCheck,
  Plug,
  KeyRound,
  Share2,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "boy.kruiswijk@zpzaken.nl";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/crm", icon: Users, label: "CRM", showTakenBadge: true },
  { to: "/admin/activiteiten", icon: Activity, label: "Activiteiten" },
  { to: "/admin/dba-checks", icon: ShieldCheck, label: "Wet DBA" },
  { to: "/admin/wachtwoord-wijzigen", icon: KeyRound, label: "Wachtwoord wijzigen" },
  { to: "/admin/social-media", icon: Share2, label: "Social media" },
  { to: "/admin/integraties", icon: Plug, label: "Integraties", superAdminOnly: true },
  { to: "/admin/exact-koppeling", icon: Plug, label: "Exact koppeling", superAdminOnly: true },
  { to: "/admin/team", icon: UserCog, label: "Team", adminOnly: true },
] as Array<{ to: string; icon: any; label: string; end?: boolean; adminOnly?: boolean; superAdminOnly?: boolean; showTakenBadge?: boolean }>;

export function AdminSidebar() {
  const { user, signOut, isAdmin } = useAuth();
  const { data: takenCount } = useAdminTakenCount();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary">ZP Zaken</h1>
        <p className="text-sm text-muted-foreground">Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          if (item.adminOnly && !isAdmin) return null;
          if (item.superAdminOnly && user?.email?.toLowerCase() !== ADMIN_EMAIL) return null;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.label}</span>
              {item.showTakenBadge && takenCount && takenCount > 0 ? (
                <Badge variant="destructive" className="ml-auto h-5 px-2 text-xs">{takenCount}</Badge>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-border space-y-3">
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
          Terug naar website
        </NavLink>
        
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Uitloggen
        </Button>
      </div>
    </aside>
  );
}
