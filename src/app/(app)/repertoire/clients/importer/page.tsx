import { requireAdmin } from "@/lib/auth";
import { ImporterSitesClient } from "./importer-client";

export default async function ImporterSitesPage() {
  await requireAdmin();
  return <ImporterSitesClient />;
}
