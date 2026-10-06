import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTimeLongNL } from "@/lib/dateFormat";

export function ReviewVerzoekRegel({ leadId }: { leadId: string }) {
  const { data } = useQuery({
    queryKey: ["review-verzoek", leadId],
    queryFn: async () => {
      const { data } = await supabase.from("review_verzoeken")
        .select("status, verstuurd_op, herinnering_op, geklikt_op").eq("lead_id", leadId).maybeSingle();
      return data;
    },
  });
  const d = (v?: string | null) => (v ? formatDateTimeLongNL(v) : "-");
  return (
    <div>
      <span className="text-muted-foreground">Reviewverzoek:</span>
      {data ? (
        <p className="font-medium break-words">
          verstuurd op {d(data.verstuurd_op)} / herinnerd op {d(data.herinnering_op)} / geklikt op {d(data.geklikt_op)}
          {data.status === "afgemeld" && " / afgemeld"}
          {data.status === "overgeslagen" && " / overgeslagen"}
        </p>
      ) : (
        <p className="font-medium">Nog niet verstuurd</p>
      )}
    </div>
  );
}
