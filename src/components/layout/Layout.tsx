import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { StickyContactBar } from "@/components/shared/StickyContactBar";
import { StickyMobileCTA } from "@/components/shared/StickyMobileCTA";
import { ExitIntentPopup } from "@/components/shared/ExitIntentPopup";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CookieConsent />
      <StickyMobileCTA />
      <StickyContactBar />
      <ExitIntentPopup />
    </div>
  );
}
