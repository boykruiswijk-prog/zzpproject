import { useLocation, Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { trackPhone } from "@/lib/tracking";

const HIDDEN_PATHS = ["/contact", "/verzekeringen"];

export function StickyMobileCTA() {
  const location = useLocation();
  const path = location.pathname.replace(/\/(nl|en|de|fr)(?=\/|$)/, "") || "/";

  // Hide on BAV wizard pages (homepage + verzekeringen), contact page, and admin
  if (path === "/" || HIDDEN_PATHS.includes(path) || path.startsWith("/admin")) {
    return null;
  }

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex text-white font-semibold"
      style={{ height: "56px" }}
    >
      <a
        href="tel:0204573077"
        onClick={() => trackPhone()}
        className="flex-1 flex items-center justify-center gap-2 text-center"
        style={{ backgroundColor: "#1f1f1f" }}
      >
        <Phone className="h-4 w-4" />
        020 - 457 3077
      </a>
      <Link
        to="/contact"
        className="flex-1 flex items-center justify-center text-center"
        style={{ backgroundColor: "#E53E2F" }}
      >
        Vrijblijvend gesprek →
      </Link>
    </div>
  );
}
