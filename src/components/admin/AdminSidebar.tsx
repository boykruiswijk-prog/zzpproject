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

type NavRole = "supervisor" | "verzekering" | "marketing";

type NavItem = {
  to: string;
  icon: any;
  label: string;
  end?: boolean;
  showTakenBadge?: boolean;
  roles: NavRole[];
};

const navItems: NavItem[] = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true, roles: ["supervisor", "verzekering"] },
  { to: "/admin/crm", icon: Users, label: "CRM", showTakenBadge: true, roles: ["supervisor", "verzekering"] },
  { to: "/admin/activiteiten", icon: Activity, label: "Activiteiten", roles: ["supervisor"] },
  { to: "/admin/dba-checks", icon: ShieldCheck, label: "Wet DBA", roles: ["supervisor", "verzekering"] },
  { to: "/admin/marketing", icon: Share2, label: "Website & Blog", roles: ["supervisor", "marketing"] },
  { to: "/admin/social-media", icon: Share2, label: "Social media", roles: ["supervisor", "marketing"] },
  { to: "/admin/wachtwoord-wijzigen", icon: KeyRound, label: "Wachtwoord wijzigen", roles: ["supervisor", "verzekering", "marketing"] },
  { to: "/admin/integraties", icon: Plug, label: "Integraties", roles: ["supervisor"] },
  { to: "/admin/exact-koppeling", icon: Plug, label: "Exact koppeling", roles: ["supervisor"] },
  { to: "/admin/team", icon: UserCog, label: "Team", roles: ["supervisor"] },
];

export function AdminSidebar() {
  const { user, signOut, isSupervisor, isVerzekering, isMarketing } = useAuth();
  const { data: takenCount } = useAdminTakenCount();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  const roleAllows = (roles: NavRole[]) => {
    if (isSupervisor) return true;
    if (isVerzekering && roles.includes("verzekering")) return true;
    if (isMarketing && roles.includes("marketing")) return true;
    return false;
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
          if (!roleAllows(item.roles)) return null;
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
