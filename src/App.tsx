import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
    <Route path="collectief-ledenorganisaties" element={<CollectiefLedenorganisaties />} />
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
            
            {/* Language-prefixed routes */}
            <Route path="/:lang">{publicRoutes}</Route>

            {/* Admin routes (no i18n) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/leads/:id" element={<AdminLeadDetail />} />
            <Route path="/admin/team" element={<AdminTeam />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
