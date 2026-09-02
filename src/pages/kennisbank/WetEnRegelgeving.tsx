import { seoRoute } from "@/config/seoRoutes";
import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

const SEO = seoRoute("/kennisbank/wet-en-regelgeving");

export default function KennisbankWetEnRegelgeving() {
  return (
    <KennisbankCategoryPage
      slug="wet-en-regelgeving"
      title="Wet en regelgeving"
      intro="Alles over Wet DBA, zelfstandigenregelingen en juridische aspecten van het ondernemen als zzp'er."
      categoryTags={["Wetgeving", "Regelgeving"]}
      metaTitle={SEO.title}
      metaDescription={SEO.description}
    />
  );
}
