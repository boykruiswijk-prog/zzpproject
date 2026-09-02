import { seoRoute } from "@/config/seoRoutes";
import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

const SEO = seoRoute("/kennisbank/ondernemen");

export default function KennisbankOndernemen() {
  return (
    <KennisbankCategoryPage
      slug="ondernemen"
      title="Ondernemen"
      intro="Praktische tips en kennis voor groei, klantrelaties, professionalisering en risicomanagement als zelfstandige."
      categoryTags={["Nieuws", "Verzekeringen"]}
      metaTitle={SEO.title}
      metaDescription={SEO.description}
    />
  );
}
