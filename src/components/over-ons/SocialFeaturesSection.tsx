import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Linkedin, Instagram, ExternalLink } from "lucide-react";
import { formatDateNL } from "@/lib/dateFormat";
import { SITE_CONFIG } from "@/config/site";

interface SocialFeature {
  id: string;
  platform: "linkedin" | "instagram";
  post_url: string;
  preview_image_url: string | null;
  preview_text: string | null;
  published_at: string | null;
}

const PROFILES = {
  linkedin: { url: SITE_CONFIG.social.linkedin, label: "Volg ons op LinkedIn", cta: "Lees op LinkedIn", Icon: Linkedin, color: "text-[#0A66C2]" },
  instagram: { url: SITE_CONFIG.social.instagram, label: "Volg ons op Instagram", cta: "Bekijk op Instagram", Icon: Instagram, color: "text-[#E1306C]" },
};

function PostCard({ feature, platform }: { feature: SocialFeature | null; platform: "linkedin" | "instagram" }) {
  const cfg = PROFILES[platform];
  const Icon = cfg.Icon;

  if (!feature) {
    return (
      <div className="rounded-2xl border border-border/50 bg-background p-6 flex flex-col items-start gap-4">
        <Icon className={`h-8 w-8 ${cfg.color}`} />
        <p className="text-muted-foreground text-sm flex-1">Nog geen recente post :  volg ons om geen update te missen.</p>
        <a href={cfg.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-accent font-semibold text-sm hover:underline">
          {cfg.label} <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  return (
    <a
      href={feature.post_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl border border-border/50 bg-background overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <Icon className={`h-6 w-6 ${cfg.color}`} />
        {feature.published_at && (
          <span className="text-xs text-muted-foreground">{formatDateNL(feature.published_at)}</span>
        )}
      </div>
      {feature.preview_image_url && (
        <img src={feature.preview_image_url} alt="" className="w-full aspect-square object-cover" />
      )}
      <div className="p-5 flex-1 flex flex-col gap-3">
        {feature.preview_text && (
          <p className="text-sm text-foreground/80 line-clamp-4">{feature.preview_text}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 text-accent font-semibold text-sm group-hover:underline">
          {cfg.cta} <ExternalLink className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
}

export function SocialFeaturesSection() {
  const [linkedin, setLinkedin] = useState<SocialFeature | null>(null);
  const [instagram, setInstagram] = useState<SocialFeature | null>(null);

  useEffect(() => {
    const load = async () => {
      const nowIso = new Date().toISOString();
      const fetchOne = async (platform: "linkedin" | "instagram") => {
        const { data } = await supabase
          .from("social_media_features")
          .select("*")
          .eq("platform", platform)
          .eq("active", true)
          .or(`featured_until.is.null,featured_until.gt.${nowIso}`)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return (data as SocialFeature) || null;
      };
      const [li, ig] = await Promise.all([fetchOne("linkedin"), fetchOne("instagram")]);
      setLinkedin(li);
      setInstagram(ig);
    };
    load();
  }, []);

  return (
    <section className="section-padding bg-secondary/40">
      <div className="container-wide max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="mb-3">Volg ons</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Zo blijf je op de hoogte van het laatste nieuws over ZZP'en, regelgeving en verzekeringen.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PostCard feature={linkedin} platform="linkedin" />
          <PostCard feature={instagram} platform="instagram" />
        </div>
      </div>
    </section>
  );
}
