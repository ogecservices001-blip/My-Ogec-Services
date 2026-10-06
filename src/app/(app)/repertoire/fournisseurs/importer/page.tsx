import { requireAdminOuAccueil } from "@/lib/auth";
import { ImporterFournisseursClient } from "./importer-client";

export default async function ImporterFournisseursPage() {
  await requireAdminOuAccueil();
  return <ImporterFournisseursClient />;
}
