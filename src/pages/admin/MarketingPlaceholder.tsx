import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";

export default function MarketingPlaceholder() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Website &amp; Blog</h1>
          <p className="text-muted-foreground">
            Marketingomgeving voor de website en blog. Hier komen straks de content-tools.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              In ontwikkeling
            </CardTitle>
            <CardDescription>
              Deze module wordt in een volgende stap ingevuld met de blog- en websitepublicatie-flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Alleen gebruikers met de rol <strong>marketing</strong> of <strong>supervisor</strong> hebben toegang tot deze omgeving.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
