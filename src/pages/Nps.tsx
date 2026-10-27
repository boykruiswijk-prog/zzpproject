import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Stand = "laden" | "opgeslagen" | "ongeldig" | "fout";

/** Bedankpagina na klik op een NPS-cijfer. Bewust geen link naar Google-reviews (geen review-gating). */
export default function Nps() {
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const score = Number(params.get("s"));
  const [stand, setStand] = useState<Stand>("laden");
  const [tekst, setTekst] = useState("");
  const [website, setWebsite] = useState("");
  const [toelichtingKlaar, setToelichtingKlaar] = useState(false);
  const [bezig, setBezig] = useState(false);
  const verstuurd = useRef(false);

  useEffect(() => {
    if (verstuurd.current) return;
    verstuurd.current = true;
    if (!/^[a-f0-9]{32,128}$/i.test(token) || !Number.isInteger(score) || score < 0 || score > 10) { setStand("ongeldig"); return; }
    supabase.functions.invoke("nps-antwoord", { body: { token, score } })
      .then(({ data, error }) => setStand(error ? "fout" : data?.status === "opgeslagen" ? "opgeslagen" : "ongeldig"));
  }, [token, score]);

  const stuurToelichting = async () => {
    setBezig(true);
    const { data, error } = await supabase.functions.invoke("nps-antwoord", { body: { token, toelichting: tekst.trim(), website } });
    setBezig(false);
    if (!error && data?.status === "opgeslagen") setToelichtingKlaar(true); else setStand("fout");
  };

  return (
    <Layout>
      <SEOHead title="Dank je wel | ZP Zaken" description="Bedankt voor je antwoord aan ZP Zaken." noindex />
      <section className="container mx-auto max-w-xl space-y-6 px-4 py-20 text-center">
        {stand === "laden" && <p className="text-muted-foreground">Even geduld...</p>}
        {stand === "ongeldig" && <p className="text-muted-foreground">Deze link is niet geldig. Neem contact met ons op als je iets wilt laten weten.</p>}
        {stand === "fout" && <p className="text-muted-foreground">Er ging iets mis. Probeer het later opnieuw of antwoord op de mail.</p>}
        {stand === "opgeslagen" && <>
          <h1 className="text-3xl font-bold">Dank je wel!</h1>
          <p className="text-muted-foreground">Je antwoord is opgeslagen.</p>
          {toelichtingKlaar ? <p>Bedankt voor je toelichting.</p> : <div className="space-y-3 text-left">
            <label htmlFor="nps-toelichting" className="block font-medium">Wil je nog iets toelichten?</label>
            <Textarea id="nps-toelichting" maxLength={1000} rows={4} value={tekst} onChange={(e) => setTekst(e.target.value)} />
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <Button variant="accent" onClick={stuurToelichting} disabled={bezig || !tekst.trim()}>{bezig ? "Bezig..." : "Versturen"}</Button>
          </div>}
        </>}
      </section>
    </Layout>
  );
}
