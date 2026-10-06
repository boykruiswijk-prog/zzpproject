import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, X } from "lucide-react";

const GOOGLE_REVIEW_URL = "https://search.google.com/local/writereview?placeid=ChIJ5wXTzBPnxUcR5NGNhaq2lJA";
const KLIK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/review-klik`;

export function ReviewKaart() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["mijn-review-kaart"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("mijn_review_kaart");
      if (error) throw error;
      return data as { tonen?: boolean; token?: string | null } | null;
    },
  });
  if (!data?.tonen) return null;

  const href = data.token ? `${KLIK_URL}?t=${encodeURIComponent(data.token)}` : GOOGLE_REVIEW_URL;
  const verberg = async () => {
    qc.setQueryData(["mijn-review-kaart"], { ...data, tonen: false });
    await supabase.rpc("verberg_review_kaart");
  };

  return (
    <Card className="relative">
      <button type="button" onClick={verberg} aria-label="Kaart sluiten"
        className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pr-8">
          <Star className="h-5 w-5 text-accent" />
          Hoe was je ervaring?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground/80">
          Wil je in een minuut laten weten hoe het ging? Daarmee help je andere zzp'ers bij hun keuze.
        </p>
        <Button asChild variant="accent" size="sm">
          <a href={href} target="_blank" rel="noopener noreferrer">Review schrijven op Google</a>
        </Button>
      </CardContent>
    </Card>
  );
}
