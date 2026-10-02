import { requireAdmin } from "@/lib/auth";
import { ImporterCollaborateursClient } from "./importer-client";

export default async function ImporterCollaborateursPage() {
  await requireAdmin();
  return <ImporterCollaborateursClient />;
}
