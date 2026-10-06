import { requireAdminOuAccueil } from "@/lib/auth";
import { ImporterCollaborateursClient } from "./importer-client";

export default async function ImporterCollaborateursPage() {
  await requireAdminOuAccueil();
  return <ImporterCollaborateursClient />;
}
