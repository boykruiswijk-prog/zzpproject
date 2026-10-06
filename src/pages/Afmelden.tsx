import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Stand = "laden" | "geldig" | "al_afgemeld" | "ongeldig" | "afgemeld" | "fout";

const FN = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/review-afmelden`;

export default function Afmelden() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [stand, setStand] = useState<Stand>("laden");
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!token) { setStand("ongeldig"); return; }
    fetch(`${FN}?token=${encodeURIComponent(token)}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    })
      .then((r) => r.json())
      .then((d) => setStand((d?.status as Stand) ?? "fout"))
      .catch(() => setStand("fout"));
  }, [token]);

  const bevestig = async () => {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("review-afmelden", { body: { token } });
    setBezig(false);
    setStand(error ? "fout" : ((data?.status as Stand) ?? "fout"));
  };

  const teksten: Record<Stand, string> = {
    laden: "Even geduld...",
    geldig: "Wil je geen verzoeken meer ontvangen om een review te schrijven? Mails over je verzekering, certificaat en facturen blijven we gewoon sturen.",
    al_afgemeld: "Je bent al afgemeld. Je ontvangt geen verzoeken meer om een review te schrijven. Mails over je verzekering, certificaat en facturen blijven we gewoon sturen.",
    afgemeld: "Je ontvangt geen verzoeken meer om een review te schrijven. Mails over je verzekering, certificaat en facturen blijven we gewoon sturen.",
    ongeldig: "Deze afmeldlink is niet geldig. Neem contact met ons op als je je wilt afmelden.",
    fout: "Er ging iets mis. Probeer het later opnieuw of neem contact met ons op.",
  };

  return (
    <Layout>
      <SEOHead title="Afmelden | ZP Zaken" description="Afmelden voor reviewverzoeken van ZP Zaken." noindex />
      <section className="container mx-auto px-4 py-20 max-w-xl text-center space-y-6">
        <h1 className="text-3xl font-bold">Afmelden</h1>
        <p className="text-muted-foreground">{teksten[stand]}</p>
        {stand === "geldig" && (
          <Button variant="accent" onClick={bevestig} disabled={bezig}>
            {bezig ? "Bezig..." : "Ja, afmelden"}
          </Button>
        )}
      </section>
    </Layout>
  );
}
