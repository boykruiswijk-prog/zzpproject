import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";

const COOKIE_CONSENT_KEY = "zpzaken_cookie_consent";
const COOKIE_CONSENT_VERSION = "1.0";

interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  version: string;
  timestamp: string;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    version: COOKIE_CONSENT_VERSION,
    timestamp: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CookiePreferences;
        // Check if consent version is outdated
        if (parsed.version !== COOKIE_CONSENT_VERSION) {
          setIsVisible(true);
        }
      } catch {
        setIsVisible(true);
      }
    } else {
      setIsVisible(true);
    }
  }, []);

  const saveConsent = (prefs: CookiePreferences) => {
    const consentData = {
      ...prefs,
      version: COOKIE_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
    setIsVisible(false);
  };

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      version: COOKIE_CONSENT_VERSION,
      timestamp: "",
    });
  };

  const acceptNecessaryOnly = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      version: COOKIE_CONSENT_VERSION,
      timestamp: "",
    });
  };

  const savePreferences = () => {
    saveConsent(preferences);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="container-wide">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 md:p-8 max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-bold">Cookie-instellingen</h3>
            </div>
            <button
              onClick={acceptNecessaryOnly}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Sluiten"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-muted-foreground text-sm mb-4">
            Wij gebruiken cookies om je ervaring op onze website te verbeteren. Sommige cookies zijn noodzakelijk voor de werking van de site, terwijl andere ons helpen om de site te analyseren en te verbeteren.{" "}
            <Link to="/cookies" className="text-accent hover:underline font-medium">
              Lees ons cookiebeleid
            </Link>
          </p>

          {showDetails && (
            <div className="space-y-3 mb-6 p-4 bg-secondary rounded-xl">
              <label className="flex items-center justify-between cursor-not-allowed">
                <div>
                  <span className="font-medium text-sm">Noodzakelijke cookies</span>
                  <p className="text-xs text-muted-foreground">Vereist voor basisfunctionaliteit</p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="h-5 w-5 rounded accent-primary"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium text-sm">Analytische cookies</span>
                  <p className="text-xs text-muted-foreground">Helpen ons de website te verbeteren</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                  className="h-5 w-5 rounded accent-primary cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="font-medium text-sm">Marketing cookies</span>
                  <p className="text-xs text-muted-foreground">Voor gepersonaliseerde advertenties</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                  className="h-5 w-5 rounded accent-primary cursor-pointer"
                />
              </label>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {!showDetails ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowDetails(true)} className="flex-1">
                  Instellingen aanpassen
                </Button>
                <Button variant="outline" size="sm" onClick={acceptNecessaryOnly} className="flex-1">
                  Alleen noodzakelijk
                </Button>
                <Button variant="accent" size="sm" onClick={acceptAll} className="flex-1">
                  Alles accepteren
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowDetails(false)} className="flex-1">
                  Terug
                </Button>
                <Button variant="accent" size="sm" onClick={savePreferences} className="flex-1">
                  Voorkeuren opslaan
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Conform AVG/GDPR en de Telecommunicatiewet
          </p>
        </div>
      </div>
    </div>
  );
}
