import { useLocation, Link } from "react-router-dom";

const HIDDEN_PATHS = ["/contact", "/verzekeringen"];

export function StickyMobileCTA() {
  const location = useLocation();
  const path = location.pathname.replace(/\/(nl|en|de|fr)(?=\/|$)/, "") || "/";

  // Hide on BAV wizard pages (homepage + verzekeringen), contact page, and admin
  if (path === "/" || HIDDEN_PATHS.includes(path) || path.startsWith("/admin")) {
    return null;
  }

  return (
    <Link
      to="/contact"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center text-center font-bold text-white"
      style={{ backgroundColor: "#E53E2F", height: "56px" }}
    >
      Gratis adviesgesprek →
    </Link>
  );
}
