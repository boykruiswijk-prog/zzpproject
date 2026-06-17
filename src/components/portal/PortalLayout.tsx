import { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, FolderOpen, Receipt, LogOut, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

const navItems = [
  { to: "/portal", label: "Overzicht", icon: LayoutDashboard, end: true },
  { to: "/portal/polis", label: "Polis", icon: FileText },
  { to: "/portal/documenten", label: "Documenten", icon: FolderOpen },
  { to: "/portal/facturen", label: "Facturen", icon: Receipt },
];

export function PortalLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = usePortalAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? "bg-accent text-accent-foreground font-medium"
                : "text-foreground/70 hover:bg-accent/50 hover:text-foreground"
            }`
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <div className="mt-8">
                  <NavList onNavigate={() => setOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <Link to="/portal" className="font-semibold">
              ZP Zaken | Klantportaal
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Uitloggen
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-[220px_1fr] gap-8">
          <aside className="hidden lg:block">
            <NavList />
          </aside>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
