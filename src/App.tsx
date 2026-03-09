import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Diensten from "./pages/Diensten";
import Verzekeringen from "./pages/Verzekeringen";
import VoorWie from "./pages/VoorWie";
import ZoWerkenWij from "./pages/ZoWerkenWij";
import Kennis from "./pages/Kennis";
import Kennisbank from "./pages/Kennisbank";
import ArtikelDetail from "./pages/ArtikelDetail";
import OverOns from "./pages/OverOns";
import Partners from "./pages/Partners";
import Historie from "./pages/Historie";
import Contact from "./pages/Contact";
import Cookies from "./pages/Cookies";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import CollectieveInkoop from "./pages/CollectieveInkoop";
import CollectiefLedenorganisaties from "./pages/CollectiefLedenorganisaties";
import SocialMedia from "./pages/SocialMedia";
import CreditControl from "./pages/CreditControl";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminLeads from "./pages/admin/Leads";
import AdminLeadDetail from "./pages/admin/LeadDetail";
import AdminTeam from "./pages/admin/Team";
import AdminDbaChecks from "./pages/admin/DbaChecks";
import DbaCheckNew from "./pages/admin/DbaCheckNew";
import DbaCheckDetail from "./pages/admin/DbaCheckDetail";
import DbaCheckBulk from "./pages/admin/DbaCheckBulk";
import DbaCheckBatchDetail from "./pages/admin/DbaCheckBatchDetail";
import DbaVerificatie from "./pages/DbaVerificatie";

/** Old WordPress URLs indexed by Google → redirect to new routes */
const wpRedirects: Array<[string, string]> = [
  ["belastingen", "/kennisbank"],
  ["ondernemen", "/kennisbank"],
  ["financien", "/kennisbank"],
  ["verzekeringen-info", "/kennisbank"],
  ["movir", "/verzekeringen"],
  ["wijzijnaov", "/verzekeringen"],
  ["aov-via-centraalbeheer", "/verzekeringen"],
  ["sharepeople", "/partners"],
  ["eherkenning", "/kennisbank"],
  ["verplichte-aov-voor-zzp", "/kennisbank/aov-arbeidsongeschiktheidsverzekering"],
  ["nieuwe-regels-zzp", "/kennisbank/nieuwe-regels-zzp-2025"],
  ["hoeveel-opdrachtgevers-zzp", "/kennisbank"],
  ["alles-over-een-zzp-factuur", "/kennisbank"],
  ["inschrijven-bij-de-kamer-van-koophandel", "/kennisbank"],
  ["zzp-administratie-en-boekhouding", "/diensten"],
  ["hoe-bereken-ik-bijtelling-als-zzper", "/kennisbank"],
  ["is-eten-en-drinken-aftrekbaar-als-zzp-er", "/kennisbank"],
  ["winkel", "/"],
  ["shop", "/"],
  ["product", "/"],
  ["mijn-account", "/"],
  ["my-account", "/"],
];

const queryClient = new QueryClient();

const publicRoutes = (
  <>
    <Route index element={<Index />} />
    <Route path="diensten" element={<Diensten />} />
    <Route path="verzekeringen" element={<Verzekeringen />} />
    <Route path="voor-wie" element={<VoorWie />} />
    <Route path="zo-werken-wij" element={<ZoWerkenWij />} />
    <Route path="kennis" element={<Kennis />} />
    <Route path="kennisbank" element={<Kennisbank />} />
    <Route path="kennisbank/:slug" element={<ArtikelDetail />} />
    <Route path="over-ons" element={<OverOns />} />
    <Route path="partners" element={<Partners />} />
    <Route path="historie" element={<Historie />} />
    <Route path="contact" element={<Contact />} />
    <Route path="cookies" element={<Cookies />} />
    <Route path="faq" element={<FAQ />} />
    <Route path="collectieve-inkoop" element={<CollectieveInkoop />} />
    {/* TODO: Re-enable collectief-ledenorganisaties route when ready to go live */}
    {/* <Route path="collectief-ledenorganisaties" element={<CollectiefLedenorganisaties />} /> */}
    <Route path="social-media" element={<SocialMedia />} />
    <Route path="creditcontrol" element={<CreditControl />} />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Default (NL) routes */}
            <Route path="/">{publicRoutes}</Route>

            {/* WordPress legacy redirects — MUST come before /:lang */}
            {wpRedirects.map(([from, to]) => (
              <Route key={from} path={`/${from}`} element={<Navigate to={to} replace />} />
            ))}
            
            {/* Language-prefixed routes */}
            <Route path="/:lang">{publicRoutes}</Route>

            {/* Admin routes (no i18n) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            <Route path="/admin/dba-checks" element={<AdminDbaChecks />} />
            <Route path="/admin/dba-checks/nieuw" element={<DbaCheckNew />} />
            <Route path="/admin/dba-checks/bulk" element={<DbaCheckBulk />} />
            <Route path="/admin/dba-checks/bulk/:id" element={<DbaCheckBatchDetail />} />
            <Route path="/admin/dba-checks/:id" element={<DbaCheckDetail />} />
            
            {/* Public verification */}
            <Route path="/verificatie/dba/:token" element={<DbaVerificatie />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
