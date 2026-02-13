import { Star } from "lucide-react";

interface MiniSocialProofProps {
  variant?: "light" | "dark";
  className?: string;
}

export function MiniSocialProof({ variant = "light", className = "" }: MiniSocialProofProps) {
  const isDark = variant === "dark";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div className="flex -space-x-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-7 w-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
              isDark
                ? "border-primary bg-primary-foreground/20 text-primary-foreground"
                : "border-background bg-accent/20 text-accent"
            }`}
          >
            {["BK", "RT", "EB", "GJ"][i - 1]}
          </div>
        ))}
      </div>
      <div className={`text-xs ${isDark ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-accent text-accent" />
          ))}
          <span className="font-semibold ml-1">4.9/5</span>
        </div>
        <span>2.500+ tevreden zzp'ers</span>
      </div>
    </div>
  );
}
