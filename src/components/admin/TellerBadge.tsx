import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Rode (of grijze) teller met uitleg; een klik opent de juiste lijst. */
export function TellerBadge({ aantal, uitleg, naar, grijs = false }: { aantal: number; uitleg: string; naar: string | null; grijs?: boolean }) {
  const navigate = useNavigate();
  if (!aantal) return null;
  const ga = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); if (naar) navigate(naar); };
  return (
    <span role="link" tabIndex={0} title={uitleg} aria-label={uitleg} onClick={ga}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ga(e); }}
      className={cn("inline-flex min-w-6 cursor-pointer items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold",
        grijs ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground")}>
      {aantal}
    </span>
  );
}
