import { seoRoute } from "@/config/seoRoutes";
import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

const SEO = seoRoute("/kennisbank/belastingen");

export default function KennisbankBelastingen() {
  return (
    <KennisbankCategoryPage
      slug="belastingen"
      title="Belastingen"
      intro="Belastingaangifte, BTW, fiscale aftrekposten en andere fiscale onderwerpen voor zzp'ers."
      categoryTags={["Fiscaal"]}
      metaTitle={SEO.title}
      metaDescription={SEO.description}
    />
  );
}
