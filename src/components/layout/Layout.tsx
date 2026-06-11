import { Header } from "./Header";
import { Footer } from "./Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { StickyContactBar } from "@/components/shared/StickyContactBar";
import { StickyMobileCTA } from "@/components/shared/StickyMobileCTA";
import { ExitIntentPopup } from "@/components/shared/ExitIntentPopup";
import { WhatsAppFloatingButton } from "@/components/common/WhatsAppFloatingButton";
import { SiteSchemaMarkup } from "@/components/social-proof/SiteSchemaMarkup";
import { TrustSignalsStrip } from "@/components/social-proof/TrustSignalsStrip";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteSchemaMarkup />
      <Header />
      <main className="flex-1">{children}</main>
      <section className="bg-secondary/40 border-t border-border/40 py-10">
        <div className="container-wide">
          <TrustSignalsStrip />
        </div>
      </section>
      <Footer />
      <CookieConsent />
      <StickyMobileCTA />
      <StickyContactBar />
      <ExitIntentPopup />
      <WhatsAppFloatingButton />
    </div>
  );
}
