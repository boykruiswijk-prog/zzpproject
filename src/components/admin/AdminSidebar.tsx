import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminTakenCount } from "@/hooks/useAdminTaken";
import { Activity, AlertTriangle, BookOpen, Building2, ChevronDown, ChevronLeft, CircleDollarSign, FileText, KeyRound, LayoutDashboard, LogOut, Menu, MessageCircle, Plug, SearchX, Settings, Share2, ShieldCheck, UserCog, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type NavRole = "supervisor" | "verzekering" | "marketing" | "admin";
type NavItem = { to: string; icon: typeof Users; label: string; end?: boolean; badge?: boolean; roles: NavRole[] };
type NavGroup = { label: string; icon: typeof Users; roles: NavRole[]; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "Klanten", icon: Building2, roles: ["supervisor", "verzekering"], items: [
    { to: "/admin/klanten", icon: Building2, label: "Klanten & contracten", roles: ["supervisor", "verzekering"] },
    { to: "/admin/crm", icon: Users, label: "Leads / CRM", badge: true, roles: ["supervisor", "verzekering"] },
    { to: "/admin/service-aanvragen", icon: FileText, label: "Aanvragen & opzeggingen", roles: ["supervisor", "verzekering"] },
    { to: "/admin/screening-aanvragen", icon: ShieldCheck, label: "Screening-aanvragen", roles: ["supervisor", "verzekering"] },
  ]},
  { label: "Facturatie", icon: CircleDollarSign, roles: ["supervisor"], items: [
    { to: "/admin/facturatieplanning", icon: CircleDollarSign, label: "Facturatieplanning", roles: ["supervisor"] },
    { to: "/admin/exact-reconciliatie", icon: Plug, label: "Exact-reconciliatie", roles: ["supervisor"] },
  ]},
  { label: "Website", icon: Share2, roles: ["supervisor", "marketing", "verzekering"], items: [
    { to: "/admin/marketing", icon: Share2, label: "Website & Blog", roles: ["supervisor", "marketing"] },
    { to: "/admin/kennisbank", icon: BookOpen, label: "Kennisbank", roles: ["supervisor", "marketing"] },
    { to: "/admin/kennisbank/actualiteit", icon: AlertTriangle, label: "Verouderingscheck", roles: ["supervisor", "marketing"] },
    { to: "/admin/niet-gevonden", icon: SearchX, label: "Niet-gevonden pagina's", roles: ["supervisor", "marketing"] },
    { to: "/admin/social-media", icon: Share2, label: "Social media", roles: ["supervisor", "marketing"] },
    { to: "/admin/chatgesprekken", icon: MessageCircle, label: "Chatgesprekken", roles: ["supervisor", "verzekering", "marketing"] },
  ]},
  { label: "Instellingen", icon: Settings, roles: ["admin"], items: [
    { to: "/admin/team", icon: UserCog, label: "Team & rechten", roles: ["admin"] },
    { to: "/admin/integraties", icon: Plug, label: "Integraties & Exact", roles: ["admin"] },
    { to: "/admin/interne-meldingen", icon: MessageCircle, label: "Interne meldingen", roles: ["admin"] },
    { to: "/admin/activiteitenlog", icon: Activity, label: "Activiteitenlog", roles: ["admin"] },
    { to: "/admin/wp-import", icon: FileText, label: "WordPress-import", roles: ["admin"] },
  ]},
];

export function AdminSidebar() {
  const { user, signOut, isAdmin, isSupervisor, isVerzekering, isMarketing } = useAuth();
  const { data: takenCount } = useAdminTakenCount();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleAllows = (roles: NavRole[]) => isAdmin || (isSupervisor && roles.includes("supervisor")) || (isVerzekering && roles.includes("verzekering")) || (isMarketing && roles.includes("marketing"));
  const linkClass = ({ isActive }: { isActive: boolean }) => cn("flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground");
  const closeMobile = () => setMobileOpen(false);
  const Navigation = ({ mobile = false }: { mobile?: boolean }) => <>
    <nav className={cn("flex-1 space-y-2", mobile ? "overflow-y-auto px-4 pb-4" : "overflow-y-auto p-4")}>
      <NavLink to="/admin" end onClick={mobile ? closeMobile : undefined} className={linkClass}><LayoutDashboard className="h-5 w-5"/><span>Dashboard</span></NavLink>
      {groups.map(group => {
        const items = group.items.filter(item => roleAllows(item.roles));
        if (!items.length || !roleAllows(group.roles)) return null;
        const active = items.some(item => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));
        return <Collapsible key={group.label} defaultOpen={active || mobile}>
          <CollapsibleTrigger asChild><Button variant="ghost" className="min-h-10 w-full justify-start gap-3 px-3 text-muted-foreground"><group.icon className="h-5 w-5"/><span className="flex-1 text-left">{group.label}</span><ChevronDown className="h-4 w-4 transition-transform [[data-state=open]_&]:rotate-180"/></Button></CollapsibleTrigger>
          <CollapsibleContent className="ml-4 space-y-1 border-l pl-2">{items.map(item => <NavLink key={item.to} to={item.to} onClick={mobile ? closeMobile : undefined} className={linkClass}><item.icon className="h-4 w-4"/><span className="flex-1">{item.label}</span>{item.badge && takenCount ? <Badge variant="destructive">{takenCount}</Badge> : null}</NavLink>)}</CollapsibleContent>
        </Collapsible>;
      })}
      {roleAllows(["supervisor", "verzekering"]) && <NavLink to="/admin/dba-checks" onClick={mobile ? closeMobile : undefined} className={linkClass}><ShieldCheck className="h-5 w-5"/><span>Wet DBA</span></NavLink>}
    </nav>
    <div className="space-y-1 border-t p-4">
      <p className="truncate px-3 pb-1 text-sm font-medium">{user?.email}</p>
      <NavLink to="/admin/wachtwoord-wijzigen" onClick={mobile ? closeMobile : undefined} className={linkClass}><KeyRound className="h-4 w-4"/><span>Wachtwoord wijzigen</span></NavLink>
      <NavLink to="/" onClick={mobile ? closeMobile : undefined} className={linkClass}><ChevronLeft className="h-4 w-4"/><span>Terug naar website</span></NavLink>
      <Button variant="outline" className="min-h-10 w-full justify-start" onClick={async()=>{ await signOut(); navigate("/admin/login"); }}><LogOut className="mr-2 h-4 w-4"/>Uitloggen</Button>
    </div>
  </>;
  return <>
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden"><p className="truncate font-bold text-primary">ZP Zaken Dashboard</p><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="min-h-10 min-w-10" aria-label="Menu openen" aria-expanded={mobileOpen} aria-controls="mobiel-admin-menu"><Menu className="h-5 w-5"/></Button></SheetTrigger><SheetContent id="mobiel-admin-menu" side="top" className="flex max-h-[calc(100dvh-1rem)] flex-col p-0"><SheetHeader className="border-b px-4 py-4 text-left"><SheetTitle className="text-primary">ZP Zaken Dashboard</SheetTitle></SheetHeader><Navigation mobile/></SheetContent></Sheet></header>
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex"><div className="border-b p-6"><h1 className="text-xl font-bold text-primary">ZP Zaken</h1><p className="text-sm text-muted-foreground">Dashboard</p></div><Navigation/></aside>
  </>;
}