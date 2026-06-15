import { KennisbankCategoryPage } from "@/components/kennisbank/KennisbankCategoryPage";

export default function KennisbankBelastingen() {
  return (
    <KennisbankCategoryPage
      slug="belastingen"
      title="Belastingen"
      intro="Belastingaangifte, BTW, fiscale aftrekposten en andere fiscale onderwerpen voor zzp'ers."
      categoryTags={["Fiscaal", "Belastingen"]}
      metaTitle="Belastingen voor ZZP'ers | Kennisbank | ZP Zaken"
      metaDescription="Belastingaangifte, BTW en fiscale aftrekposten voor zzp'ers — helder uitgelegd. Lees onze artikelen voor zelfstandigen."
    />
  );
}
