import { requireAdminOuAccueil } from "@/lib/auth";
import { ImporterDevisClient } from "./importer-devis";

export default async function ImporterDevisPage() {
  await requireAdminOuAccueil();
  return <ImporterDevisClient />;
}
