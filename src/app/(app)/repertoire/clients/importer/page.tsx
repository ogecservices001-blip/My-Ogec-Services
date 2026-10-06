import { requireAdminOuAccueil } from "@/lib/auth";
import { ImporterSitesClient } from "./importer-client";

export default async function ImporterSitesPage() {
  await requireAdminOuAccueil();
  return <ImporterSitesClient />;
}
