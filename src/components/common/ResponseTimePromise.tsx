import { Clock } from "lucide-react";

interface Props {
  variant?: "default" | "compact" | "dark";
  className?: string;
}

export function ResponseTimePromise({ variant = "default", className = "" }: Props) {
  const isDark = variant === "dark";
  const isCompact = variant === "compact";

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 ${
        isDark
          ? "bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground"
          : "bg-card border-border/60 text-foreground"
      } ${className}`}
    >
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          isDark ? "bg-primary-foreground/10" : "bg-accent/10"
        }`}
      >
        <Clock className={`h-5 w-5 ${isDark ? "text-primary-foreground" : "text-accent"}`} />
      </div>
      <div className="leading-tight">
        <p className={`font-semibold ${isCompact ? "text-sm" : "text-base"}`}>Reactie binnen 24 uur</p>
        <p className={`text-xs ${isDark ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          In de praktijk reageren we vaak sneller.
        </p>
      </div>
    </div>
  );
}
